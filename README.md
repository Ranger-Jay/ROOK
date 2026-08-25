# ROOK

**Resilient Operations Orchestration Kernel**

ROOK is an approval-gated AI incident commander built for the 2026 TrueForge Agent Harness Hackathon.

It is designed around one operational contract:

> **Investigate autonomously. Mutate only with human authority. Verify recovery with evidence.**

The canonical demo is the **Inventory Retry Storm**: a faulty retry/backoff deployment in a fictional commerce stack saturates shared infrastructure, degrades checkout, and requires ROOK to investigate, reproduce the fault safely, propose a bounded remediation, stop for human authorization, execute only the approved action, and independently verify recovery.

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

## Engineering workflow

Every substantive change follows:

`branch → scoped commits → tests/CI → pull request → Qodo review → resolve/dismiss findings → Qodo follow-up → Buddy Main verifies Qodo + CI → merge`

No substantive direct pushes to `main`.

See [`AGENTS.md`](./AGENTS.md) and [`docs/VERSIONING.md`](./docs/VERSIONING.md) for the governing development rules.

## Qodo Code Review Evidence

- **Initial review-chain verification:** [PR #2 — chore: verify Qodo review workflow](https://github.com/Ranger-Jay/ROOK/pull/2). This was intentionally non-substantive and closed without merge after Qodo automatically completed its review with no material findings.
- **Representative merged substantive PR:** _Pending first v0.001 merge._

This section will be updated throughout the hackathon with meaningful merged PR evidence, Qodo findings, engineering decisions, and follow-up review results.

## AI assistance disclosure

AI coding and design assistants are used as development collaborators. Material implementation decisions, test results, Qodo findings, fixes, architecture choices, and final merges are reviewed and owned by the human participant.

## Status

Active hackathon development. Setup instructions will be expanded as the runnable TrueForge integration lands.
