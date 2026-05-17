"""
AgentMail integration for the email cancellation lane.

DEMO NOTE: AgentMail integration with self-hosted merchant inbox.

In production: the agent inbox sends to merchant's real support email
(e.g. support@lafitness.com). For the hackathon demo we host both sides
so the merchant's auto-reply lands in ~8 seconds instead of 5 business
days. The agent-side logic — send, poll, parse, confirm — is identical
to production. Only the recipient address differs.

The auto-responder lives in merchant_inbox.py and would be DELETED in
production.

Architecture:
  - provision_inboxes()         : idempotent startup; ensure both inboxes
  - send_cancellation_email()   : send from agent → merchant, return thread
  - get_thread_state()          : in-memory cache lookup
  - poll_agent_inbox()          : check for replies to a thread
  - parse_confirmation_number() : regex extraction from reply body
"""

import asyncio
import os
import re
import time
from datetime import datetime, timezone
from typing import AsyncIterator

from agentmail import AgentMail

from agents.email_templates import (
    LA_FITNESS_CASE,
    OUTBOUND_SUBJECT,
    OUTBOUND_TEXT,
)


# ── Module state (single-user demo) ─────────────────────────────────

# Hardcoded inbox usernames. The agent and merchant inboxes are both
# hosted by us on agentmail.to for demo timing.
AGENT_INBOX_USERNAME = "refund-agent-keivalya"
MERCHANT_INBOX_USERNAME = "lafitness-demo-keivalya"
DOMAIN = "agentmail.to"

AGENT_INBOX_ID = f"{AGENT_INBOX_USERNAME}@{DOMAIN}"
MERCHANT_INBOX_ID = f"{MERCHANT_INBOX_USERNAME}@{DOMAIN}"

# Thread state cache. Keyed by AgentMail thread_id.
# Schema: {sent: msg dict, sent_at: datetime, status: str, received: msg dict?,
#          confirmation_number: str?}
_threads: dict[str, dict] = {}

# Confirmation number regex (matches templated reply but also generalizes)
_CONFIRMATION_PATTERN = re.compile(
    r"Confirmation\s+Number\s*[:\-]?\s*([A-Z][A-Z0-9]*-[A-Z0-9-]+)",
    re.IGNORECASE,
)


# ── Client ──────────────────────────────────────────────────────────

def _client() -> AgentMail:
    if "AGENTMAIL_API_KEY" not in os.environ:
        raise RuntimeError("AGENTMAIL_API_KEY missing from environment")
    return AgentMail(api_key=os.environ["AGENTMAIL_API_KEY"])


# ── Provisioning ────────────────────────────────────────────────────

def _inbox_exists(client: AgentMail, address: str) -> bool:
    page = client.inboxes.list()
    items = getattr(page, "inboxes", None) or getattr(page, "items", None) or []
    for ib in items:
        ib_addr = (
            getattr(ib, "inbox_id", None)
            or getattr(ib, "email", None)
            or getattr(ib, "address", None)
            or getattr(ib, "id", None)
        )
        if ib_addr and str(ib_addr).lower() == address.lower():
            return True
    return False


def _ensure_inbox(client: AgentMail, username: str, display_name: str) -> str:
    """Idempotent inbox creation. Returns the inbox address."""
    address = f"{username}@{DOMAIN}"
    if _inbox_exists(client, address):
        return address

    try:
        client.inboxes.create(
            request={
                "username": username,
                "domain": DOMAIN,
                "display_name": display_name,
            }
        )
        return address
    except Exception as e:
        # Race: another process may have created it between our check and
        # our create. Re-check.
        if _inbox_exists(client, address):
            return address
        raise RuntimeError(f"Failed to provision {address}: {e}") from e


def provision_inboxes() -> dict:
    """
    Idempotent. Called on FastAPI startup.
    Returns {agent_id, merchant_id} — the email addresses (also IDs).
    """
    client = _client()
    agent_id = _ensure_inbox(client, AGENT_INBOX_USERNAME, "Refund Hunter Agent")
    merchant_id = _ensure_inbox(
        client, MERCHANT_INBOX_USERNAME, "LA Fitness Member Services - demo"
    )
    return {"agent_id": agent_id, "merchant_id": merchant_id}


# ── Send ────────────────────────────────────────────────────────────

def send_cancellation_email(case_id: str) -> dict:
    """
    Send a templated cancellation request from agent → merchant.
    Returns thread state dict and caches it by thread_id.
    """
    if case_id != LA_FITNESS_CASE["case_id"]:
        raise ValueError(
            f"Email lane only wired for {LA_FITNESS_CASE['case_id']}, got {case_id}"
        )

    client = _client()
    sent_at = datetime.now(timezone.utc)
    resp = client.inboxes.messages.send(
        inbox_id=AGENT_INBOX_ID,
        to=MERCHANT_INBOX_ID,
        subject=OUTBOUND_SUBJECT,
        text=OUTBOUND_TEXT,
    )

    thread_id = str(resp.thread_id)
    message_id = str(resp.message_id)

    state = {
        "thread_id": thread_id,
        "case_id": case_id,
        "status": "sent",
        "sent": {
            "message_id": message_id,
            "from": AGENT_INBOX_ID,
            "to": MERCHANT_INBOX_ID,
            "subject": OUTBOUND_SUBJECT,
            "preview": OUTBOUND_TEXT[:160],
            "body": OUTBOUND_TEXT,
            "sent_at": sent_at.isoformat(),
        },
        "received": None,
        "confirmation_number": None,
    }
    _threads[thread_id] = state
    return state


def get_thread_state(thread_id: str) -> dict | None:
    return _threads.get(thread_id)


# ── Poll for replies (used by SSE stream in M4) ─────────────────────

def poll_agent_inbox_for_reply(thread_id: str) -> dict | None:
    """
    Check the agent inbox for any message in the given thread that is NOT
    the original outbound. Returns the reply dict if found, else None.
    """
    state = _threads.get(thread_id)
    if not state:
        return None
    if state.get("received"):
        return state["received"]

    client = _client()
    # List recent messages in the agent inbox; filter by thread membership
    # via the threads API would be cleaner but for now we just scan.
    page = client.inboxes.messages.list(
        inbox_id=AGENT_INBOX_ID,
        limit=20,
        ascending=False,  # newest first
    )
    items = getattr(page, "messages", None) or getattr(page, "items", None) or []
    sent_message_id = state["sent"]["message_id"]

    for m in items:
        m_thread = getattr(m, "thread_id", None)
        if m_thread and str(m_thread) == thread_id:
            m_id = getattr(m, "message_id", None) or getattr(m, "id", None)
            if str(m_id) == sent_message_id:
                continue  # skip the original outbound
            # Found a reply. Fetch full body for confirmation extraction.
            full = client.inboxes.messages.get(
                inbox_id=AGENT_INBOX_ID,
                message_id=str(m_id),
            )
            body = (
                getattr(full, "text", None)
                or getattr(full, "preview", None)
                or ""
            )
            received = {
                "message_id": str(m_id),
                "from": _format_sender(getattr(full, "from_", None) or getattr(full, "from", None)),
                "subject": getattr(full, "subject", None),
                "preview": (body or "")[:160],
                "body": body,
                "received_at": _format_timestamp(
                    getattr(full, "timestamp", None) or getattr(full, "created_at", None)
                ),
            }
            state["received"] = received
            state["status"] = "received"
            # Try to extract confirmation number
            confirmation = parse_confirmation_number(body)
            if confirmation:
                state["confirmation_number"] = confirmation
                state["status"] = "confirmed"
            return received

    return None


def parse_confirmation_number(body: str) -> str | None:
    """Extract a confirmation number from an email body using regex."""
    if not body:
        return None
    match = _CONFIRMATION_PATTERN.search(body)
    if match:
        return match.group(1).upper()
    return None


# ── Helpers ─────────────────────────────────────────────────────────

def _format_sender(sender) -> str:
    if sender is None:
        return "unknown"
    if isinstance(sender, str):
        return sender
    email = getattr(sender, "email", None) or getattr(sender, "address", None)
    name = getattr(sender, "name", None) or getattr(sender, "display_name", None)
    if email and name:
        return f"{name} <{email}>"
    return str(email or sender)


def _format_timestamp(ts) -> str | None:
    if ts is None:
        return None
    if isinstance(ts, str):
        return ts
    return ts.isoformat() if hasattr(ts, "isoformat") else str(ts)


# ── SSE stream for the email lane ───────────────────────────────────

STREAM_POLL_INTERVAL_SEC = 2
STREAM_TIMEOUT_SEC = 45  # auto-responder uses 8s, give ample buffer


async def stream_thread_events(thread_id: str) -> AsyncIterator[dict]:
    """
    Yield SSE-ready dicts for the email thread lifecycle.

    Event shapes:
      {"type": "sent",      "message": {from,to,subject,body,sent_at,...}}
      {"type": "polling",   "elapsed_s": int}
      {"type": "received",  "message": {from,subject,body,received_at,...}}
      {"type": "confirmed", "confirmation_number": str}
      {"type": "timeout"}
      {"type": "error",     "message": str}
    """
    state = _threads.get(thread_id)
    if not state:
        yield {"type": "error", "message": f"thread not found: {thread_id}"}
        return

    # Emit sent immediately so the frontend can render the outbound
    yield {"type": "sent", "message": state["sent"]}

    # If reply already cached (re-subscribing), replay terminal events
    if state.get("received"):
        yield {"type": "received", "message": state["received"]}
        if state.get("confirmation_number"):
            yield {
                "type": "confirmed",
                "confirmation_number": state["confirmation_number"],
            }
        return

    # Poll for reply
    started = time.monotonic()
    sent_message_id = state["sent"]["message_id"]
    while time.monotonic() - started < STREAM_TIMEOUT_SEC:
        await asyncio.sleep(STREAM_POLL_INTERVAL_SEC)
        # Primary (production path): poll the agent inbox via AgentMail API.
        # If AgentMail/SES delivers the reply through normal cross-inbox
        # routing, this returns a real Message dict.
        reply = await asyncio.to_thread(poll_agent_inbox_for_reply, thread_id)

        # DEMO FALLBACK: when both inboxes are self-hosted, intra-org SES
        # delivery is occasionally slow/dropped. The auto-responder caches
        # what it sent; read from that local cache. In production this
        # branch is deleted along with merchant_inbox.py.
        if reply is None:
            from agents import merchant_inbox  # avoid circular at import time
            demo_reply = merchant_inbox.get_replied_to(sent_message_id)
            if demo_reply:
                reply = {
                    "message_id": demo_reply.get("reply_message_id"),
                    "from": demo_reply["from"],
                    "subject": demo_reply["subject"],
                    "body": demo_reply["body"],
                    "preview": demo_reply["body"][:160],
                    "received_at": demo_reply["sent_at"],
                    "source": "demo-merchant-cache",
                }
                state["received"] = reply
                state["status"] = "received"
                confirmation = parse_confirmation_number(demo_reply["body"])
                if confirmation:
                    state["confirmation_number"] = confirmation
                    state["status"] = "confirmed"

        if reply:
            yield {"type": "received", "message": reply}
            current = _threads.get(thread_id) or {}
            confirmation = current.get("confirmation_number")
            if confirmation:
                yield {"type": "confirmed", "confirmation_number": confirmation}
            return
        yield {
            "type": "polling",
            "elapsed_s": int(time.monotonic() - started),
        }

    yield {"type": "timeout"}
