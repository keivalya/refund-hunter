"""
Email templates for the LA Fitness cancellation flow.

OUTBOUND: sent by the agent inbox to the merchant inbox.
INBOUND:  scripted reply sent by merchant_inbox.py auto-responder.

DEMO NOTE: The confirmation number "LAF-CXL-78234" is deterministic for
demo credibility — judges may want to see the same number appear in the
email body AND on the lane confirmation pill. Don't randomize it.
"""

# Hardcoded case data (matches frontend display)
LA_FITNESS_CASE = {
    "case_id": "sub_la_fitness",
    "merchant": "LA Fitness",
    "plan": "Signature Membership",
    "monthly_cost": 49.99,
    "member_name": "Keivalya Pandya",
    "member_id": "LAF-2024-7842",
    "home_club": "LA Fitness — Boston Back Bay",
}

CONFIRMATION_NUMBER = "LAF-CXL-78234"


# ── Outbound (agent → merchant) ─────────────────────────────────────

OUTBOUND_SUBJECT = (
    f"Cancellation Request — Member ID {LA_FITNESS_CASE['member_id']}"
)

OUTBOUND_TEXT = f"""\
To Whom It May Concern,

I am writing to cancel my LA Fitness Signature Membership effective \
immediately. My membership details:

- Member name: {LA_FITNESS_CASE['member_name']}
- Member ID: {LA_FITNESS_CASE['member_id']}
- Home club: {LA_FITNESS_CASE['home_club']}
- Plan: {LA_FITNESS_CASE['plan']}
- Monthly charge: ${LA_FITNESS_CASE['monthly_cost']:.2f}

Per LA Fitness's cancellation policy, written notice via email or \
certified mail constitutes valid cancellation. Please confirm receipt of \
this request and provide a cancellation confirmation number.

I expect cancellation to be effective by the end of the current billing \
period. Please do not process any further charges.

Thank you for your prompt attention.

Best regards,
{LA_FITNESS_CASE['member_name']}\
"""


# ── Inbound auto-reply (merchant → agent) ───────────────────────────

INBOUND_SUBJECT = f"Re: Cancellation Request — Member ID {LA_FITNESS_CASE['member_id']}"

INBOUND_TEXT = f"""\
Dear {LA_FITNESS_CASE['member_name']},

We have received your cancellation request for membership \
{LA_FITNESS_CASE['member_id']} at {LA_FITNESS_CASE['home_club']}.

Your cancellation has been processed and is effective immediately. No \
further charges will be applied to your account.

Confirmation Number: {CONFIRMATION_NUMBER}

Please retain this email for your records.

LA Fitness Member Services\
"""
