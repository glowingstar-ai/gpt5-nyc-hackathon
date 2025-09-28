"""Vision analysis service for processing screenshots and providing context to realtime conversations."""

from __future__ import annotations

import base64
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import httpx


class VisionAnalysisError(RuntimeError):
    """Raised when vision analysis fails."""


@dataclass(slots=True)
class HighlightInstruction:
    """Instruction for the frontend to highlight a DOM node."""

    selector: str
    action: str
    reason: str | None = None
    script: str | None = None


@dataclass(slots=True)
class VisionContext:
    """Structured visual context extracted from a screenshot."""

    description: str
    key_elements: list[str]
    user_intent: str | None
    actionable_items: list[str]
    timestamp: datetime
    source: str
    image_base64: str
    captured_at: datetime | None
    dom_snapshot: str | None
    dom_summary: str | None
    highlight_instructions: list[HighlightInstruction]


class VisionAnalyzer:
    """Service for analyzing screenshots and extracting meaningful context."""
    
    def __init__(
        self,
        *,
        api_key: str,
        base_url: str = "https://api.openai.com/v1",
        model: str = "gpt-5.0",
        timeout: float = 30.0,
    ) -> None:
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout
    
    async def analyze_screenshot(
        self,
        image_base64: str,
        source: str = "ui",
        captured_at: datetime | None = None,
        dom_snapshot: str | None = None,
    ) -> VisionContext:
        """Analyze a screenshot and extract meaningful context for conversation."""
        
        if captured_at is None:
            captured_at = datetime.now(timezone.utc)
        
        try:
            # Validate base64
            base64.b64decode(image_base64, validate=True)
        except Exception as exc:
            raise VisionAnalysisError("Invalid base64-encoded image") from exc
        
        prompt = self._build_analysis_prompt(source, dom_snapshot)

        payload = {
            "model": self.model,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": prompt,
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{image_base64}",
                                "detail": "high",
                            },
                        },
                    ],
                }
            ],
            "max_tokens": 1000,
            "temperature": 0.3,
        }
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=headers,
                    json=payload,
                )
                response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise VisionAnalysisError(f"Vision API request failed: {exc.response.status_code}") from exc
        except httpx.TimeoutException as exc:
            raise VisionAnalysisError("Vision analysis timed out") from exc
        
        try:
            data = response.json()
            content = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError) as exc:
            raise VisionAnalysisError("Invalid response from vision API") from exc
        
        return self._parse_analysis_response(
            content,
            timestamp=captured_at,
            source=source,
            image_base64=image_base64,
            dom_snapshot=dom_snapshot,
        )

    def _build_analysis_prompt(self, source: str, dom_snapshot: str | None) -> str:
        """Build the analysis prompt based on the source type."""

        dom_context = ""
        if dom_snapshot:
            # Truncate excessively large DOM payloads to keep the prompt manageable
            trimmed = dom_snapshot[:6000]
            if len(dom_snapshot) > 6000:
                trimmed += "\n... [truncated]"
            dom_context = (
                "\n\nDOM digest (JSON with CSS selectors and text content):\n" + trimmed
            )

        if source == "ui":
            return (
                """Analyze this UI screenshot and the provided DOM digest. Respond with valid JSON in the following format:

{
  "description": "A clear, concise description of what's visible in the screenshot",
  "key_elements": ["List of important UI elements, text, buttons, or components visible"],
  "user_intent": "What the user might be trying to accomplish based on the UI state",
  "actionable_items": ["Specific actions or items the user could interact with"],
  "dom_summary": "Short summary of relevant DOM details",
  "highlights": [
    {
      "selector": "Exact CSS selector from the DOM digest to highlight",
      "action": "highlight",
      "reason": "Why this element is relevant to the user's request",
      "script": "Optional JavaScript snippet that safely enhances the highlight (e.g. scrolling into view)"
    }
  ]
}

Focus on:
- What application or website is being used
- Current state or context of the interface
- Any text, forms, or interactive elements
- What the user might be working on or trying to achieve
- Any errors, notifications, or important information displayed

Be specific and actionable. If this appears to be a development environment, note any code, errors, or development tools visible.

Use selectors exactly as they appear in the DOM digest. Provide at most five highlight instructions prioritizing the most relevant UI elements. Only include the optional "script" field when simple highlighting is insufficient and keep scripts short and safe for execution in the browser."""
                + dom_context
            )

        else:  # camera
            return """Analyze this camera image and provide a structured analysis in the following JSON format:

{
  "description": "A clear, concise description of what's visible in the image",
  "key_elements": ["List of important objects, people, text, or scenes visible"],
  "user_intent": "What the user might be trying to show or accomplish",
  "actionable_items": ["Specific things the user could interact with or discuss"]
}

Focus on:
- The main subject or scene
- Any text, documents, or screens visible
- The user's environment or workspace
- Objects or tools that might be relevant to their current task
- Any specific details that could be helpful for conversation context"""
    
    def _parse_analysis_response(
        self,
        content: str,
        *,
        timestamp: datetime,
        source: str,
        image_base64: str,
        dom_snapshot: str | None,
    ) -> VisionContext:
        """Parse the analysis response into a structured VisionContext."""

        try:
            import json
            
            # Try to extract JSON from the response
            start_idx = content.find("{")
            end_idx = content.rfind("}") + 1
            
            if start_idx == -1 or end_idx == 0:
                raise ValueError("No JSON found in response")
            
            json_str = content[start_idx:end_idx]
            data = json.loads(json_str)
            
            highlights_raw = data.get("highlights", [])
            highlight_instructions: list[HighlightInstruction] = []
            if isinstance(highlights_raw, list):
                for item in highlights_raw:
                    if not isinstance(item, dict):
                        continue
                    selector = item.get("selector")
                    action = item.get("action", "highlight")
                    reason = item.get("reason")
                    script = item.get("script")
                    if isinstance(selector, str) and selector.strip():
                        highlight_instructions.append(
                            HighlightInstruction(
                                selector=selector.strip(),
                                action=str(action) if isinstance(action, str) else "highlight",
                                reason=reason.strip() if isinstance(reason, str) else None,
                                script=script.strip() if isinstance(script, str) and script.strip() else None,
                            )
                        )

            return VisionContext(
                description=data.get("description", "Screenshot analysis"),
                key_elements=data.get("key_elements", []),
                user_intent=data.get("user_intent"),
                actionable_items=data.get("actionable_items", []),
                timestamp=timestamp,
                source=source,
                image_base64=image_base64,
                captured_at=timestamp,
                dom_snapshot=dom_snapshot,
                dom_summary=data.get("dom_summary"),
                highlight_instructions=highlight_instructions,
            )

        except (json.JSONDecodeError, ValueError, KeyError) as exc:
            # Fallback to simple text parsing if JSON parsing fails
            return VisionContext(
                description=content[:200] + "..." if len(content) > 200 else content,
                key_elements=[],
                user_intent=None,
                actionable_items=[],
                timestamp=timestamp,
                source=source,
                image_base64=image_base64,
                captured_at=timestamp,
                dom_snapshot=dom_snapshot,
                dom_summary=None,
                highlight_instructions=[],
            )
