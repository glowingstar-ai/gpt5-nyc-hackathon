(() => {
  const WIDGET_ID = "gpt5-live-companion-root";
  if (document.getElementById(WIDGET_ID)) {
    return;
  }

  const API_BASE_DEFAULT = "http://localhost:8000/api/v1";
  let apiBase = API_BASE_DEFAULT;

  const pendingResponses = new Map();
  let isConnecting = false;
  let isActive = false;
  let statusMessage = "Idle – start a call to speak with the realtime assistant.";
  let peerConnection = null;
  let dataChannel = null;
  let localStream = null;
  let audioElement = null;

  const updateStatus = (text) => {
    statusMessage = text;
    statusEl.textContent = statusMessage;
  };

  const setError = (message) => {
    if (!message) {
      errorEl.textContent = "";
      errorEl.style.display = "none";
    } else {
      errorEl.textContent = message;
      errorEl.style.display = "block";
    }
  };

  const setConnecting = (next) => {
    isConnecting = next;
    startButton.disabled = isConnecting || isActive;
    startButton.textContent = isConnecting
      ? "Connecting…"
      : isActive
        ? "Connected"
        : "Start conversation";
    hangupButton.disabled = !isConnecting && !isActive;
    sendButton.disabled = !isActive;
    textInput.disabled = !isActive;
  };

  const setActive = (next) => {
    isActive = next;
    startButton.textContent = isConnecting
      ? "Connecting…"
      : isActive
        ? "Connected"
        : "Start conversation";
    hangupButton.disabled = !isConnecting && !isActive;
    sendButton.disabled = !isActive;
    textInput.disabled = !isActive;
  };

  const appendTranscriptEntry = (id, role, text) => {
    const existing = transcriptList.querySelector(`[data-entry-id="${id}"]`);
    if (existing) {
      existing.querySelector(".gpt5-transcript-text").textContent = text;
      return;
    }

    const entry = document.createElement("div");
    entry.className = "gpt5-transcript-entry";
    entry.dataset.entryId = id;

    const roleEl = document.createElement("span");
    roleEl.className = "gpt5-transcript-role";
    roleEl.textContent = role;
    entry.appendChild(roleEl);

    const textEl = document.createElement("span");
    textEl.className = "gpt5-transcript-text";
    textEl.textContent = text;
    entry.appendChild(textEl);

    transcriptList.appendChild(entry);
    transcriptList.scrollTop = transcriptList.scrollHeight;
  };

  const clearTranscript = () => {
    transcriptList.innerHTML = "";
    pendingResponses.clear();
  };

  const waitForIceGathering = (pc) =>
    new Promise((resolve) => {
      if (pc.iceGatheringState === "complete") {
        resolve();
        return;
      }

      const checkState = () => {
        if (pc.iceGatheringState === "complete") {
          pc.removeEventListener("icegatheringstatechange", checkState);
          resolve();
        }
      };

      pc.addEventListener("icegatheringstatechange", checkState);
    });

  const normalizeDelta = (payload) => {
    const delta = payload.delta ?? payload.text ?? payload.content;
    return typeof delta === "string" ? delta : "";
  };

  const extractResponseId = (payload) => {
    if (typeof payload.response_id === "string") return payload.response_id;
    if (typeof payload.id === "string") return payload.id;
    const response = payload.response;
    if (response && typeof response === "object" && "id" in response) {
      const { id } = response;
      if (typeof id === "string") return id;
    }
    return `resp_${Date.now()}`;
  };

  const handleServerMessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      const type = typeof payload.type === "string" ? payload.type : "";
      if (
        type === "response.output_text.delta" ||
        type === "response.output_audio_transcript.delta"
      ) {
        const responseId = extractResponseId(payload);
        const next = (pendingResponses.get(responseId) ?? "") + normalizeDelta(payload);
        pendingResponses.set(responseId, next);
        appendTranscriptEntry(responseId, "assistant", next);
        return;
      }

      if (type === "response.done") {
        const responseId = extractResponseId(payload);
        const existing = pendingResponses.get(responseId);
        if (existing) {
          pendingResponses.set(responseId, existing.trim());
          appendTranscriptEntry(responseId, "assistant", existing.trim());
        }
        return;
      }

      if (type === "conversation.item.created") {
        const { item } = payload;
        if (item && typeof item === "object") {
          const { role, content, id } = item;
          if (role === "user" && Array.isArray(content)) {
            const textPart = content.find(
              (part) => part && typeof part === "object" && part.type === "input_text"
            );
            if (textPart && typeof textPart.text === "string") {
              const entryId = typeof id === "string" ? id : `user_${Date.now()}`;
              appendTranscriptEntry(entryId, "user", textPart.text);
            }
          }
        }
        return;
      }
    } catch (err) {
      console.warn("Failed to parse realtime event", err);
    }
  };

  const resetConnection = (message) => {
    if (dataChannel) {
      dataChannel.removeEventListener("message", handleServerMessage);
      try {
        dataChannel.close();
      } catch (err) {
        console.debug("Error closing data channel", err);
      }
    }
    dataChannel = null;

    if (peerConnection) {
      peerConnection.onicecandidate = null;
      peerConnection.ontrack = null;
      peerConnection.onconnectionstatechange = null;
      try {
        peerConnection.close();
      } catch (err) {
        console.debug("Error closing peer connection", err);
      }
    }
    peerConnection = null;

    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    localStream = null;

    if (audioElement) {
      audioElement.srcObject = null;
    }

    setActive(false);
    setConnecting(false);
    sendButton.disabled = true;
    textInput.disabled = true;

    if (message) {
      updateStatus(message);
    } else {
      updateStatus("Call ended. Start again to reconnect.");
    }
  };

  const startConversation = async () => {
    if (isConnecting || isActive) {
      panel.classList.add("is-open");
      return;
    }

    clearTranscript();
    setError("");
    updateStatus("Requesting realtime session…");
    setConnecting(true);

    try {
      const response = await fetch(`${apiBase}/realtime/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      if (!response.ok) {
        throw new Error(`Failed to create realtime session (${response.status})`);
      }
      const token = await response.json();
      if (!token || !token.client_secret || !token.url) {
        throw new Error("Realtime session response is missing required fields.");
      }

      peerConnection = new RTCPeerConnection();

      peerConnection.ontrack = (event) => {
        const [remoteStream] = event.streams;
        if (audioElement && remoteStream) {
          audioElement.srcObject = remoteStream;
          audioElement.play().catch((err) => {
            console.warn("Unable to autoplay remote audio", err);
          });
        }
      };

      peerConnection.onconnectionstatechange = () => {
        if (peerConnection.connectionState === "connected") {
          updateStatus("Connected – start speaking with the assistant.");
        }
        if (
          peerConnection.connectionState === "failed" ||
          peerConnection.connectionState === "disconnected"
        ) {
          resetConnection("Connection lost. Try starting the conversation again.");
        }
      };

      dataChannel = peerConnection.createDataChannel("oai-events");
      dataChannel.addEventListener("message", handleServerMessage);
      dataChannel.addEventListener("open", () => {
        setActive(true);
        updateStatus("Assistant joined – you can speak or send text prompts.");
        try {
          dataChannel.send(JSON.stringify({ type: "response.create" }));
        } catch (err) {
          console.debug("Unable to request initial response", err);
        }
      });
      dataChannel.addEventListener("close", () => {
        resetConnection();
      });

      localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));

      await peerConnection.setLocalDescription(await peerConnection.createOffer());
      await waitForIceGathering(peerConnection);

      const sdpResponse = await fetch(token.url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token.client_secret}`,
          "Content-Type": "application/sdp",
          "OpenAI-Beta": "realtime=v1"
        },
        body: peerConnection.localDescription?.sdp ?? ""
      });

      if (!sdpResponse.ok) {
        throw new Error(`Realtime handshake failed (${sdpResponse.status})`);
      }

      const answer = await sdpResponse.text();
      await peerConnection.setRemoteDescription({ type: "answer", sdp: answer });
      updateStatus("Awaiting assistant audio…");
      setConnecting(false);
      setActive(true);
    } catch (err) {
      console.error("Unable to start realtime conversation", err);
      setError(err instanceof Error ? err.message : "Unknown realtime error");
      resetConnection("Unable to establish realtime session.");
    }
  };

  const stopConversation = () => {
    if (!isConnecting && !isActive) {
      return;
    }
    resetConnection();
  };

  const sendTextMessage = () => {
    if (!dataChannel || dataChannel.readyState !== "open") {
      return;
    }
    const text = textInput.value.trim();
    if (!text) {
      return;
    }

    const entryId = `user_${Date.now()}`;
    appendTranscriptEntry(entryId, "user", text);
    dataChannel.send(
      JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text }]
        }
      })
    );
    dataChannel.send(JSON.stringify({ type: "response.create" }));
    textInput.value = "";
  };

  const host = document.createElement("div");
  host.id = WIDGET_ID;
  const shadow = host.attachShadow({ mode: "open" });

  const wrapper = document.createElement("div");
  wrapper.className = "gpt5-widget-wrapper";

  const hoverButton = document.createElement("button");
  hoverButton.type = "button";
  hoverButton.className = "gpt5-hover-button";
  hoverButton.innerHTML = '<span class="gpt5-hover-button-icon">💬</span>';
  hoverButton.title = "Open GPT5 live companion";
  hoverButton.setAttribute("aria-label", "Open GPT5 live companion");

  const panel = document.createElement("section");
  panel.className = "gpt5-conversation-panel";
  panel.innerHTML = `
    <header class="gpt5-panel-header">
      <h2 class="gpt5-panel-title">GPT5 live companion</h2>
      <p class="gpt5-panel-status"></p>
    </header>
    <div class="gpt5-panel-body">
      <div class="gpt5-transcript" data-transcript aria-live="polite"></div>
      <div class="gpt5-error" style="display: none"></div>
      <div class="gpt5-input-area">
        <textarea class="gpt5-text-input" rows="2" placeholder="Type to send the assistant context…" disabled></textarea>
        <div class="gpt5-actions">
          <button type="button" class="gpt5-button gpt5-button-primary" data-action="start">Start conversation</button>
          <button type="button" class="gpt5-button gpt5-button-secondary" data-action="hangup" disabled>Hang up</button>
        </div>
        <button type="button" class="gpt5-button gpt5-button-primary" data-send disabled>Send message</button>
      </div>
      <audio autoplay></audio>
    </div>
  `;

  const styleEl = document.createElement("link");
  styleEl.rel = "stylesheet";
  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL) {
    styleEl.href = chrome.runtime.getURL("src/content-styles.css");
  } else {
    styleEl.href = "src/content-styles.css";
  }

  shadow.appendChild(styleEl);
  shadow.appendChild(wrapper);
  wrapper.appendChild(panel);
  wrapper.appendChild(hoverButton);

  const statusEl = panel.querySelector(".gpt5-panel-status");
  const errorEl = panel.querySelector(".gpt5-error");
  const transcriptList = panel.querySelector("[data-transcript]");
  const textInput = panel.querySelector(".gpt5-text-input");
  const startButton = panel.querySelector('[data-action="start"]');
  const hangupButton = panel.querySelector('[data-action="hangup"]');
  const sendButton = panel.querySelector("[data-send]");
  audioElement = panel.querySelector("audio");

  if (!statusEl || !errorEl || !transcriptList || !textInput || !startButton || !hangupButton || !sendButton || !audioElement) {
    console.error("GPT5 live companion failed to initialize UI elements.");
    return;
  }

  updateStatus(statusMessage);
  setError("");
  setConnecting(false);
  setActive(false);

  hoverButton.addEventListener("click", () => {
    panel.classList.toggle("is-open");
    if (panel.classList.contains("is-open") && !isConnecting && !isActive) {
      updateStatus(statusMessage);
    }
  });

  startButton.addEventListener("click", () => {
    panel.classList.add("is-open");
    void startConversation();
  });

  hangupButton.addEventListener("click", () => {
    panel.classList.add("is-open");
    stopConversation();
  });

  sendButton.addEventListener("click", () => {
    panel.classList.add("is-open");
    sendTextMessage();
  });

  textInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      sendTextMessage();
    }
  });

  document.body.appendChild(host);

  const applyStoredConfig = () => {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get({ apiBase: API_BASE_DEFAULT }, (items) => {
        if (items && typeof items.apiBase === "string" && items.apiBase.trim()) {
          apiBase = items.apiBase.trim().replace(/\/$/, "");
        }
      });
    }
  };

  applyStoredConfig();

  const cleanup = () => {
    resetConnection();
    if (host.isConnected) {
      host.remove();
    }
  };

  window.addEventListener("beforeunload", cleanup);
})();
