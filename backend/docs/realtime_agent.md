# Realtime agent integration

This backend now uses the OpenAI Agent SDK to mint WebRTC-ready realtime sessions.  The
[`RealtimeSessionClient`](../app/services/realtime.py) wraps the
`AsyncOpenAI.realtime.sessions.create` helper so downstream code does not have to make manual
HTTP requests or juggle headers.  You simply configure it with your API key, model, and optional
voice and instructions, then call `create_ephemeral_session()`—passing an instruction override when
you want to inject fresh context.  The helper returns a structured `RealtimeSession` that includes
all of the metadata your clients need (session ID, client secret, expiry, handshake URL, etc.).

```python
from openai import AsyncOpenAI
from app.services.realtime import RealtimeSessionClient

client = RealtimeSessionClient(
    api_key="sk-...",
    base_url="https://api.openai.com/v1",
    model="gpt-4o-realtime-preview",
    voice="verse",
)

session = await client.create_ephemeral_session(
    instructions="React to the user's current workspace"
)
print(session.handshake_url)  # -> https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview
```

## Feeding visual frames into the agent

Visual context is captured via the `/api/v1/vision/frame` endpoint.  Incoming frames are stored in
the in-memory `ContextStorage` and the most recent base64 snapshot is included in the
`latest_frame_base64` field returned by `/api/v1/realtime/session`.

When you bootstrap the Agent SDK client, pass that base64 data as an `input_image` block alongside
any text you want the model to process.  Here's a minimal example using the SDK's Responses helper:

```python
from openai import AsyncOpenAI

sdk = AsyncOpenAI(api_key="sk-...")
realtime = await sdk.realtime.sessions.create(model=session.model)

await sdk.responses.create(
    session_id=realtime.id,
    input=[
        {
            "role": "user",
            "content": [
                {"type": "input_text", "text": "What do you see on my screen?"},
                {"type": "input_image", "image_base64": latest_frame_base64},
            ],
        }
    ],
    stream=True,
)
```

You can send additional frames at any time—either through subsequent REST calls or directly over
the WebRTC data channel—by repeating the `input_image` block with new base64 payloads.  The
`create_realtime_session` route automatically refreshes the temporary session instructions with the
latest screenshot so the model has immediate situational awareness.
