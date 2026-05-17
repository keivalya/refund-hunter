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
  POST /api/email/start                 — send a cancellation email
  GET  /api/email/{thread_id}           — get thread state
  GET  /api/email/{thread_id}/stream    — SSE: email lifecycle events
  GET  /api/insights                    — playbooks for all demo merchants
  GET  /api/insights/{merchant_id}      — playbook for a single merchant
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
from agents.email import (
    provision_inboxes,
    send_cancellation_email,
    get_thread_state,
    stream_thread_events,
)
from agents import merchant_inbox
from agents.memory import (
    get_merchant_playbook,
    render_playbook_section,
    seed_memories_if_missing,
    write_memory,
    extract_retention_from_transcript,
)
from data.memory_seeds import ALL_SEEDS

# Track call IDs we've already ingested into Supermemory (avoid duplicates
# when /api/calls/{id} is polled multiple times after completion).
_ingested_voice_call_ids: set[str] = set()


async def _ingest_voice_call_if_new(call: dict) -> None:
    """Write a Supermemory entry for a completed voice call. Idempotent."""
    import asyncio
    call_id = str(call.get("id") or "")
    if not call_id or call_id in _ingested_voice_call_ids:
        return
    _ingested_voice_call_ids.add(call_id)

    transcripts = call.get("transcripts") or []
    full_text = " ".join(
        (t.get("response") or "") + " " + (t.get("transcript") or "")
        for t in transcripts
    )
    retention = extract_retention_from_transcript(full_text)
    confirmation = call.get("confirmation_number")
    duration = call.get("durationSeconds")
    ended_at = call.get("endedAt")

    summary_parts = [f"Cancellation call to Planet Fitness."]
    if duration:
        summary_parts.append(f"Duration {duration}s.")
    if retention:
        summary_parts.append(f"Retention offered (extracted from transcript): {retention}.")
    else:
        summary_parts.append("No explicit retention offer detected in transcript.")
    if confirmation:
        summary_parts.append(f"Confirmation number captured: {confirmation}.")
    else:
        summary_parts.append("Confirmation number not captured verbally.")
    content = " ".join(summary_parts)

    metadata: dict = {
        "channel": "voice",
        "outcome": "cancelled" if confirmation else "completed_no_confirmation",
        "duration_seconds": duration,
        "timestamp": ended_at,
        "seed": False,
        "call_id": call_id,
    }
    if retention:
        metadata["retention_offered"] = retention
    if confirmation:
        metadata["confirmation_number"] = confirmation

    try:
        await asyncio.to_thread(
            write_memory,
            merchant_id="planet_fitness",
            content=content,
            metadata=metadata,
            custom_id=f"call_{call_id}",
        )
        print(f"[memory] ingested voice call {call_id} retention={retention}", flush=True)
    except Exception as e:
        # Don't fail the API request if memory write fails.
        print(f"[memory] voice ingest failed for {call_id}: {e}", flush=True)
        _ingested_voice_call_ids.discard(call_id)
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


class EmailStartRequest(BaseModel):
    case_id: str  # Currently only "sub_la_fitness" supported


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

    Tier 2b: the system prompt is dynamically enriched with patterns from
    prior Planet Fitness calls (via Supermemory). Failure to enrich falls
    back to the hardcoded prompt — voice flow never breaks.
    """
    # Pull merchant playbook from Supermemory and append to system prompt.
    # render_playbook_section returns "" if no memories or any error, so
    # this can never fail the voice call.
    try:
        playbook = get_merchant_playbook("planet_fitness")
        enrichment = render_playbook_section(playbook)
    except Exception as e:
        print(f"[main] playbook enrichment skipped: {e}", flush=True)
        enrichment = ""

    enriched_prompt = SYSTEM_PROMPT + enrichment

    try:
        result = await start_call(
            to_number=req.phone_number,
            system_prompt=enriched_prompt,
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
        # Tier 2b: ingest a Supermemory entry for completed calls (idempotent
        # via _ingested_voice_call_ids). Failures don't affect the response.
        if call.get("status") == "completed":
            await _ingest_voice_call_if_new(call)
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


@app.on_event("startup")
async def provision_email_inboxes_on_startup():
    """Idempotent provisioning of agent + merchant AgentMail inboxes."""
    try:
        result = provision_inboxes()
        print(f"[startup] AgentMail inboxes provisioned: {result}")
    except Exception as e:
        print(f"[startup] AgentMail provisioning skipped: {e}")


@app.on_event("startup")
async def start_merchant_auto_responder():
    """
    DEMO-ONLY: spawn the merchant inbox auto-responder background task.
    In production this hook would be deleted along with merchant_inbox.py.
    """
    try:
        await merchant_inbox.start()
    except Exception as e:
        print(f"[startup] merchant auto-responder failed to start: {e}")


@app.on_event("shutdown")
async def stop_merchant_auto_responder():
    try:
        await merchant_inbox.stop()
    except Exception as e:
        print(f"[shutdown] merchant auto-responder stop error: {e}")


@app.on_event("startup")
async def seed_supermemory_on_startup():
    """Idempotently load fabricated prior-call memories into Supermemory."""
    try:
        result = seed_memories_if_missing()
        print(f"[startup] Supermemory seed: {result}", flush=True)
    except Exception as e:
        print(f"[startup] Supermemory seeding skipped: {e}", flush=True)


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


# ── Email (AgentMail) ───────────────────────────────────────────────

@app.post("/api/email/start")
async def email_start(req: EmailStartRequest):
    """
    Send a cancellation email from the agent inbox to the merchant inbox.

    Currently only sub_la_fitness is wired. Returns thread state with
    sent message preview.
    """
    try:
        state = send_cancellation_email(req.case_id)
        return state
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AgentMail error: {e}")


@app.get("/api/email/{thread_id}")
async def email_thread_state(thread_id: str):
    """Return cached thread state for a sent email."""
    state = get_thread_state(thread_id)
    if not state:
        raise HTTPException(status_code=404, detail="Thread not found")
    return state


@app.get("/api/email/{thread_id}/stream")
async def email_thread_stream(thread_id: str):
    """
    SSE — stream events for the email thread lifecycle.

    Events:
      - sent       (initial; outbound message preview)
      - polling    (heartbeat while waiting for reply)
      - received   (reply landed; inbound message preview)
      - confirmed  (confirmation number extracted from reply body)
      - timeout    (no reply within STREAM_TIMEOUT_SEC)
    """
    async def event_generator():
        try:
            async for event in stream_thread_events(thread_id):
                yield {"data": json.dumps(event)}
        except Exception as e:
            yield {"event": "error", "data": json.dumps({"error": str(e)})}

    return EventSourceResponse(event_generator())


# ── Insights (Supermemory-backed) ───────────────────────────────────

@app.get("/api/insights")
async def insights_all():
    """Return playbooks for all demo merchants, keyed by merchant_id."""
    out: dict[str, dict] = {}
    for merchant_id in ALL_SEEDS.keys():
        out[merchant_id] = get_merchant_playbook(merchant_id)
    return out


@app.get("/api/insights/{merchant_id}")
async def insights_one(merchant_id: str):
    """Return the playbook for a single merchant."""
    return get_merchant_playbook(merchant_id)


# ── Health ──────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok"}
