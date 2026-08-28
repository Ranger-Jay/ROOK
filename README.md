# ROOK

**Resilient Operations Orchestration Kernel**

ROOK is an approval-gated AI incident commander built for the 2026 TrueForge Agent Harness Hackathon.

It is designed around one operational contract:

> **Investigate autonomously. Mutate only with human authority. Verify recovery with evidence.**

## For judges

ROOK is an approval-gated AI incident commander built on TrueForge for the 2026 Agent Harness Hackathon. It is designed so that no incident claim reaches the interface unless retained harness evidence supports it; everything else stays visibly labeled `FIXTURE`.

Verify the build with no TrueForge installation and no network calls to a model:

```bash
npm install
npm test
```

That runs the same checks CI runs: canonical design-token synchronization, the unit suite, TypeScript, and the production build.

- **Representative merged pull request** (hackathon submission requirement): [PR #5 — v0.002 live TrueForge session and evidence boundary](https://github.com/Ranger-Jay/ROOK/pull/5), merged into `main`.
- **Active review trail, open and not merged:** [PR #7 — v0.003 owned MCP demo stack and read-only incident investigation](https://github.com/Ranger-Jay/ROOK/pull/7).

`main` carries released milestones only. `VERSION` on `main` is `v0.002`: a real local TrueForge session and streamed-turn evidence boundary. Owned read-only MCP investigation is in development on PR #7 and is not claimed as released here.

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

`v0.002` — real local TrueForge session/turn boundary, evidence normalization, and live harness-proof surface. Released and merged into `main`.

The implementation is intentionally narrower than the finished ROOK vision:

- v0.002 can observe a real local TrueForge session response and streamed text-only turn;
- the Inventory Retry Storm telemetry/topology/agent state remains explicitly labeled fixture data;
- owned read-only MCP investigation begins in v0.003;
- sandbox reproduction begins in v0.004;
- human-authorized remediation begins in v0.005;
- recovery verification/audit begins in v0.006.

A successful v0.002 harness proof therefore establishes **TrueForge connection evidence only**. It does not prove incident telemetry, MCP tool access, sandbox execution, remediation, or recovery.

## TrueForge role

TrueForge is the agent runtime, not a decorative wrapper.

### Implemented in v0.002

- official `@truefoundry/trueforge-sdk` session creation;
- streamed TrueForge turns;
- source event IDs, source timestamps when supplied, stream sequence, thread identity, and ROOK observation time;
- explicit terminal-turn evidence requirement;
- fail-closed protocol validation;
- strict local no-login browser boundary;
- inline model-only agent with no MCP tools, skills, sandbox configuration, or mutation authority.

### Reserved for later milestones

ROOK will use TrueForge for:

- owned MCP tool access;
- isolated sandbox execution;
- human approval checkpoints;
- delegated subagents;
- context/session continuity tied to authentic incident evidence.

ROOK's React interface is the operational command surface around that harness work.

See [`docs/TRUEFORGE_V0.002.md`](./docs/TRUEFORGE_V0.002.md) for the exact connection-proof procedure and evidence interpretation.

## Run the v0.002 local harness proof

### 1. Install ROOK

```bash
npm install
```

### 2. Start a local TrueForge runtime

Use TrueForge's documented local no-login mode on the local machine. Its default origin is:

```text
http://127.0.0.1:8790
```

Configure an actual model in that local TrueForge installation before attempting the proof.

### 3. Create a local environment file

Copy the non-secret placeholders from `.env.example` into `.env.local`:

```text
VITE_TRUEFORGE_URL=http://127.0.0.1:8790
VITE_TRUEFORGE_MODEL=provider/model-name
```

`VITE_*` variables are browser-visible. **Never place API keys, OIDC tokens, passwords, or other credentials in them.** v0.002 intentionally supports only TrueForge's local no-login mode.

### 4. Start ROOK

```bash
npm run dev
```

Open the Vite URL and use **Observe live harness** in the TrueForge evidence panel.

The panel can become `LIVE HARNESS OBSERVED` only after ROOK receives:

1. a real TrueForge session resource response; and
2. exactly one terminal `turn.done` observation from the streamed turn.

The panel exposes the session ID and normalized source-event evidence. The surrounding incident screen remains labeled `FIXTURE INCIDENT DATA` until later milestones replace those surfaces with authentic owned-system evidence.

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
- **v0.001 foundation:** [PR #3 — v0.001 foundation, safety contract, and command shell](https://github.com/Ranger-Jay/ROOK/pull/3). Qodo identified real lifecycle and provenance failure modes around authorization replay/binding, one-time authorization claims, evidence-backed verification, and audit provenance. The valid findings became fail-closed invariants and regression tests. Qodo's follow-up review on the final PR head reported no remaining High-severity blocker before merge.
- **v0.001 visual integration:** [PR #4 — Citadel Watch v1.1](https://github.com/Ranger-Jay/ROOK/pull/4). Qodo identified runtime brand-token drift; the fix moved the runtime mark back onto semantic design tokens. Final review reported no High- or Medium-severity blocker before merge.
- **v0.002 TrueForge runtime — representative merged pull request:** [PR #5 — v0.002 live TrueForge session and evidence boundary](https://github.com/Ranger-Jay/ROOK/pull/5), merged into `main`. Qodo's initial review reported eight bugs and one evidence-vocabulary rule violation, including High-severity findings around unknown-event compatibility, fabricated session provenance, and incomplete-stream readiness. Each valid finding was fixed on the branch in dedicated `fix:`/`test:` commits and converted into regression coverage rather than review-only commentary; Qodo's follow-up review on the final head reported no remaining High/Medium merge blocker before merge.
- **v0.003 read-only MCP investigation — active review trail, open and not merged:** [PR #7 — v0.003 owned MCP demo stack and read-only incident investigation](https://github.com/Ranger-Jay/ROOK/pull/7). Qodo raised a non-production data-labeling rule violation, a proof-contract gap where the stated `get_retry_pressure` exactly-once requirement was not enforced by the adapter, and a Medium finding where existing-connector validation did not reject extra manifest properties. Each was accepted, fixed, regression-locked, and re-reviewed on the exact head; Qodo's most recent follow-up review reported no remaining High/Medium release blocker.

The public PR discussion is the canonical evidence trail; screenshots may supplement it but do not replace it.

## AI assistance disclosure

AI coding and design assistants are used as development collaborators. Material implementation decisions, test results, Qodo findings, fixes, architecture choices, and final merges are reviewed and owned by the human participant.

## Status

Active hackathon development. `main` carries the released `v0.002` milestone, merged through [PR #5](https://github.com/Ranger-Jay/ROOK/pull/5). The v0.003 owned read-only MCP investigation milestone is implemented on [PR #7](https://github.com/Ranger-Jay/ROOK/pull/7) and remains pre-release until its own milestone evidence gate is satisfied.
