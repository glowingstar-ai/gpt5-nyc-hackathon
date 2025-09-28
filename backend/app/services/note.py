"""Services for note processing and annotation."""

from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass
from typing import AsyncGenerator

import httpx


class NoteAnnotationError(RuntimeError):
    """Raised when the annotation service fails."""


@dataclass
class AnnotationResult:
    """Holds the annotation returned by the language model."""

    content: str


class NoteAnnotator:
    """Call the OpenAI API (GPT-5) to annotate user notes."""

    def __init__(self, api_key: str, base_url: str, model: str) -> None:
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._model = model

    def _build_payload(
        self,
        *,
        title: str,
        content: str,
        audio_url: str | None,
        transcript: str | None,
    ) -> dict[str, object]:
        """Create the payload used for both standard and streamed requests."""

        system_lines = [
            "You are an expert note-taking assistant that creates polished, well-structured notes.",
        ]
        
        if transcript:
            system_lines.extend([
                "Use the provided voice memo transcript as the primary source of truth for content.",
                "Create well-structured, professional notes based solely on what was said in the recording.",
                "Do not generate additional content beyond what is present in the audio recording.",
            ])
        elif audio_url:
            system_lines.extend([
                "An audio recording of the conversation is available at the following URL for additional context:",
                audio_url,
                "Use the audio recording as the primary source of truth for content.",
                "Create well-structured, professional notes based solely on what was said in the recording.",
            ])
        else:
            system_lines.extend([
                "Use the user's written content as the primary source of information.",
                "Transform their notes into professional, organized content with clear structure.",
                "Add appropriate headings, bullet points, and formatting to make the notes more readable.",
                "Enhance and expand the user's written content while maintaining accuracy.",
            ])

        if transcript:
            user_sections = [f"Title: {title}", "", "Please create polished notes from this transcript:", "", "Voice memo transcript:", transcript]
        elif audio_url:
            user_sections = [f"Title: {title}", "", "Please create polished notes from the audio recording:", "", content]
        else:
            user_sections = [f"Title: {title}", "", "Please polish and structure these notes:", content]

        # Use Responses API format for GPT-5, Chat Completions for other models
        if self._model.startswith("gpt-5"):
            # For GPT-5, combine system and user content into input
            combined_input = "\n".join(system_lines) + "\n\n" + "\n".join(user_sections)
            return {
                "model": self._model,
                "input": combined_input,
                "reasoning": {
                    "effort": "medium"  # Can be minimal, low, medium, high
                },
                "text": {
                    "verbosity": "medium"  # Can be low, medium, high
                }
            }
        else:
            # Fallback to Chat Completions for non-GPT-5 models
            return {
                "model": self._model,
                "messages": [
                    {"role": "system", "content": "\n".join(system_lines)},
                    {
                        "role": "user",
                        "content": "\n".join(user_sections),
                    },
                ],
            }

    async def annotate(
        self,
        *,
        title: str,
        content: str,
        audio_url: str | None,
        transcript: str | None = None,
    ) -> AnnotationResult:
        """Request an annotation summary for the provided note."""

        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        payload = self._build_payload(
            title=title,
            content=content,
            audio_url=audio_url,
            transcript=transcript,
        )

        # Determine API endpoint based on model
        if self._model.startswith("gpt-5"):
            endpoint = f"{self._base_url}/responses"
        else:
            endpoint = f"{self._base_url}/chat/completions"

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.post(
                    endpoint, json=payload, headers=headers
                )
                response.raise_for_status()
            except httpx.HTTPError as exc:  # pragma: no cover - network errors not deterministic
                raise NoteAnnotationError("Failed to contact the annotation service") from exc

        data = response.json()
        try:
            if self._model.startswith("gpt-5"):
                # Responses API format - extract text from output array
                output_items = data.get("output", [])
                for item in output_items:
                    if item.get("type") == "message":
                        content_items = item.get("content", [])
                        for content_item in content_items:
                            if content_item.get("type") == "output_text":
                                message = content_item.get("text", "").strip()
                                break
                        break
                else:
                    raise KeyError("No output_text found in response")
            else:
                # Chat Completions format
                message = data["choices"][0]["message"]["content"].strip()
        except (KeyError, IndexError, TypeError) as exc:
            raise NoteAnnotationError("Unexpected response from annotation service") from exc

        return AnnotationResult(content=message)

    async def stream_annotation(
        self,
        *,
        title: str,
        content: str,
        audio_url: str | None,
        transcript: str | None,
    ) -> AsyncGenerator[str, None]:
        """Yield annotation deltas as the model streams them back."""

        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        payload = self._build_payload(
            title=title,
            content=content,
            audio_url=audio_url,
            transcript=transcript,
        )
        
        # Determine API endpoint and streaming format based on model
        if self._model.startswith("gpt-5"):
            # GPT-5 Responses API doesn't support streaming in the same way
            # Fall back to non-streaming for now
            try:
                result = await self.annotate(
                    title=title,
                    content=content,
                    audio_url=audio_url,
                    transcript=transcript,
                )
                # Simulate streaming by yielding the result in chunks
                content = result.content
                chunk_size = 10  # Characters per chunk
                for i in range(0, len(content), chunk_size):
                    chunk = content[i:i + chunk_size]
                    yield {"type": "content", "content": chunk}
                    # Small delay to simulate streaming
                    await asyncio.sleep(0.05)
                return
            except Exception as exc:
                raise NoteAnnotationError("Failed to get annotation") from exc
        else:
            endpoint = f"{self._base_url}/chat/completions"
            payload["stream"] = True

        async with httpx.AsyncClient(timeout=None) as client:
            try:
                async with client.stream(
                    "POST",
                    endpoint,
                    headers=headers,
                    json=payload,
                ) as response:
                    response.raise_for_status()

                    async for line in response.aiter_lines():
                        if not line:
                            continue
                        chunk = line
                        if chunk.startswith("data:"):
                            chunk = chunk[5:].strip()
                        else:
                            chunk = chunk.strip()
                        if not chunk:
                            continue
                        if chunk == "[DONE]":
                            break

                        try:
                            data = json.loads(chunk)
                            
                            if self._model.startswith("gpt-5"):
                                # Responses API format - handle streaming output
                                if "output" in data:
                                    output_items = data.get("output", [])
                                    for item in output_items:
                                        if item.get("type") == "reasoning":
                                            reasoning_delta = item.get("content", "")
                                            if reasoning_delta:
                                                yield {"type": "reasoning", "content": reasoning_delta}
                                        elif item.get("type") == "message":
                                            content_items = item.get("content", [])
                                            for content_item in content_items:
                                                if content_item.get("type") == "output_text":
                                                    output_delta = content_item.get("text", "")
                                                    if output_delta:
                                                        yield {"type": "content", "content": output_delta}
                            else:
                                # Chat Completions format
                                choice = data["choices"][0]
                                
                                # Handle reasoning steps
                                if "reasoning" in choice.get("delta", {}):
                                    reasoning_delta = choice["delta"]["reasoning"]
                                    if reasoning_delta:
                                        yield {"type": "reasoning", "content": reasoning_delta}
                                
                                # Handle content
                                delta = choice.get("delta", {}).get("content")
                                if delta:
                                    yield {"type": "content", "content": delta}
                                
                        except (json.JSONDecodeError, KeyError, IndexError, TypeError) as exc:
                            raise NoteAnnotationError(
                                "Unexpected response from annotation service"
                            ) from exc
            except httpx.HTTPError as exc:  # pragma: no cover - network errors not deterministic
                raise NoteAnnotationError("Failed to contact the annotation service") from exc


__all__ = ["AnnotationResult", "NoteAnnotator", "NoteAnnotationError"]

