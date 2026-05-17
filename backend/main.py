"""
Refund Hunter — FastAPI backend (Tier 0)

Three endpoints:
  POST /api/calls          — start a cancellation call
  GET  /api/calls/{id}     — get call status + transcript
  GET  /api/calls/{id}/stream — SSE proxy for live transcript
"""

import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse
from dotenv import load_dotenv

from agents.voice import start_call, get_call, stream_transcript
from merchants.planet_fitness import SYSTEM_PROMPT, INITIAL_GREETING, CASE_DATA

load_dotenv(dotenv_path="../.env")

app = FastAPI(title="Refund Hunter", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Models ──────────────────────────────────────────────────────────

class CallRequest(BaseModel):
    phone_number: str  # E.164 format, the merchant's number to dial


class CallResponse(BaseModel):
    call_id: str
    status: str
    from_number: str
    to_number: str


# ── Endpoints ───────────────────────────────────────────────────────

@app.get("/api/case")
async def get_case():
    """Return the hardcoded Planet Fitness case for Tier 0."""
    return CASE_DATA


@app.post("/api/calls", response_model=CallResponse)
async def create_call(req: CallRequest):
    """
    Initiate a cancellation call via AgentPhone.

    The agent uses hosted mode — AgentPhone's built-in LLM drives the
    conversation using our Planet Fitness system prompt.
    """
    try:
        result = await start_call(
            to_number=req.phone_number,
            system_prompt=SYSTEM_PROMPT,
            initial_greeting=INITIAL_GREETING,
        )
        return CallResponse(
            call_id=result["id"],
            status=result["status"],
            from_number=result["fromNumber"],
            to_number=result["toNumber"],
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AgentPhone error: {e}")


@app.get("/api/calls/{call_id}")
async def get_call_status(call_id: str):
    """Get call status and full transcript."""
    try:
        return await get_call(call_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AgentPhone error: {e}")


@app.get("/api/calls/{call_id}/stream")
async def stream_call_transcript(call_id: str):
    """
    SSE proxy — relays AgentPhone's live transcript stream to the frontend.

    Events forwarded:
      - connected: call metadata
      - turn: {role, content, timestamp}
      - ended: {duration, status}
    """
    async def event_generator():
        try:
            async for line in stream_transcript(call_id):
                # AgentPhone sends SSE-formatted lines (data: {...})
                # Forward them as-is
                if line.startswith("data:"):
                    data = line[5:].strip()
                    yield {"data": data}
                elif line.startswith("event:"):
                    # Store event type for next data line
                    pass
                else:
                    yield {"data": line}
        except Exception as e:
            yield {"event": "error", "data": json.dumps({"error": str(e)})}

    return EventSourceResponse(event_generator())


# ── Health ──────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok"}
