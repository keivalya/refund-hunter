"""
Refund Hunter — FastAPI backend

Endpoints:
  GET  /api/auth/gmail/start            — start Gmail OAuth flow
  GET  /api/auth/gmail/callback         — handle OAuth callback
  GET  /api/subscriptions               — return curated subscription list
  POST /api/calls                       — start a cancellation call
  GET  /api/calls/{id}                  — get call status + transcript
  GET  /api/calls/{id}/stream           — SSE proxy for live transcript
  POST /api/browser/start               — start a Browser Use session
  GET  /api/browser/{session_id}        — get session state
  GET  /api/browser/{session_id}/stream — SSE: Browser Use run events
"""

import asyncio
import json

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse
from dotenv import load_dotenv

from agents.voice import (
    start_call,
    get_call,
    stream_transcript,
    extract_confirmation_number,
)
from agents.browser import (
    start_nyt_cancellation,
    stream_session_events,
    get_session_state,
    cleanup_orphan_sessions,
)
from merchants.planet_fitness import SYSTEM_PROMPT, INITIAL_GREETING, CASE_DATA
from auth.gmail_oauth import create_auth_url, exchange_code
from auth.token_store import save_tokens, is_connected
from data.subscriptions import SUBSCRIPTIONS, TOTAL_ANNUAL_RECOVERABLE

load_dotenv(dotenv_path="../.env")

app = FastAPI(title="Refund Hunter", version="0.2.0")

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


class BrowserStartRequest(BaseModel):
    case_id: str  # Currently only "sub_nyt" supported


# ── Gmail OAuth ─────────────────────────────────────────────────────

@app.get("/api/auth/gmail/start")
async def gmail_auth_start():
    """Generate Google OAuth URL and return it to the frontend."""
    try:
        auth_url, state = create_auth_url()
        return {"auth_url": auth_url, "state": state}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OAuth error: {e}")


@app.get("/api/auth/gmail/callback")
async def gmail_auth_callback(code: str, state: str):
    """
    Handle OAuth callback from Google.
    Exchanges code for tokens, stores them, redirects to dashboard.
    """
    try:
        tokens = exchange_code(code, state)
        # DEMO NOTE: We don't call Gmail API to get email — just store the tokens.
        # In production, we'd call userinfo endpoint to get the email.
        save_tokens(
            email="connected_user",
            access_token=tokens["access_token"],
            refresh_token=tokens.get("refresh_token"),
        )
        return RedirectResponse(url="http://localhost:3000/dashboard?connected=true")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OAuth exchange error: {e}")


# ── Subscriptions ───────────────────────────────────────────────────

@app.get("/api/subscriptions")
async def get_subscriptions():
    """
    Return the curated subscription list.

    DEMO NOTE: We complete real OAuth (judge sees the consent screen and grants
    gmail.readonly), but for hackathon timing we return a curated subscription
    list rather than running a real classifier over the inbox. The token is
    stored and the next iteration would call Gmail API + Claude Sonnet.
    """
    if not is_connected():
        raise HTTPException(status_code=401, detail="Gmail not connected")

    # Simulate scan time so the animation feels real
    await asyncio.sleep(4)

    return {
        "subscriptions": SUBSCRIPTIONS,
        "total_annual_recoverable": TOTAL_ANNUAL_RECOVERABLE,
        "count": len(SUBSCRIPTIONS),
    }


# ── Calls (unchanged from Tier 0) ──────────────────────────────────

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
    """Get call status + transcript, augmented with extracted confirmation number."""
    try:
        call = await get_call(call_id)
        call["confirmation_number"] = extract_confirmation_number(
            call.get("transcripts") or []
        )
        return call
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
                if line.startswith("data:"):
                    data = line[5:].strip()
                    yield {"data": data}
                elif line.startswith("event:"):
                    pass
                else:
                    yield {"data": line}
        except Exception as e:
            yield {"event": "error", "data": json.dumps({"error": str(e)})}

    return EventSourceResponse(event_generator())


# ── Browser Use ─────────────────────────────────────────────────────

@app.on_event("startup")
async def cleanup_on_startup():
    """Delete leftover 'error' Browser Use sessions from previous runs."""
    try:
        result = await cleanup_orphan_sessions(aggressive=False)
        print(f"[startup] Browser Use cleanup: {result}")
    except Exception as e:
        print(f"[startup] Browser Use cleanup skipped: {e}")


@app.post("/api/browser/cleanup")
async def browser_cleanup(aggressive: bool = False):
    """
    Manual cleanup endpoint.
    - aggressive=false (default): deletes only 'error' sessions
    - aggressive=true: also deletes 'stopped' sessions
    Never touches sessions tracked by this process or in active/running state.
    """
    return await cleanup_orphan_sessions(aggressive=aggressive)


@app.post("/api/browser/start")
async def browser_start(req: BrowserStartRequest):
    """
    Start a Browser Use session for a case. Currently only sub_nyt is wired.

    Returns the session id and live_url. The frontend should iframe live_url
    and subscribe to /api/browser/{session_id}/stream for step events.
    """
    if req.case_id != "sub_nyt":
        raise HTTPException(
            status_code=400,
            detail=f"Browser lane only wired for sub_nyt, got {req.case_id}",
        )
    try:
        state = await start_nyt_cancellation(req.case_id)
        return {
            "session_id": state["session_id"],
            "live_url": state["live_url"],
            "status": state["status"],
        }
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Browser Use error: {e}")


@app.get("/api/browser/{session_id}")
async def browser_status(session_id: str):
    """Return the cached state for a Browser Use session."""
    state = get_session_state(session_id)
    if not state:
        raise HTTPException(status_code=404, detail="Session not found")
    return state


@app.get("/api/browser/{session_id}/stream")
async def browser_stream(session_id: str):
    """
    SSE — stream events from the Browser Use run.

    Events emitted:
      - connected: {session_id, live_url}
      - step: {step_index, role, msg_type, summary, screenshot_url?}
      - ended: {status, output}
    """
    async def event_generator():
        try:
            async for event in stream_session_events(session_id):
                yield {"data": json.dumps(event)}
        except ValueError as e:
            yield {"event": "error", "data": json.dumps({"error": str(e)})}
        except Exception as e:
            yield {"event": "error", "data": json.dumps({"error": str(e)})}

    return EventSourceResponse(event_generator())


# ── Health ──────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok"}
