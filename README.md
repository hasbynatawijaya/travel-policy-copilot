# Travel Policy Copilot

A company uploads its travel policy. An LLM turns it into structured rules. An admin approves each rule. A traveller then books through a chat, and a deterministic engine checks every option against the approved rules. Out-of-policy trips go to an approver.

**The design decision:** the LLM never decides compliance. It proposes rules, a human approves them, and plain tested code applies them.

## AI use

Claude Code wrote most of this codebase, and the Claude API runs the extraction and the chat. Hasby directs the work and reviews it. The build plan is kept outside this repo in `../docs/PLAN.md`; specs and agent configuration move into the repo with the eval work.

## Status (v1, in progress)

| Part | State |
|---|---|
| Rule types and Zod validation (closed set of five) | Done, unit tested |
| Deterministic policy engine (options and trips) | Done, unit tested |
| Postgres schema and repository (Drizzle) | Done, integration tested against Postgres 16 |
| Policy extraction with Claude (structured outputs) | Written, **not yet run against the live API** |
| Booking chat with tools and streaming | Written, **not yet run against the live API** |
| Admin rule review and approval queue | Done, builds and renders |
| Eval set and published accuracy | **Not started** (needs labelled policies, see below) |
| Deployment | Not started (planned for later) |
| Sign-in, rate limits, daily spend cap | **Not built.** Required before any public demo |

## How it works

- `src/lib/policy/rules.ts`: the five rule types (cabin class, flight price cap, hotel nightly cap by city tier, advance booking, approval required). The LLM output must match these shapes.
- `src/lib/policy/extract.ts`: sends the policy as data (not instructions), with structured outputs. It fails closed on refusal, truncation or a schema mismatch.
- `src/lib/policy/engine.ts`: `checkOption` and `checkTrip`. Pure functions, no LLM and no I/O. A hotel whose city tier has no cap is out of policy when the policy defines any hotel caps.
- `src/lib/chat/tools.ts`: search tools and `book_trip`. Each input is validated with Zod before it runs.
- `src/app/api/chat/route.ts`: streams one chat turn, runs tools in a bounded loop (max five rounds), checks `stop_reason` before running any tool.
- `src/lib/repo.ts`: all database access. Only approved rules reach the engine.

## Run it locally

Needs Node 24 and Postgres 16.

```sh
npm install
cp .env.example .env.local   # set DATABASE_URL
npx drizzle-kit migrate
npm run dev
```

The LLM features need `ANTHROPIC_API_KEY`. Without it, extraction and chat return errors. Everything else runs.

Checks: `npm run typecheck`, `npm test`, `npm run lint`, `npm run build`.

## Limits and known gaps

- Inventory is **synthetic** (`src/lib/inventory.ts`). No real supplier, payment or price is involved.
- All amounts are USD. Policies in another currency are not supported in v1.
- Approval queue and policy pages have no sign-in. Anyone with the link can approve.
- Editing a rule replaces its status only. Versioning of rule edits is not built.
- Uploaded files are not stored; the extracted policy text is.

## Eval (planned)

Target for v1: 15 policies, at least 5 real public ones and 10 synthetic. Precision and recall per rule type, with the misses listed. Labelled expected rules are written by the domain owner, not by the model that is being tested.
