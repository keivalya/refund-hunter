<p align="center">
  <img src="./design/banner.svg" alt="Refund Hunter" width="100%" />
</p>

<p align="center">
  <strong>Cancels the subscriptions you can't.</strong><br/>
  <sub>Phone-gated gyms · dark-pattern web flows · email-only timeshares.</sub>
</p>

---

## The problem

Signing up takes one click. Cancelling takes 47 minutes on hold with a retention agent who has been trained to talk you out of it.

The asymmetry is by design. Gyms require phone calls. The New York Times hides cancellation behind a chat widget that gates on a human agent. SiriusXM's retention scripts have three layers of counter-offers. LA Fitness demands certified mail.

The average American household pays for **12 subscriptions** they no longer use. Most never cancel — not because they don't want to, but because the friction is engineered to be unbearable.

## What it does

Connect your Gmail. Refund Hunter scans for recurring charges, ranks them by recoverable spend, and dispatches a specialized AI agent per channel:

- **Voice** — places a real phone call, navigates IVR, talks to retention, declines offers politely, requests a confirmation number, hangs up.
- **Browser** — navigates dark-pattern cancellation flows, opens chat widgets, and types cancellation requests verbatim.
- **Email** — drafts and sends compliant cancellation notices, parses replies, extracts confirmation numbers.

You approve. The agents handle the rest. You keep 70% of what they recover.

## How it works

Each agent is informed by a persistent merchant playbook synthesized from every prior cancellation. The voice agent knows what Planet Fitness retention will offer *before they offer it* — because Refund Hunter has heard it nine times before.

During the call, every rep utterance triggers a sub-100ms semantic search against the merchant's playbook. The agent's response is always informed by the most relevant counter-script for *this exact moment*.

## Built on

| Layer | Service |
|---|---|
| Voice agents | AgentPhone |
| Browser automation | Browser Use |
| Email infrastructure | AgentMail |
| Persistent merchant memory | Supermemory |
| In-call real-time retrieval | Moss |
| Inbox connection | Gmail API (read-only) |

## Why now

Voice models became cheap and fast. Browser automation finally works. Email APIs ship in agent-native formats. Persistent memory is a hosted primitive. The infrastructure to put an AI on the other end of a retention call did not exist eighteen months ago. It does now.

The phone book is open. The web is a playground. Inboxes are fair game.

## Quick start

```bash
# Backend (FastAPI on :8000)
cd backend
pip install -r requirements.txt
cp ../.env.example ../.env   # fill in API keys
uvicorn main:app --reload

# Frontend (Next.js on :3000)
cd frontend
pnpm install
pnpm dev
```

Visit `localhost:3000`, connect Gmail, approve a cancellation.

---

<p align="center">
  <sub>Built at <em>Call My Agent Hackathon</em> · AgentPhone @ Y Combinator · May 2026</sub>
</p>
