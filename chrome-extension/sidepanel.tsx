import { useCallback, useEffect, useRef, useState } from "react"

type RealtimeSessionToken = {
  session_id?: string | null
  client_secret: string
  expires_at: string
  model: string
  url: string
  voice?: string | null
}

type TranscriptEntry = {
  id: string
  role: "assistant" | "user"
  text: string
}

const DEFAULT_API_BASE = "http://localhost:8000/api/v1"

const waitForIceGathering = (pc: RTCPeerConnection): Promise<void> =>
  new Promise((resolve) => {
    if (pc.iceGatheringState === "complete") {
      resolve()
      return
    }
    const checkState = () => {
      if (pc.iceGatheringState === "complete") {
        pc.removeEventListener("icegatheringstatechange", checkState)
        resolve()
      }
    }
    pc.addEventListener("icegatheringstatechange", checkState)
  })

const normalizeDelta = (payload: Record<string, unknown>): string => {
  const delta = payload.delta ?? payload.text ?? payload.content
  return typeof delta === "string" ? delta : ""
}

const extractResponseId = (payload: Record<string, unknown>): string => {
  if (typeof payload.response_id === "string") return payload.response_id
  if (typeof payload.id === "string") return payload.id
  const response = payload.response
  if (response && typeof response === "object" && "id" in response) {
    const { id } = response as { id?: unknown }
    if (typeof id === "string") return id
  }
  return `resp_${Date.now()}`
}

const sanitizeBaseUrl = (value: string) => {
  if (!value) return DEFAULT_API_BASE
  return value.endsWith("/") ? value.slice(0, -1) : value
}

function SidePanel() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const dataChannelRef = useRef<RTCDataChannel | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const pendingResponsesRef = useRef<Map<string, string>>(new Map())
  const isMountedRef = useRef(true)

  const [apiBase, setApiBase] = useState<string>(DEFAULT_API_BASE)
  const [status, setStatus] = useState(
    "Idle — start a conversation to speak with GPT-5."
  )
  const [error, setError] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isActive, setIsActive] = useState(false)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [inputValue, setInputValue] = useState("")

  useEffect(() => {
    chrome.storage?.local?.get(["apiBaseUrl"], (res) => {
      if (typeof res?.apiBaseUrl === "string" && res.apiBaseUrl.length > 0) {
        setApiBase(sanitizeBaseUrl(res.apiBaseUrl))
      }
    })
  }, [])

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      resetConnection()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const persistBase = useCallback((value: string) => {
    const sanitized = sanitizeBaseUrl(value)
    setApiBase(sanitized)
    chrome.storage?.local?.set({ apiBaseUrl: sanitized })
  }, [])

  const resetConnection = useCallback((message?: string) => {
    dataChannelRef.current?.close()
    dataChannelRef.current = null

    const pc = peerConnectionRef.current
    peerConnectionRef.current = null
    if (pc) {
      pc.onicecandidate = null
      pc.ontrack = null
      pc.onconnectionstatechange = null
      pc.close()
    }

    const localStream = localStreamRef.current
    localStreamRef.current = null
    localStream?.getTracks().forEach((track) => track.stop())

    if (audioRef.current) {
      audioRef.current.srcObject = null
    }

    pendingResponsesRef.current.clear()
    setIsConnecting(false)
    setIsActive(false)
    if (message) {
      setStatus(message)
    } else {
      setStatus("Call ended. Start a new conversation when ready.")
    }
  }, [])

  const appendAssistantDelta = useCallback((responseId: string, delta: string) => {
    if (!delta) return
    const updated = (pendingResponsesRef.current.get(responseId) ?? "") + delta
    pendingResponsesRef.current.set(responseId, updated)
    setTranscript((prev) => {
      const index = prev.findIndex((entry) => entry.id === responseId)
      if (index >= 0) {
        const clone = [...prev]
        clone[index] = { ...clone[index], text: updated }
        return clone
      }
      return [...prev, { id: responseId, role: "assistant", text: updated }]
    })
  }, [])

  const handleServerMessage = useCallback(
    (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as Record<string, unknown>
        const type = typeof payload.type === "string" ? payload.type : ""

        if (
          type === "response.output_text.delta" ||
          type === "response.output_audio_transcript.delta"
        ) {
          appendAssistantDelta(
            extractResponseId(payload),
            normalizeDelta(payload)
          )
          return
        }

        if (type === "response.done") {
          const responseId = extractResponseId(payload)
          const existing = pendingResponsesRef.current.get(responseId)
          if (existing) {
            pendingResponsesRef.current.set(responseId, existing.trim())
            setTranscript((prev) => {
              const index = prev.findIndex((entry) => entry.id === responseId)
              if (index === -1) return prev
              const clone = [...prev]
              clone[index] = { ...clone[index], text: existing.trim() }
              return clone
            })
          }
          return
        }

        if (type === "conversation.item.created") {
          const item = payload.item
          if (item && typeof item === "object") {
            const { role, content, id } = item as {
              role?: unknown
              content?: unknown
              id?: unknown
            }
            if (role === "user" && Array.isArray(content)) {
              const textPart = content.find((part) => {
                return (
                  part &&
                  typeof part === "object" &&
                  (part as { type?: string }).type === "input_text"
                )
              }) as { text?: unknown } | undefined

              if (typeof textPart?.text === "string") {
                const entryId = typeof id === "string" ? id : `user_${Date.now()}`
                setTranscript((prev) => [
                  ...prev,
                  { id: entryId, role: "user", text: textPart.text }
                ])
              }
            }
          }
        }
      } catch (err) {
        console.warn("Failed to parse realtime event", err)
      }
    },
    [appendAssistantDelta]
  )

  const startConversation = useCallback(async () => {
    if (isConnecting || isActive) {
      return
    }

    setIsConnecting(true)
    setError(null)
    setStatus("Requesting realtime session…")
    setTranscript([])
    pendingResponsesRef.current.clear()

    try {
      const response = await fetch(
        `${sanitizeBaseUrl(apiBase)}/realtime/session`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" }
        }
      )

      if (!response.ok) {
        throw new Error(`Failed to create realtime session (${response.status})`)
      }

      const token = (await response.json()) as RealtimeSessionToken
      if (!token.client_secret || !token.url) {
        throw new Error("Realtime session response is missing required fields.")
      }

      const pc = new RTCPeerConnection()
      peerConnectionRef.current = pc

      pc.ontrack = (event) => {
        const [remoteStream] = event.streams
        if (audioRef.current && remoteStream) {
          audioRef.current.srcObject = remoteStream
        }
      }

      pc.onconnectionstatechange = () => {
        if (!isMountedRef.current) {
          return
        }

        if (pc.connectionState === "connected") {
          setStatus("Connected — start chatting with the assistant.")
        }

        if (
          pc.connectionState === "failed" ||
          pc.connectionState === "disconnected" ||
          pc.connectionState === "closed"
        ) {
          resetConnection("Connection lost. Start again to reconnect.")
        }
      }

      const dataChannel = pc.createDataChannel("oai-events")
      dataChannelRef.current = dataChannel
      dataChannel.addEventListener("message", handleServerMessage)
      dataChannel.addEventListener("open", () => {
        if (!isMountedRef.current) {
          return
        }
        setIsActive(true)
        setIsConnecting(false)
        setStatus("Assistant joined — speak or send text prompts.")
        dataChannel.send(JSON.stringify({ type: "response.create" }))
      })
      dataChannel.addEventListener("close", () => {
        if (isMountedRef.current) {
          resetConnection()
        }
      })

      const localStream = await navigator.mediaDevices.getUserMedia({
        audio: true
      })
      localStreamRef.current = localStream
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream)
      })

      await pc.setLocalDescription(await pc.createOffer())
      await waitForIceGathering(pc)

      const sdpResponse = await fetch(token.url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token.client_secret}`,
          "Content-Type": "application/sdp",
          "OpenAI-Beta": "realtime=v1"
        },
        body: pc.localDescription?.sdp ?? ""
      })

      if (!sdpResponse.ok) {
        throw new Error(`Realtime handshake failed (${sdpResponse.status})`)
      }

      const answer = await sdpResponse.text()
      await pc.setRemoteDescription({ type: "answer", sdp: answer })
      setStatus("Awaiting assistant audio…")
    } catch (err) {
      console.error("Unable to start realtime conversation", err)
      if (err instanceof Error) {
        setError(err.message)
        resetConnection("Unable to establish realtime session.")
      } else {
        setError("Unknown error while connecting to realtime session.")
        resetConnection()
      }
    }
  }, [apiBase, handleServerMessage, isActive, isConnecting, resetConnection])

  const stopConversation = useCallback(() => {
    if (!isConnecting && !isActive) {
      return
    }
    resetConnection()
  }, [isActive, isConnecting, resetConnection])

  const sendTextMessage = useCallback(() => {
    const channel = dataChannelRef.current
    const text = inputValue.trim()
    if (!channel || !text || channel.readyState !== "open") {
      return
    }

    const entryId = `user_${Date.now()}`
    setTranscript((prev) => [...prev, { id: entryId, role: "user", text }])
    channel.send(
      JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text }]
        }
      })
    )
    channel.send(JSON.stringify({ type: "response.create" }))
    setInputValue("")
  }, [inputValue])

  return (
    <div
      style={{
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        minHeight: "100vh",
        background: "#0f172a",
        color: "#f8fafc",
        display: "flex",
        flexDirection: "column",
        padding: "20px",
        gap: "16px"
      }}>
      <header>
        <h1
          style={{
            fontSize: "20px",
            fontWeight: 600,
            margin: 0,
            marginBottom: "4px"
          }}>
          GPT-5 Realtime Companion
        </h1>
        <p style={{ margin: 0, color: "#cbd5f5", fontSize: "14px" }}>
          Start a live voice conversation with the assistant.
        </p>
      </header>

      <section
        style={{
          background: "rgba(15,23,42,0.6)",
          border: "1px solid rgba(148,163,184,0.3)",
          borderRadius: "12px",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "12px"
        }}>
        <div style={{ fontSize: "14px", lineHeight: 1.5 }}>{status}</div>
        {error ? (
          <div style={{ color: "#fca5a5", fontSize: "13px" }}>{error}</div>
        ) : null}

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            onClick={startConversation}
            disabled={isConnecting || isActive}
            style={{
              background: isActive
                ? "rgba(16,185,129,0.35)"
                : "rgba(59,130,246,0.85)",
              border: "none",
              color: "white",
              padding: "10px 16px",
              borderRadius: "10px",
              cursor: isConnecting || isActive ? "not-allowed" : "pointer",
              fontWeight: 600,
              fontSize: "14px"
            }}>
            {isConnecting ? "Connecting…" : isActive ? "Connected" : "Start"}
          </button>
          <button
            onClick={stopConversation}
            disabled={!isConnecting && !isActive}
            style={{
              background: "rgba(248,113,113,0.85)",
              border: "none",
              color: "white",
              padding: "10px 16px",
              borderRadius: "10px",
              cursor:
                !isConnecting && !isActive ? "not-allowed" : "pointer",
              fontWeight: 600,
              fontSize: "14px"
            }}>
            Hang up
          </button>
        </div>

        <div
          style={{
            background: "rgba(15,23,42,0.7)",
            border: "1px solid rgba(148,163,184,0.25)",
            borderRadius: "10px",
            padding: "12px",
            maxHeight: "220px",
            overflowY: "auto"
          }}>
          {transcript.length === 0 ? (
            <p style={{ margin: 0, color: "#cbd5f5", fontSize: "13px" }}>
              Assistant and user transcripts will appear here.
            </p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, gap: "8px" }}>
              {transcript.map((entry) => (
                <li key={entry.id} style={{ marginBottom: "10px" }}>
                  <span
                    style={{
                      display: "block",
                      textTransform: "uppercase",
                      fontSize: "11px",
                      letterSpacing: "0.08em",
                      color: "#94a3b8"
                    }}>
                    {entry.role}
                  </span>
                  <span style={{ fontSize: "14px", color: "#f8fafc" }}>
                    {entry.text}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            sendTextMessage()
          }}
          style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <input
            type="text"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder={
              isActive
                ? "Send a text prompt to the assistant"
                : "Connect to send a prompt"
            }
            disabled={!isActive}
            style={{
              flex: "1 1 160px",
              minWidth: "0",
              borderRadius: "10px",
              border: "1px solid rgba(148,163,184,0.4)",
              background: "rgba(30,41,59,0.7)",
              color: "#f8fafc",
              padding: "10px 12px",
              fontSize: "14px"
            }}
          />
          <button
            type="submit"
            disabled={!isActive || !inputValue.trim()}
            style={{
              background: "rgba(148,163,184,0.35)",
              border: "none",
              color: "white",
              padding: "10px 16px",
              borderRadius: "10px",
              cursor: !isActive || !inputValue.trim() ? "not-allowed" : "pointer",
              fontWeight: 600,
              fontSize: "14px"
            }}>
            Send
          </button>
        </form>
      </section>

      <section
        style={{
          marginTop: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "8px"
        }}>
        <label
          htmlFor="api-base-input"
          style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 600 }}>
          API base URL
        </label>
        <input
          id="api-base-input"
          type="text"
          value={apiBase}
          onChange={(event) => persistBase(event.target.value)}
          placeholder="http://localhost:8000/api/v1"
          style={{
            borderRadius: "10px",
            border: "1px solid rgba(148,163,184,0.4)",
            background: "rgba(15,23,42,0.7)",
            color: "#f8fafc",
            padding: "10px 12px",
            fontSize: "13px"
          }}
        />
      </section>

      <audio ref={audioRef} autoPlay style={{ display: "none" }} />
    </div>
  )
}

export default SidePanel
