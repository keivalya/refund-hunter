"""
AgentPhone voice integration.

Uses AgentPhone's hosted mode — their built-in LLM handles the conversation,
guided by our systemPrompt. We just initiate calls and stream transcripts.

Key endpoints used:
  POST /v1/calls                          — start an outbound call
  GET  /v1/calls/{call_id}                — get call status + transcript
  GET  /v1/calls/{call_id}/transcript/stream — SSE live transcript
"""

import os
import re
import httpx

AGENTPHONE_BASE = "https://api.agentphone.ai"

# Regex patterns ordered from most specific to least. First match wins.
_CONFIRMATION_PATTERNS = [
    re.compile(
        r"confirmation\s+(?:number|#|code)\s*(?:is\s+)?[:\-]?\s*([A-Z0-9][A-Z0-9\-]{4,})",
        re.IGNORECASE,
    ),
    re.compile(
        r"reference\s+(?:number|#|code)\s*(?:is\s+)?[:\-]?\s*([A-Z0-9][A-Z0-9\-]{4,})",
        re.IGNORECASE,
    ),
    re.compile(
        r"cancellation\s+(?:number|#)\s*(?:is\s+)?[:\-]?\s*([A-Z0-9][A-Z0-9\-]{4,})",
        re.IGNORECASE,
    ),
]


def extract_confirmation_number(transcripts: list[dict]) -> str | None:
    """Scan transcript turns for a confirmation number using regex patterns."""
    text_parts: list[str] = []
    for turn in transcripts:
        if turn.get("transcript"):
            text_parts.append(turn["transcript"])
        if turn.get("response"):
            text_parts.append(turn["response"])
    full_text = " ".join(text_parts)

    for pattern in _CONFIRMATION_PATTERNS:
        match = pattern.search(full_text)
        if match:
            return match.group(1).upper()
    return None


def _headers() -> dict:
    api_key = os.environ["AGENTPHONE_API_KEY"]
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }


async def start_call(
    to_number: str,
    system_prompt: str,
    initial_greeting: str,
    agent_id: str | None = None,
    model_tier: str = "max",
) -> dict:
    """Initiate an outbound call via AgentPhone hosted mode."""
    agent_id = agent_id or os.environ["AGENTPHONE_AGENT_ID"]

    payload = {
        "agentId": agent_id,
        "toNumber": to_number,
        "systemPrompt": system_prompt,
        "initialGreeting": initial_greeting,
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{AGENTPHONE_BASE}/v1/calls",
            headers=_headers(),
            json=payload,
        )
        resp.raise_for_status()
        return resp.json()


async def get_call(call_id: str) -> dict:
    """Get call status and full transcript."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{AGENTPHONE_BASE}/v1/calls/{call_id}",
            headers=_headers(),
        )
        resp.raise_for_status()
        return resp.json()


async def stream_transcript(call_id: str):
    """
    Yield SSE events from AgentPhone's live transcript stream.

    Events:
      - connected: call metadata
      - turn: {role, content, timestamp}
      - ended: {duration, status}
    """
    api_key = os.environ["AGENTPHONE_API_KEY"]
    url = f"{AGENTPHONE_BASE}/v1/calls/{call_id}/transcript/stream"

    async with httpx.AsyncClient(timeout=httpx.Timeout(None)) as client:
        async with client.stream(
            "GET",
            url,
            headers={"Authorization": f"Bearer {api_key}"},
        ) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if line.strip():
                    yield line
