# ALWALAA OS — AGENTIC CODING CAPABILITY LAYER (append-only)

This layer extends the existing engineering rules for the Alwalaa business-ops-system.
It adds capability layers for coding this repo and MUST NEVER override, weaken, or
contradict any existing safety, security, scope, or behavior rule above — RLS as a
security boundary, PII/KYC handling, secret and service-account rules, the
typecheck + vitest + build gate, and migration reversibility. Where anything here
conflicts with an existing rule, the existing rule takes precedence.

## Stack context (what "the system" means here)
Next.js 15 (App Router) · TypeScript strict · Tailwind · Supabase/Postgres + RLS ·
Prisma · Deno edge functions · Vercel · GitHub · n8n. Domain: listings, units,
projects, leads, deals; the department-copilot Anthropic tool-loop
(`src/app/api/copilot`, `src/app/_departments/config.ts`); the Drive→DB sync;
bilingual EN/AR + RTL; money as numeric OMR; area canonical in sqm;
ITC / Golden Residency / KYC.

## Architectural priority — operate as four levels; weight effort toward real value
- **Level 1 — Backbone (domain capability + codified skills): highest value.**
  Correct, tested domain logic — data models, RLS correctness, migrations, API route
  handlers, the copilot tool-loop, the sync jobs — plus the reusable pattern library
  that encodes how THIS repo builds (the `alwalaa-*` skills and repo conventions).
  Effort goes here first.
- **Level 2 — Memory & State (the database + repo knowledge): second highest.**
  The Postgres schema is the system of record; migrations, Prisma models, the
  `_departments` config, ADRs, and repo conventions are memory. Read them before
  acting; write back after.
- **Level 3 — Visual wrapper / interface: presentation only.**
  The UI, the dark-gold design system, dashboards, the copilot chat surface.
  Never let it take precedence over Levels 1–2.
- **Level 4 — Distribution / handoff: packaging only.**
  Deploys, seeds, runbooks, making the copilot usable by non-technical staff.
  Secondary to underlying capability.

Never let a dashboard, a nice screen, or a green deploy substitute for real
capability: correct data, correct RLS, a correct tool-loop, passing tests.

## Skill codification
Treat any coding task performed more than once as a candidate to formalize — a shared
util, a typed helper, a generator, a lint rule, a test factory, or a new `alwalaa-*`
skill. When you notice a recurring multi-step pattern, surface it explicitly as:
`task → expected output → proposed skill`.
On request, run a workflow audit: review recent PRs/sessions, extract repeated patterns
not yet abstracted, and return them as a structured table of candidates.

## Memory & state discipline
Before writing code, consult the system of record and repo memory: inspect the current
schema (list tables / existing migrations), Prisma models, the `_departments` config,
RLS policies, and any ADRs or conventions — do not regenerate knowledge that already
exists. After a significant change, write it back as durable state: the migration file,
updated types, a short decision record, and at least one test. Prefer reading and
extending existing patterns over reinventing them.

## Loop engineering
Treat repeated work as improvable loops, not one-offs. Every failure is data: turn a
caught bug into a lint rule or a regression test so it cannot recur. After each
significant run, log what worked, what failed, and why. Before repeating similar work,
review prior iterations and apply the lessons. Keep the typecheck + vitest + build gate
green as the loop's exit condition — each run should leave the gate stronger, not weaker.

## Distribution & handoff
Design outputs to be triggered simply — clear npm scripts, one-command deploy/seed,
obvious entry points. Where appropriate, package work as portable, self-contained pieces
(edge functions, seed scripts, the copilot) that a non-technical staff member can use
without deep setup. Minimize onboarding friction and document the entry point.

## Value check
For any proposed feature or effort, ask: does this strengthen Levels 1–2 (real
capability — correct data, logic, security, tests) or only Levels 3–4 (presentation /
packaging)? Prioritize accordingly, and say so explicitly when it's a close call.
