"""
Browser Use Cloud SDK integration.

DEMO NOTE: Single-user, single-task at a time for hackathon scope. NYT task
is deliberately non-destructive — we navigate the cancellation flow to
demonstrate capability but stop at the chat-handoff moment without
completing an actual cancellation.

Architecture:
  - start_nyt_cancellation()  : create keep_alive session, return live_url
  - stream_session_events()   : yield dict events from the Browser Use run
  - get_session_state()       : in-memory state lookup for /api/browser/{id}
  - stop_session()            : explicit stop (cleanup)
"""

import os
from typing import AsyncIterator

from browser_use_sdk.v3 import AsyncBrowserUse


# In-memory session state cache. Single-user demo; resets on backend restart.
_sessions: dict[str, dict] = {}


# Verbatim NYT task prompt (per spec). Stops at chat handoff — does NOT
# actually cancel anything. The demo ends at the "dark pattern defeated"
# moment, not at real cancellation.
NYT_TASK = """\
Navigate to nytimes.com. Find the link to cancel a subscription, typically \
under Help > Account > Cancel Subscription, or via the subscription \
management page at myaccount.nytimes.com.

Do not log in. Do not enter any personal information. Do not complete a \
cancellation.

Your goal is to navigate the cancellation flow up to the point where it \
requires speaking with a representative via chat. Open that chat widget. \
Type "I would like to cancel my subscription effective immediately" into \
the chat. Then stop and report success.

If asked to log in, stop and report "login required — human handoff."
If the cancel flow is fully self-serve, stop at the confirmation page and \
report "self-serve flow reached."

Take screenshots at each major step.\
"""


def _client() -> AsyncBrowserUse:
    if "BROWSER_USE_API_KEY" not in os.environ:
        raise RuntimeError("BROWSER_USE_API_KEY missing from environment")
    return AsyncBrowserUse()


async def start_nyt_cancellation(case_id: str) -> dict:
    """Create a keep-alive Browser Use session for the NYT cancel-flow demo."""
    client = _client()
    session = await client.sessions.create(keep_alive=True)
    sid = str(session.id)  # SDK returns UUID; dict keys must be str for path-param lookups
    state = {
        "session_id": sid,
        "live_url": session.live_url,
        "case_id": case_id,
        "status": "initiated",
        "task": NYT_TASK,
        "messages": [],
        "output": None,
    }
    _sessions[sid] = state
    return state


async def stream_session_events(session_id: str) -> AsyncIterator[dict]:
    """
    Stream events from a Browser Use run for the given session.
    Yields dicts that can be JSON-serialized as SSE payloads.

    Event shapes:
      {"type": "connected", "session_id", "live_url"}
      {"type": "step", "step_index", "role", "msg_type", "summary", "screenshot_url"?}
      {"type": "ended", "status", "output"}
    """
    state = _sessions.get(session_id)
    if not state:
        raise ValueError(f"Unknown session: {session_id}")

    client = _client()

    # Connected event includes live_url so the frontend can iframe immediately
    yield {
        "type": "connected",
        "session_id": session_id,
        "live_url": state["live_url"],
    }

    state["status"] = "running"
    run = client.run(state["task"], session_id=session_id)

    try:
        step_index = 0
        async for msg in run:
            step_index += 1
            event: dict = {
                "type": "step",
                "step_index": step_index,
                "role": msg.role,
                "msg_type": msg.type,
                "summary": (msg.summary or "")[:500],
            }
            screenshot = getattr(msg, "screenshot_url", None)
            if screenshot:
                event["screenshot_url"] = screenshot
            state["messages"].append(event)
            yield event

        # Fetch final state once the run completes
        final = await client.sessions.get(session_id)
        final_status_raw = getattr(final, "status", None)
        final_status = (
            final_status_raw.value
            if hasattr(final_status_raw, "value")
            else str(final_status_raw)
        )
        output = getattr(final, "output", None)
        state["status"] = "completed"
        state["output"] = str(output) if output else None

        yield {
            "type": "ended",
            "status": final_status,
            "output": state["output"],
        }
    finally:
        # Always stop the session — keep_alive=True keeps the browser running
        # past the task completion, which shows as "Active but Succeeded" on
        # the Browser Use dashboard. Stopping shuts it down and saves cost.
        try:
            await client.sessions.stop(session_id)
        except Exception:
            pass


def get_session_state(session_id: str) -> dict | None:
    return _sessions.get(session_id)


async def stop_session(session_id: str) -> None:
    client = _client()
    try:
        await client.sessions.stop(session_id)
    except Exception:
        # Swallow — stop is a cleanup, not load-bearing
        pass
    state = _sessions.get(session_id)
    if state:
        state["status"] = "stopped"


async def cleanup_orphan_sessions(
    aggressive: bool = False,
) -> dict:
    """
    Delete leftover Browser Use sessions that aren't tracked by this process.

    - Conservative (default): deletes only sessions in 'error' status (these
      are dead). Safe to call on startup.
    - Aggressive: also deletes 'stopped' sessions. Use only via the explicit
      cleanup endpoint — never on startup, since prior 'stopped' sessions may
      have legitimate output the user wants to review.

    Never touches sessions in the local _sessions cache (the running app's
    own sessions) regardless of mode.
    """
    client = _client()
    try:
        result = await client.sessions.list()
    except Exception as e:
        return {"deleted": 0, "error": str(e)}

    target_statuses = {"error"}
    if aggressive:
        target_statuses.add("stopped")

    deleted = 0
    skipped_active = 0
    for s in result.sessions:
        sid = str(s.id)
        if sid in _sessions:
            continue  # tracked by this process — leave alone
        status_val = s.status.value if hasattr(s.status, "value") else str(s.status)
        if status_val not in target_statuses:
            skipped_active += 1
            continue
        try:
            await client.sessions.delete(sid)
            deleted += 1
        except Exception:
            pass

    return {"deleted": deleted, "skipped_active_or_tracked": skipped_active}
