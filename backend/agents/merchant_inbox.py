"""
Scripted "LA Fitness support" auto-responder.

DEMO-ONLY infrastructure. This file would NOT exist in production —
the real LA Fitness support team would reply on their own schedule
(typically 5+ business days). For hackathon demo timing we host the
merchant inbox ourselves and auto-reply within ~8 seconds.

What this does:
  - Background asyncio task started from main.py's startup hook
  - Polls the merchant inbox every 2s (POLL_INTERVAL_SEC)
  - For each new message with "Cancellation Request" in subject:
      1. Mark it as "handling" immediately (dedupe)
      2. Wait 8s (REALISM_DELAY_SEC) so the demo feels human
      3. Send the templated confirmation reply via inboxes.messages.reply
         which preserves the AgentMail thread
  - On startup, pre-marks all EXISTING messages as already-handled
    so we don't spam replies to test messages from previous runs

In production this file gets deleted, and the agent_inbox keeps polling
the real merchant's email server for their reply.
"""

import asyncio
import os
from typing import Optional

from agentmail import AgentMail

from agents.email_templates import INBOUND_TEXT, INBOUND_SUBJECT


MERCHANT_INBOX_ID = "lafitness-demo-keivalya@agentmail.to"
POLL_INTERVAL_SEC = 2
REALISM_DELAY_SEC = 8
SUBJECT_MATCH = "Cancellation Request"


# Message IDs we've already replied to (or are in the process of replying to).
# Set on startup to existing inbox contents so we don't re-reply to old test
# messages from prior runs.
_handled_ids: set[str] = set()

# DEMO-ONLY: record of replies the auto-responder has sent, keyed by the
# SOURCE message id (the one we replied to). Used by email.py SSE stream
# as a reliable fallback when AgentMail/SES intra-org delivery is slow.
# In production, this dict and the function below are DELETED along with
# the rest of this file.
_sent_replies: dict[str, dict] = {}


def get_replied_to(source_message_id: str) -> Optional[dict]:
    """DEMO-ONLY: lookup what we replied to a given source message."""
    return _sent_replies.get(source_message_id)


# Reference to the background task so we can cancel it cleanly.
_task: Optional[asyncio.Task] = None


def _client() -> AgentMail:
    if "AGENTMAIL_API_KEY" not in os.environ:
        raise RuntimeError("AGENTMAIL_API_KEY missing from environment")
    return AgentMail(api_key=os.environ["AGENTMAIL_API_KEY"])


def _message_id(m) -> str:
    return str(getattr(m, "message_id", None) or getattr(m, "id", None))


async def _list_recent_messages(limit: int = 10) -> list:
    """Async-safe wrapper around the sync list call."""
    client = _client()
    return await asyncio.to_thread(
        lambda: client.inboxes.messages.list(
            inbox_id=MERCHANT_INBOX_ID,
            limit=limit,
            ascending=False,  # newest first
        )
    )


async def _send_reply(message_id: str) -> None:
    """Send the templated cancellation confirmation reply."""
    from datetime import datetime, timezone

    client = _client()
    resp = await asyncio.to_thread(
        lambda: client.inboxes.messages.reply(
            inbox_id=MERCHANT_INBOX_ID,
            message_id=message_id,
            text=INBOUND_TEXT,
        )
    )
    # DEMO-ONLY: record the reply so email.py's SSE stream can fall back
    # to this when intra-org SES delivery is slow.
    _sent_replies[message_id] = {
        "from": MERCHANT_INBOX_ID,
        "subject": INBOUND_SUBJECT,
        "body": INBOUND_TEXT,
        "sent_at": datetime.now(timezone.utc).isoformat(),
        "reply_message_id": str(getattr(resp, "message_id", "") or ""),
    }


async def _delayed_reply(message_id: str) -> None:
    """Wait for the realism delay, then send the templated confirmation."""
    try:
        await asyncio.sleep(REALISM_DELAY_SEC)
        await _send_reply(message_id)
        print(f"[merchant_inbox] auto-replied to {message_id}", flush=True)
    except Exception as e:
        print(f"[merchant_inbox] reply failed for {message_id}: {e}", flush=True)
        # Allow retry on next poll if reply fails
        _handled_ids.discard(message_id)


_poll_count = 0


async def _check_inbox_once() -> None:
    """Single poll iteration: find unhandled inbound cancellation requests, reply."""
    global _poll_count
    _poll_count += 1
    try:
        page = await _list_recent_messages(limit=10)
    except Exception as e:
        print(f"[merchant_inbox] poll #{_poll_count} list failed: {e}", flush=True)
        return

    items = getattr(page, "messages", None) or getattr(page, "items", None) or []
    if _poll_count <= 3 or _poll_count % 30 == 0:
        print(f"[merchant_inbox] poll #{_poll_count}: seeing {len(items)} msgs; handled cache has {len(_handled_ids)}", flush=True)

    for m in items:
        msg_id = _message_id(m)
        if not msg_id or msg_id in _handled_ids:
            continue

        # AgentMail's list returns BOTH sent and received messages in the
        # inbox view. We only want to reply to RECEIVED messages — skip
        # 'sent' label (our own outgoing replies) to avoid infinite loop.
        labels = getattr(m, "labels", None) or []
        if "sent" in labels and "received" not in labels:
            _handled_ids.add(msg_id)  # mark so we don't recheck every poll
            continue

        subject = getattr(m, "subject", "") or ""
        if SUBJECT_MATCH not in subject:
            continue
        # Mark immediately so the next 2s tick doesn't double-spawn
        _handled_ids.add(msg_id)
        print(f"[merchant_inbox] handling {msg_id} labels={labels} subject={subject!r}", flush=True)
        asyncio.create_task(_delayed_reply(msg_id))


async def _auto_responder_loop() -> None:
    """Forever-loop: poll inbox every POLL_INTERVAL_SEC."""
    while True:
        try:
            await _check_inbox_once()
        except asyncio.CancelledError:
            raise
        except Exception as e:
            print(f"[merchant_inbox] loop error: {e}")
        await asyncio.sleep(POLL_INTERVAL_SEC)


async def _seed_existing_ids() -> None:
    """On startup, mark all existing inbox contents as already-handled."""
    try:
        page = await _list_recent_messages(limit=50)
    except Exception as e:
        print(f"[merchant_inbox] seed failed (continuing anyway): {e}")
        return

    items = getattr(page, "messages", None) or getattr(page, "items", None) or []
    seeded = 0
    for m in items:
        msg_id = _message_id(m)
        if msg_id:
            _handled_ids.add(msg_id)
            seeded += 1
    print(f"[merchant_inbox] seeded {seeded} existing message ids (will not reply to these)")


async def start() -> None:
    """
    Entry point for FastAPI startup hook. Seeds existing IDs, then spawns
    the background polling task. Idempotent — safe to call multiple times.
    """
    global _task
    if _task and not _task.done():
        return  # already running

    await _seed_existing_ids()
    _task = asyncio.create_task(_auto_responder_loop())
    print(f"[merchant_inbox] auto-responder running (poll every {POLL_INTERVAL_SEC}s)")


async def stop() -> None:
    """Cancel the background task (used during shutdown)."""
    global _task
    if _task and not _task.done():
        _task.cancel()
        try:
            await _task
        except asyncio.CancelledError:
            pass
    _task = None
