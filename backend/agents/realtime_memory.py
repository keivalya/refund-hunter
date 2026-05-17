"""
Moss in-call real-time retrieval.

DEMO MODE = PATH B (observe-only). Reasoning:
  AgentPhone's hosted mode has no per-turn webhook. To get Path A
  (Moss-shaped responses), we'd have to switch to webhook mode and
  re-implement the entire voice loop. Far too risky for demo day.
  Path B observes via the existing transcript SSE: on each rep turn we
  query Moss and emit a retrieval event for the frontend. The agent's
  actual response is still produced by AgentPhone's built-in LLM, which
  is already enriched with the Tier 2b Supermemory playbook section.
  In production, this exact hook would shape responses via webhook mode.

DESIGN DEVIATION from spec:
  The spec assumed per-call indices (`playbook_{merchant}_{call_id}`).
  M1 measurements showed Moss's cold load takes ~24s, which makes per-call
  indices infeasible for a 60s demo. Instead we use one persistent index
  per merchant (`playbook_{merchant_id}`), refreshed at backend startup.
  Queries are 2-10ms once the index is warm.

GRACEFUL DEGRADATION:
  Every public function returns gracefully on Moss errors. The voice call
  must work even if Moss is dead.
"""

import asyncio
import os
import time
from typing import Optional

from moss import MossClient, DocumentInfo, QueryOptions


# Latency cap — if a query exceeds this, we skip the retrieval for that turn.
QUERY_LATENCY_BUDGET_MS = 150
QUERY_TOP_K = 3
QUERY_ALPHA = 0.6  # semantic-leaning hybrid
SCORE_THRESHOLD = 0.7  # below this, the chunk isn't relevant — skip

# Track which indices we've successfully warmed so we don't re-query Moss
# every time. None = not yet attempted; True = warmed.
_warmed_indices: dict[str, bool] = {}
_client_singleton: Optional[MossClient] = None


# ── Client ──────────────────────────────────────────────────────────

def _client() -> Optional[MossClient]:
    """Lazy singleton. Returns None if env vars missing."""
    global _client_singleton
    if _client_singleton is not None:
        return _client_singleton
    pid = os.environ.get("MOSS_PROJECT_ID")
    pkey = os.environ.get("MOSS_PROJECT_KEY")
    if not pid or not pkey:
        return None
    _client_singleton = MossClient(pid, pkey)
    return _client_singleton


def index_name_for(merchant_id: str) -> str:
    # Moss-safe identifier
    return f"playbook_{merchant_id}"


# ── Chunk definitions ───────────────────────────────────────────────

# Static chunks per merchant. In a richer build we'd parameterize from the
# Supermemory playbook (e.g. inject the most-recent confirmation number
# format), but for demo purposes static is fine — the chunks describe
# behavior, not data.

PLANET_FITNESS_CHUNKS: list[tuple[str, str]] = [
    (
        "counter_pct_offer",
        "When the rep offers a percentage discount such as '50% off for 3 "
        "months' or any reduced-rate retention, decline politely: 'No thank "
        "you, please proceed with the cancellation.' Do not negotiate further.",
    ),
    (
        "counter_freeze",
        "When the rep offers to freeze, pause, or put the membership on "
        "hold, decline: 'I appreciate that, but I'd like to fully cancel today.'",
    ),
    (
        "counter_personal_training",
        "When the rep offers free personal training sessions or a free class, "
        "decline politely: 'No thank you, please proceed with the cancellation.'",
    ),
    (
        "counter_other_discount",
        "When the rep offers any other discount, promotion, or special rate, "
        "decline once and reiterate cancellation intent.",
    ),
    (
        "request_confirmation_number",
        "Before ending the call, always ask: 'Could I get a cancellation "
        "confirmation number for my records?' If they say it will be sent by "
        "email, ask for verbal confirmation that cancellation has been processed.",
    ),
    (
        "decline_supervisor_transfer",
        "If the rep offers to transfer to a supervisor or retention specialist, "
        "decline politely: 'I appreciate that, but I'd like to complete the "
        "cancellation now.'",
    ),
    (
        "decline_callback",
        "If the rep offers to call back later or schedule a callback, decline: "
        "'I'd prefer to complete this now while I have you on the line.'",
    ),
    (
        "decline_let_me_think",
        "Never say 'let me think about it' or 'let me get back to you'. The "
        "decision is final. Be firm but polite.",
    ),
    (
        "verify_member_id",
        "When asked for the member ID, provide: PF-20240315-7842. Spell each "
        "character clearly if asked to repeat: P, F, two, zero, two, four, "
        "zero, three, one, five, seven, eight, four, two.",
    ),
    (
        "confirm_billing_cycle",
        "Cancellation typically takes effect at the end of the current billing "
        "cycle. Confirm: 'I understand cancellation will be effective at the "
        "end of the current period — no further charges, correct?'",
    ),
    (
        "closing_thank_you",
        "End politely: 'Thank you for your help. Have a good day.' Wait for "
        "the rep to finish before hanging up.",
    ),
    (
        "do_not_reveal_ai",
        "Never reveal that you are an AI or automated system. Identify only "
        "as: 'I'm calling on behalf of the member.'",
    ),
]


CHUNK_TEXT_BY_ID: dict[str, str] = {
    cid: text for cid, text in PLANET_FITNESS_CHUNKS
}


def _docs_for_merchant(merchant_id: str) -> list[DocumentInfo]:
    if merchant_id == "planet_fitness":
        return [DocumentInfo(id=cid, text=text) for cid, text in PLANET_FITNESS_CHUNKS]
    return []


# ── Startup: ensure + warm index ────────────────────────────────────

async def ensure_index_for(merchant_id: str) -> dict:
    """
    Create the merchant's playbook index if missing, then load (warm) it.
    Idempotent. Safe to call multiple times. Returns a summary dict.
    Fast-path: returns immediately if already warmed in this process.
    """
    client = _client()
    if client is None:
        return {"merchant_id": merchant_id, "skipped": "no_credentials"}

    docs = _docs_for_merchant(merchant_id)
    if not docs:
        return {"merchant_id": merchant_id, "skipped": "no_chunks_defined"}

    name = index_name_for(merchant_id)
    if _warmed_indices.get(name):
        return {"merchant_id": merchant_id, "index": name, "already_warm": True}

    # Try create_index; if it fails because the index exists, that's fine.
    t0 = time.monotonic()
    try:
        await client.create_index(name, docs)
        created_ms = int((time.monotonic() - t0) * 1000)
    except Exception as e:
        created_ms = int((time.monotonic() - t0) * 1000)
        # Most likely "already exists" — proceed to load.
        msg = repr(e)
        if "exist" not in msg.lower() and "conflict" not in msg.lower():
            print(f"[moss] create_index({name}) returned: {msg[:200]}", flush=True)

    # Warm-load. This can take up to ~30s on a cold project.
    t0 = time.monotonic()
    try:
        status = await client.load_index(name)
        loaded_ms = int((time.monotonic() - t0) * 1000)
        _warmed_indices[name] = True
        return {
            "merchant_id": merchant_id,
            "index": name,
            "create_ms": created_ms,
            "load_ms": loaded_ms,
            "load_status": str(status),
            "chunks": len(docs),
        }
    except Exception as e:
        return {
            "merchant_id": merchant_id,
            "index": name,
            "load_error": repr(e)[:200],
        }


# ── In-call query (latency-guarded) ─────────────────────────────────

async def query_for_turn(
    merchant_id: str,
    utterance: str,
    *,
    budget_ms: int = QUERY_LATENCY_BUDGET_MS,
) -> Optional[dict]:
    """
    Run a Moss query for one rep utterance. Returns a dict suitable for
    SSE relay, or None on any failure / budget miss / no relevant hit.

    Return shape:
      {
        "query": "<utterance>",
        "latency_ms": int,
        "top": {"id": str, "text": str, "score": float},
        "extras": [{"id": ..., "score": ...}, ...]   # optional supporting hits
      }
    """
    if not utterance or not utterance.strip():
        return None

    client = _client()
    if client is None:
        return None

    name = index_name_for(merchant_id)
    if not _warmed_indices.get(name):
        # Index not warmed yet; skip (don't try to warm here — that takes 20s+)
        return None

    t0 = time.monotonic()
    try:
        result = await asyncio.wait_for(
            client.query(name, utterance, QueryOptions(top_k=QUERY_TOP_K, alpha=QUERY_ALPHA)),
            timeout=budget_ms / 1000.0,
        )
    except asyncio.TimeoutError:
        latency_ms = int((time.monotonic() - t0) * 1000)
        print(f"[moss] query timeout {latency_ms}ms (budget {budget_ms}ms)", flush=True)
        return None
    except Exception as e:
        print(f"[moss] query error: {e!r}", flush=True)
        return None

    latency_ms = int((time.monotonic() - t0) * 1000)

    # Extract hits across SDK shape variants
    hits = None
    for attr in ("results", "matches", "items", "documents", "docs"):
        v = getattr(result, attr, None)
        if v is not None:
            hits = list(v)
            break
    if hits is None and isinstance(result, (list, tuple)):
        hits = list(result)
    if not hits:
        return None

    def _row(h):
        return {
            "id": getattr(h, "id", None) or getattr(h, "doc_id", None) or "?",
            "score": float(getattr(h, "score", 0.0) or 0.0),
            "text": getattr(h, "text", "") or getattr(h, "content", "") or "",
        }

    rows = [_row(h) for h in hits]
    top = rows[0]
    if top["score"] < SCORE_THRESHOLD:
        # Below threshold = no meaningful match. Skip (avoids noisy chips).
        return None

    return {
        "query": utterance,
        "latency_ms": latency_ms,
        "top": {"id": top["id"], "score": top["score"], "text": top["text"][:200]},
        "extras": [{"id": r["id"], "score": r["score"]} for r in rows[1:3]],
    }
