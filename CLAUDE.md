# Refund Hunter — Project Context

## What this is
Hackathon project for "Call My Agent" (AgentPhone @ YC, May 17, 2026). 
Web app that uses AI agents to cancel subscriptions humans struggle to cancel 
themselves (phone-gated, dark-pattern web flows, email-only).

## The one-line pitch
"Connect your Gmail. We find the subscriptions you can't cancel. Our agents 
call, click, or email on your behalf."

## Hero demo moment
Live phone call to Planet Fitness via AgentPhone, transcript streaming on 
screen, retention objection handled, cancellation confirmed.

## Tier status (updated)
- Tier 0: DONE — voice call, transcript SSE
- Tier 1: DONE — Gmail OAuth, dashboard, curated subs
- Tier 1.5: DONE — three-lane execute (voice/browser/email), real Browser Use for NYT
- Tier 2a: NEXT — AgentMail replaces email lane mock
- Tier 2b: NEXT — Supermemory for persistent merchant playbooks
- Tier 2c: NEXT — Moss for in-call real-time retrieval (HIGHEST RISK)
- Tier 3: After 2a/2b/2c — polish, audit log, pitch deck

## Current channel reality
- Planet Fitness (voice): REAL via AgentPhone
- NYT (browser): REAL via Browser Use, stops at chat-handoff
- LA Fitness (email): MOCKED (60s scripted setTimeout) — Tier 2a replaces this

## Memory architecture (when 2b + 2c ship)
- Supermemory: persistent merchant knowledge. Written after calls.
  Synthesized into per-merchant playbooks. Queried before calls.
- Moss: in-call hot path. Loaded with playbook at call start. Queried
  on every rep turn. Returns <100ms.
- Handoff: Supermemory writes a curated playbook into Moss at call
  start. Moss serves it during the call. Supermemory ingests the
  transcript after.

## Demo merchants — channel reality check
- Planet Fitness (voice): REAL via AgentPhone
- NYT (browser): REAL via Browser Use

## Stack (locked)
**Frontend:** Next.js 15 App Router · Tailwind · shadcn/ui · Framer Motion · 
Geist Sans + Geist Mono · Lucide icons · dark mode only.

**Backend:** FastAPI on localhost:8000 · single-user in-memory state · 
AgentPhone (voice) · Browser Use Cloud SDK (browser) · Google Gmail OAuth.

## Design tokens (locked)
- bg: #0a0a0a · surface: #141414 · surface-elevated: #1c1c1c
- border: #262626 · border-strong: #404040
- text: #fafafa / #a3a3a3 / #737373
- accent: #10b981 (success/active) · warn: #f59e0b · error: #ef4444
- No serif. Geist Sans for UI, Geist Mono for IDs/timestamps/transcript.
- Rounded 8px cards, 6px buttons. Border 1px. No shadows except modals.

## Demo merchants (all curated, not classified)
- Planet Fitness — voice — real call via AgentPhone — REAL
- SiriusXM — voice — wired but disabled in demo
- NYT — browser — real cancel-flow navigation via Browser Use — REAL
- Adobe Creative Cloud — browser — wired but disabled in demo  
- Audible — browser — wired but disabled in demo

## Rules of engagement for Claude Code
- Read available skills before writing code.
- Web-search current docs before integrating any third-party service.
- Confirm plan with me before writing >100 lines.
- Build vertical slices: one feature working end-to-end before starting next.
- Comment any mocks explicitly so I can answer judge Q&A honestly.
- Don't touch the AgentPhone call flow or transcript SSE — they work, leave alone.
- Single-user demo. No Clerk. No Supabase. In-memory state is fine.

## My environment
- Local dev: Next.js on :3000, FastAPI on :8000
- Test phone: in `.env` (AGENTPHONE_PHONE_NUMBER)
- Google OAuth: configured, my email is the only test user
- I'm Keivalya — MS Robotics, can debug Python and TS, prefer concise responses

## Test commands
- Frontend: `cd frontend && pnpm dev`
- Backend: `cd backend && uvicorn main:app --reload`
- Don't add tests or CI to this repo.