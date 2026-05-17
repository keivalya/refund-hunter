"""
Fabricated prior-call memories for Supermemory.

DEMO NOTE: These 11 entries are HAND-WRITTEN for the demo. In production
they would be real cancellation history written by the post-completion
ingestion hooks. The dates, retention offers, and outcomes are realistic
but invented.

Loaded into Supermemory on FastAPI startup. Idempotent — the loader counts
existing seeds per merchant by metadata.seed=True and only writes if
under the expected count.
"""

MERCHANT_TAGS = {
    "planet_fitness": "merchant_planet_fitness",
    "nyt": "merchant_nyt",
    "la_fitness": "merchant_la_fitness",
}

# Each seed entry: content (narrative summary), metadata (structured fields)
# Container tag derived from the merchant key.

PLANET_FITNESS_SEEDS = [
    {
        "seed_id": "pf_001",
        "content": (
            "Cancelled Planet Fitness Classic Membership for member at "
            "Boston Back Bay location. Rep offered '50% off for 3 months' "
            "as retention. Agent declined politely and requested a "
            "confirmation number. Cancellation processed, confirmation "
            "number PF-CXL-49102 issued. Call duration 3 minutes 8 seconds."
        ),
        "metadata": {
            "channel": "voice",
            "outcome": "cancelled",
            "retention_offered": "50_pct_3_months",
            "duration_seconds": 188,
            "confirmation_number": "PF-CXL-49102",
            "timestamp": "2026-04-12T18:14:22Z",
            "seed": True,
            "seed_id": "pf_001",
        },
    },
    {
        "seed_id": "pf_002",
        "content": (
            "Cancelled Planet Fitness Classic Membership. Rep offered "
            "'50% off for 3 months' which agent declined, then offered "
            "a free personal training session as secondary retention. "
            "Agent declined both, reiterated cancellation intent firmly. "
            "Confirmed cancellation, number PF-CXL-51847. Total duration "
            "3 minutes 41 seconds."
        ),
        "metadata": {
            "channel": "voice",
            "outcome": "cancelled",
            "retention_offered": "50_pct_3_months",
            "retention_secondary": "free_personal_training",
            "duration_seconds": 221,
            "confirmation_number": "PF-CXL-51847",
            "timestamp": "2026-04-19T15:02:11Z",
            "seed": True,
            "seed_id": "pf_002",
        },
    },
    {
        "seed_id": "pf_003",
        "content": (
            "Cancelled Planet Fitness Black Card membership. Rep offered "
            "'50% off for 3 months' as standard retention. Agent declined "
            "and asked for confirmation. Cancellation processed cleanly, "
            "confirmation PF-CXL-52910. Duration 2 minutes 54 seconds. "
            "Rep was direct, no extended negotiation."
        ),
        "metadata": {
            "channel": "voice",
            "outcome": "cancelled",
            "retention_offered": "50_pct_3_months",
            "duration_seconds": 174,
            "confirmation_number": "PF-CXL-52910",
            "timestamp": "2026-04-26T20:33:47Z",
            "seed": True,
            "seed_id": "pf_003",
        },
    },
    {
        "seed_id": "pf_004",
        "content": (
            "Cancelled Planet Fitness Classic Membership. Rep offered "
            "membership freeze for 60 days as alternative to cancellation. "
            "Agent declined, requested full cancellation. Then rep offered "
            "50% off for 3 months — also declined. Confirmation PF-CXL-54218 "
            "received. Call took 3 minutes 22 seconds."
        ),
        "metadata": {
            "channel": "voice",
            "outcome": "cancelled",
            "retention_offered": "freeze_60_days",
            "retention_secondary": "50_pct_3_months",
            "duration_seconds": 202,
            "confirmation_number": "PF-CXL-54218",
            "timestamp": "2026-05-03T11:08:55Z",
            "seed": True,
            "seed_id": "pf_004",
        },
    },
    {
        "seed_id": "pf_005",
        "content": (
            "Cancelled Planet Fitness Classic Membership. Rep offered "
            "'50% off for 3 months' retention. Agent declined politely. "
            "Cancellation processed, confirmation number PF-CXL-55603 "
            "provided verbally and via email. Duration 3 minutes 8 seconds."
        ),
        "metadata": {
            "channel": "voice",
            "outcome": "cancelled",
            "retention_offered": "50_pct_3_months",
            "duration_seconds": 188,
            "confirmation_number": "PF-CXL-55603",
            "timestamp": "2026-05-10T09:47:13Z",
            "seed": True,
            "seed_id": "pf_005",
        },
    },
]

NYT_SEEDS = [
    {
        "seed_id": "nyt_001",
        "content": (
            "Attempted NYT All Access Digital cancellation via browser flow. "
            "Navigated nytimes.com Help Center > Account > Cancel Subscription. "
            "Flow gated on chat widget for human handoff. Agent opened chat, "
            "submitted cancellation message, waited for live agent response. "
            "Chat-handoff reached successfully. Total navigation 4 minutes."
        ),
        "metadata": {
            "channel": "browser",
            "outcome": "chat_handoff",
            "navigation_steps": 14,
            "duration_seconds": 245,
            "timestamp": "2026-04-15T13:21:09Z",
            "seed": True,
            "seed_id": "nyt_001",
        },
    },
    {
        "seed_id": "nyt_002",
        "content": (
            "NYT cancellation flow reached chat handoff. Outside business "
            "hours (UTC evening), chat was unavailable. Agent reported the "
            "handoff requirement and the unavailability window."
        ),
        "metadata": {
            "channel": "browser",
            "outcome": "chat_unavailable",
            "navigation_steps": 12,
            "duration_seconds": 198,
            "timestamp": "2026-04-22T03:44:51Z",
            "seed": True,
            "seed_id": "nyt_002",
        },
    },
    {
        "seed_id": "nyt_003",
        "content": (
            "NYT cancellation completed via self-serve flow. Account had "
            "promotional tier eligible for self-cancellation. Agent reached "
            "confirmation page, screenshot saved. No chat required."
        ),
        "metadata": {
            "channel": "browser",
            "outcome": "self_serve_completed",
            "navigation_steps": 9,
            "duration_seconds": 132,
            "timestamp": "2026-05-01T16:55:20Z",
            "seed": True,
            "seed_id": "nyt_003",
        },
    },
]

LA_FITNESS_SEEDS = [
    {
        "seed_id": "laf_001",
        "content": (
            "LA Fitness Signature Membership cancellation via email. Sent "
            "templated cancellation request with member ID. Auto-confirmation "
            "received within 18 hours. Confirmation number LAF-CXL-71204 "
            "issued. No retention offer in reply."
        ),
        "metadata": {
            "channel": "email",
            "outcome": "cancelled",
            "reply_within_hours": 18,
            "confirmation_number": "LAF-CXL-71204",
            "timestamp": "2026-04-08T10:00:00Z",
            "seed": True,
            "seed_id": "laf_001",
        },
    },
    {
        "seed_id": "laf_002",
        "content": (
            "LA Fitness Signature Membership cancellation via email. "
            "Confirmation received within 6 hours with number LAF-CXL-73188. "
            "Reply included standard 'sorry to see you go' message but no "
            "retention attempt."
        ),
        "metadata": {
            "channel": "email",
            "outcome": "cancelled",
            "reply_within_hours": 6,
            "confirmation_number": "LAF-CXL-73188",
            "timestamp": "2026-04-21T14:30:00Z",
            "seed": True,
            "seed_id": "laf_002",
        },
    },
    {
        "seed_id": "laf_003",
        "content": (
            "LA Fitness Signature Membership cancellation via email. "
            "Confirmation received next business day (~22 hours). "
            "Confirmation number LAF-CXL-75512 in standard format."
        ),
        "metadata": {
            "channel": "email",
            "outcome": "cancelled",
            "reply_within_hours": 22,
            "confirmation_number": "LAF-CXL-75512",
            "timestamp": "2026-05-04T09:15:00Z",
            "seed": True,
            "seed_id": "laf_003",
        },
    },
]


ALL_SEEDS: dict[str, list[dict]] = {
    "planet_fitness": PLANET_FITNESS_SEEDS,
    "nyt": NYT_SEEDS,
    "la_fitness": LA_FITNESS_SEEDS,
}


# Human-readable labels for the retention codes (for the dashboard panel)
RETENTION_LABELS = {
    "50_pct_3_months": "50% off for 3 months",
    "free_personal_training": "Free personal training session",
    "freeze_60_days": "Membership freeze for 60 days",
}
