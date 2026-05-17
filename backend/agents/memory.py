"""
Supermemory integration — persistent per-merchant cancellation knowledge.

Pre-call: query for top memories scoped to the merchant. Synthesize
patterns (most common retention offer, average duration, etc.) and inject
into the voice agent's system prompt.

Post-call: write a structured memory of the cancellation outcome so
future calls benefit.

DEMO NOTE: Memory is between-call only. Supermemory does NOT serve the
in-call hot path — that's Moss's job (Tier 2c).
"""

import os
import re
import time
from typing import Optional

from supermemory import Supermemory

from data.memory_seeds import ALL_SEEDS, MERCHANT_TAGS, RETENTION_LABELS


# ── Voice retention extraction (used by post-call ingestion) ────────

_VOICE_RETENTION_PATTERNS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"50\s*%\s*off|fifty\s*percent\s*off", re.IGNORECASE), "50_pct_3_months"),
    (re.compile(r"\b(freeze|freezing|pause|hold)\b", re.IGNORECASE), "freeze_60_days"),
    (re.compile(r"(personal\s*training|free\s*session|free\s*class)", re.IGNORECASE), "free_personal_training"),
    (re.compile(r"\b(discount|reduced\s*rate|special\s*offer|promotion)\b", re.IGNORECASE), "other_discount"),
]


def extract_retention_from_transcript(text: str) -> Optional[str]:
    """Scan a voice transcript for retention-offer keywords. First match wins."""
    if not text:
        return None
    for pattern, code in _VOICE_RETENTION_PATTERNS:
        if pattern.search(text):
            return code
    return None


# ── Client ──────────────────────────────────────────────────────────

def _client() -> Supermemory:
    if "SUPERMEMORY_API_KEY" not in os.environ:
        raise RuntimeError("SUPERMEMORY_API_KEY missing from environment")
    return Supermemory(api_key=os.environ["SUPERMEMORY_API_KEY"])


def tag_for(merchant_id: str) -> str:
    return MERCHANT_TAGS.get(merchant_id, f"merchant_{merchant_id}")


# ── In-process cache for insights ───────────────────────────────────

_insights_cache: dict[str, tuple[float, dict]] = {}
_CACHE_TTL_SEC = 60


def _cache_get(merchant_id: str) -> Optional[dict]:
    entry = _insights_cache.get(merchant_id)
    if not entry:
        return None
    expires_at, value = entry
    if time.monotonic() > expires_at:
        return None
    return value


def _cache_put(merchant_id: str, value: dict) -> None:
    _insights_cache[merchant_id] = (time.monotonic() + _CACHE_TTL_SEC, value)


def invalidate_cache(merchant_id: Optional[str] = None) -> None:
    """Drop cached insights (call after writing a new memory)."""
    if merchant_id is None:
        _insights_cache.clear()
    else:
        _insights_cache.pop(merchant_id, None)


# ── Write ───────────────────────────────────────────────────────────

def write_memory(
    *,
    merchant_id: str,
    content: str,
    metadata: dict,
    custom_id: Optional[str] = None,
) -> dict:
    """Write a single memory document to Supermemory."""
    client = _client()
    kwargs: dict = {
        "content": content,
        "container_tags": [tag_for(merchant_id)],
        "metadata": metadata,
    }
    if custom_id is not None:
        kwargs["custom_id"] = custom_id
    resp = client.add(**kwargs)
    invalidate_cache(merchant_id)
    # SDK returns a Pydantic-ish model; normalize to dict
    return _to_dict(resp)


# ── Read ────────────────────────────────────────────────────────────

def search_memories(merchant_id: str, query: str = "cancellation", limit: int = 10) -> list[dict]:
    """Return top-N memories for a merchant, ranked by Supermemory's semantic score."""
    client = _client()
    resp = client.search.documents(
        q=query,
        container_tags=[tag_for(merchant_id)],
        limit=limit,
    )
    results = _extract_results(resp)
    return [_to_dict(r) for r in results]


def _extract_results(resp) -> list:
    # The SDK returns a paginated result with 'results' or 'documents' attribute
    for attr in ("results", "documents", "items", "data"):
        v = getattr(resp, attr, None)
        if v is not None:
            return list(v)
    if isinstance(resp, list):
        return resp
    return []


def _to_dict(obj) -> dict:
    if isinstance(obj, dict):
        return obj
    for method in ("model_dump", "dict", "to_dict"):
        fn = getattr(obj, method, None)
        if callable(fn):
            try:
                return fn()
            except Exception:
                continue
    # Best-effort attribute scrape
    return {
        k: getattr(obj, k) for k in dir(obj)
        if not k.startswith("_") and not callable(getattr(obj, k, None))
    }


# ── Pattern synthesis ───────────────────────────────────────────────

def _extract_metadata(memory: dict) -> dict:
    """Pull metadata dict out of a Supermemory result (shape varies)."""
    md = memory.get("metadata")
    if isinstance(md, dict):
        return md
    return {}


def synthesize_playbook(memories: list[dict]) -> dict:
    """
    Count retention offers, compute stats, return structured playbook.
    Pure-Python aggregation — no LLM call.
    """
    retention_counts: dict[str, int] = {}
    durations: list[int] = []
    outcomes: dict[str, int] = {}
    confirmation_examples: list[str] = []
    reply_hours: list[int] = []

    for m in memories:
        md = _extract_metadata(m)
        offer = md.get("retention_offered")
        if offer:
            retention_counts[offer] = retention_counts.get(offer, 0) + 1
        secondary = md.get("retention_secondary")
        if secondary:
            retention_counts[secondary] = retention_counts.get(secondary, 0) + 1

        if isinstance(md.get("duration_seconds"), (int, float)):
            durations.append(int(md["duration_seconds"]))
        if isinstance(md.get("reply_within_hours"), (int, float)):
            reply_hours.append(int(md["reply_within_hours"]))

        outcome = md.get("outcome", "unknown")
        outcomes[outcome] = outcomes.get(outcome, 0) + 1

        conf = md.get("confirmation_number")
        if conf and len(confirmation_examples) < 3:
            confirmation_examples.append(conf)

    call_count = len(memories)
    success_outcomes = ("cancelled", "self_serve_completed")
    successes = sum(c for o, c in outcomes.items() if o in success_outcomes)
    success_rate = (successes / call_count) if call_count else 0.0

    # Sort retention patterns by frequency, descending
    patterns_sorted = sorted(retention_counts.items(), key=lambda kv: kv[1], reverse=True)
    retention_patterns = [
        {
            "offer": code,
            "freq": freq,
            "label": RETENTION_LABELS.get(code, code.replace("_", " ").title()),
        }
        for code, freq in patterns_sorted
    ]

    avg_duration = int(sum(durations) / len(durations)) if durations else None
    avg_reply_hours = int(sum(reply_hours) / len(reply_hours)) if reply_hours else None

    return {
        "call_count": call_count,
        "success_rate": round(success_rate, 2),
        "avg_duration_seconds": avg_duration,
        "avg_reply_hours": avg_reply_hours,
        "outcomes": outcomes,
        "retention_patterns": retention_patterns,
        "confirmation_examples": confirmation_examples,
    }


def get_merchant_playbook(merchant_id: str, top_k: int = 10) -> dict:
    """
    Query Supermemory for the merchant's memories, synthesize a playbook.
    Cached for 60 seconds.

    On any failure, returns a graceful-degrade playbook with call_count=0
    so callers can fall back to hardcoded behavior.
    """
    cached = _cache_get(merchant_id)
    if cached is not None:
        return cached

    try:
        memories = search_memories(merchant_id, limit=top_k)
        playbook = synthesize_playbook(memories)
        _cache_put(merchant_id, playbook)
        return playbook
    except Exception as e:
        print(f"[memory] get_merchant_playbook({merchant_id}) failed: {e}", flush=True)
        return {
            "call_count": 0,
            "success_rate": 0.0,
            "avg_duration_seconds": None,
            "avg_reply_hours": None,
            "outcomes": {},
            "retention_patterns": [],
            "confirmation_examples": [],
            "error": str(e),
        }


# ── System prompt enrichment (voice lane only) ──────────────────────

def render_playbook_section(playbook: dict) -> str:
    """
    Render the playbook as a structured section to APPEND to the agent's
    system prompt. Inserted dynamically per-call — never hardcoded.
    """
    if not playbook or playbook.get("call_count", 0) == 0:
        return ""

    lines = [
        "",
        "## KNOWLEDGE FROM PRIOR CALLS",
        "",
        f"Based on {playbook['call_count']} prior cancellation calls with this merchant:",
        "",
    ]

    patterns = playbook.get("retention_patterns") or []
    if patterns:
        lines.append("Most common retention offers (in order of frequency):")
        for i, p in enumerate(patterns[:5], 1):
            lines.append(f"{i}. {p['label']} ({p['freq']} of {playbook['call_count']} calls)")
        lines.append("")
        lines.append("Successful counter-strategies:")
        lines.append("- Decline each offer politely and firmly")
        lines.append("- Reiterate cancellation intent after each objection")
        lines.append("- Ask for a confirmation number before ending the call")
        lines.append("")

    avg_dur = playbook.get("avg_duration_seconds")
    if avg_dur:
        m, s = divmod(avg_dur, 60)
        lines.append(f"Average call duration with this merchant: {m} minutes {s} seconds.")
        lines.append("")

    lines.append(
        "You are calling on behalf of an existing member. Stay polite but firm."
    )
    return "\n".join(lines)


# ── Seed loader (idempotent) ────────────────────────────────────────

def seed_memories_if_missing() -> dict:
    """
    For each merchant in ALL_SEEDS, count existing seed memories. If under
    the expected count, write the missing ones.

    Returns a summary dict {merchant_id: {expected, found, written}}.
    """
    summary: dict[str, dict] = {}
    for merchant_id, seeds in ALL_SEEDS.items():
        expected = len(seeds)
        try:
            # We search for ALL memories in this merchant and count those
            # with metadata.seed == True. Counting via Supermemory's filter
            # API is possible but inconsistent across SDK versions, so we
            # scan results directly.
            existing = search_memories(merchant_id, limit=50)
            seed_ids_present = {
                _extract_metadata(m).get("seed_id")
                for m in existing
                if _extract_metadata(m).get("seed")
            }
            seed_ids_present.discard(None)

            written = 0
            for seed in seeds:
                if seed["seed_id"] in seed_ids_present:
                    continue
                write_memory(
                    merchant_id=merchant_id,
                    content=seed["content"],
                    metadata=seed["metadata"],
                    custom_id=f"seed_{seed['seed_id']}",
                )
                written += 1

            summary[merchant_id] = {
                "expected": expected,
                "already_present": len(seed_ids_present),
                "written": written,
            }
        except Exception as e:
            summary[merchant_id] = {"error": str(e), "expected": expected}
    return summary
