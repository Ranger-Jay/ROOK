# ROOK

**Resilient Operations Orchestration Kernel**

ROOK is an approval-gated AI incident commander built for the 2026 TrueForge Agent Harness Hackathon.

It is designed around one operational contract:

> **Investigate autonomously. Mutate only with human authority. Verify recovery with evidence.**

The canonical demo is the **Inventory Retry Storm**: a faulty retry/backoff deployment in a fictional commerce stack saturates shared infrastructure, degrades checkout, and requires ROOK to investigate, reproduce the fault safely, propose a bounded remediation, stop for human authorization, execute only the approved action, and independently verify recovery.

## ROOK Truth Doctrine

ROOK is not designed to appear autonomous. ROOK is designed to make autonomy accountable.

> **Never simulate proof. If a capability does not exist, remove the claim.**

ROOK's communication contract is:

`CLAIM → EVIDENCE → PUBLIC TRUTH`

The state model deliberately preserves distinctions that persuasive interfaces often blur:

- **Proposed ≠ Approved.** A recommendation is not authority.
- **Applied ≠ Verified.** Execution is not recovery.
- **Verified ≠ Policy.** A proven lesson is not automatically active enforcement.
- **AI proposes. Human authorizes.** Privileged mutation remains a human decision.
- **Green is earned.** Verified Green appears only after required recovery evidence passes.

Functional claims advance only as evidence advances: **design intent → implemented but not demonstrated → proven in an authentic run → cleared for public claim**. Fixture and reference surfaces remain labeled until authentic TrueForge evidence replaces them.

For governed learning, a verified lesson may become a **Guardrail Candidate**. Any activation that changes active enforcement policy requires a separate human-authority decision.

## Current milestone

`v0.001-dev` — project foundation, incident lifecycle contract, command-center shell, CI, and TrueForge integration boundary.

## TrueForge role

TrueForge is the agent runtime, not a decorative wrapper. ROOK will use the harness for:

- persistent agent sessions;
- real MCP tool access;
- isolated sandbox execution;
- human approval checkpoints;
- delegated subagents;
- context/session continuity.

ROOK's React interface is the operational command surface around that harness work.

## Canonical incident flow

`DETECT → INVESTIGATE → DELEGATE → SANDBOX → PROPOSE → APPROVE → EXECUTE → VERIFY → AUDIT`

Two product laws are non-negotiable:

1. **Applied ≠ verified.** Execution never implies recovery.
2. **Green is earned.** Verified Green appears only after required recovery checks pass.

## Visual system

The canonical visual doctrine is **Citadel Watch**:

- **70% Obsidian Watch** — product chassis, navigation, tables, logs;
- **25% Citadel Glass** — signature hierarchy, evidence, approval, verification;
- **5% Neon Bastion** — selective launch/social atmosphere.

Operational color semantics:

- Cyan — telemetry and intelligence
- Violet — AI orchestration
- Gold — human authority only
- Red/Amber — incident and risk
- Green — evidence-backed recovery only

`design/design-tokens.json` is the single canonical token source. `scripts/generate-tokens.mjs` deterministically generates the application token and typography CSS, and CI fails closed on unmapped, missing, or stale generated tokens.

## Engineering workflow

Every substantive change follows:

`branch → scoped commits → tests/CI → pull request → Qodo review → resolve/dismiss findings → Qodo follow-up → Buddy Main verifies Qodo + CI → human merge`

No substantive direct pushes to `main`.

See [`AGENTS.md`](./AGENTS.md) and [`docs/VERSIONING.md`](./docs/VERSIONING.md) for the governing development rules.

## Qodo Code Review Evidence

- **Initial review-chain verification:** [PR #2 — chore: verify Qodo review workflow](https://github.com/Ranger-Jay/ROOK/pull/2). This was intentionally non-substantive and closed without merge after Qodo automatically completed its review with no material findings.
- **Representative merged substantive review:** [PR #3 — v0.001 foundation, safety contract, and command shell](https://github.com/Ranger-Jay/ROOK/pull/3). Qodo identified real lifecycle and provenance failure modes around authorization replay/binding, one-time authorization claims, evidence-backed verification, and audit provenance. The valid findings became fail-closed invariants and regression tests. An unsupported Vite configuration recommendation was challenged with evidence rather than implemented mechanically. Qodo's follow-up review on the final PR head reported no remaining High-severity blocker before merge.

The public PR discussion is the canonical evidence trail; screenshots may supplement it but do not replace it.

## AI assistance disclosure

AI coding and design assistants are used as development collaborators. Material implementation decisions, test results, Qodo findings, fixes, architecture choices, and final merges are reviewed and owned by the human participant.

## Status

Active hackathon development. Setup instructions will be expanded as the runnable TrueForge integration lands.
