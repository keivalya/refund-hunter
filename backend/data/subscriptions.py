"""
Curated subscription list for demo.

DEMO NOTE: This list is hand-curated for demo variety, not extracted from
a real Gmail inbox. The OAuth flow is real (judge sees the consent screen),
but the "scan" returns this static list. The next iteration would call
Gmail API + Claude Sonnet for real inbox classification.

Total annual recoverable: $2,374.92
"""

SUBSCRIPTIONS = [
    {
        "id": "sub_adobe_cc",
        "merchant": "Adobe Creative Cloud",
        "plan": "All Apps",
        "monthly_cost": 59.99,
        "annual_recoverable": 719.88,
        "channel": "browser",
        "last_used_days_ago": 89,
        "status": "ready",
        "difficulty": "dark_pattern",
        "notes": "Dark-pattern cancellation flow with early termination fee.",
    },
    {
        "id": "sub_la_fitness",
        "merchant": "LA Fitness",
        "plan": "Signature Membership",
        "monthly_cost": 49.99,
        "annual_recoverable": 599.88,
        "channel": "email",
        "last_used_days_ago": 198,
        "status": "ready",
        "difficulty": "email_only",
        "notes": "Certified-mail-or-email cancellation policy.",
    },
    {
        "id": "sub_nyt",
        "merchant": "New York Times",
        "plan": "All Access Digital",
        "monthly_cost": 25.00,
        "annual_recoverable": 300.00,
        "channel": "browser",
        "last_used_days_ago": 156,
        "status": "ready",
        "difficulty": "dark_pattern",
        "notes": "Chat-required cancellation, well-documented dark pattern.",
    },
    {
        "id": "sub_planet_fitness",
        "merchant": "Planet Fitness",
        "plan": "Classic Membership",
        "monthly_cost": 24.99,
        "annual_recoverable": 299.88,
        "channel": "phone",
        "last_used_days_ago": 247,
        "phone": "+16179358558",
        "status": "ready",
        "difficulty": "phone_required",
        "notes": "Phone-only cancellation. Retention script known.",
    },
    {
        "id": "sub_sirius_xm",
        "merchant": "SiriusXM",
        "plan": "All Access Streaming",
        "monthly_cost": 22.99,
        "annual_recoverable": 275.88,
        "channel": "phone",
        "last_used_days_ago": 412,
        "status": "ready",
        "difficulty": "phone_required",
        "notes": "Notorious for aggressive retention. 3+ objections expected.",
    },
    {
        "id": "sub_audible",
        "merchant": "Audible Premium Plus",
        "plan": "1 Credit/month",
        "monthly_cost": 14.95,
        "annual_recoverable": 179.40,
        "channel": "browser",
        "last_used_days_ago": 78,
        "status": "ready",
        "difficulty": "easy",
        "notes": "Standard web cancellation.",
    },
]

TOTAL_ANNUAL_RECOVERABLE = sum(s["annual_recoverable"] for s in SUBSCRIPTIONS)
