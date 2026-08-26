# AGENTS.md — ROOK Engineering Laws

These rules apply to every human or AI contributor working on ROOK.

## 1. Repository law

- `main` is protected by process even if branch protection is not technically enabled.
- No substantive work is committed directly to `main`.
- Every substantive change must arrive through a pull request reviewed by Qodo before merge.
- Valid High-severity Qodo findings must be fixed. If a High finding is invalid, dismiss it in the Qodo thread with a concise technical reason.
- Medium and Low findings are engineering judgments, but must be considered rather than ignored mechanically.
- After material fixes, request/verify Qodo follow-up review against the final code.
- Buddy Main verifies both CI and Qodo evidence before a substantive merge.
- The human participant retains final merge authority.

## 2. Commit law

Use coherent commits:

- `feat:` one product capability
- `test:` one test series or verification expansion
- `fix:` one defect or tightly related defect set
- `docs:` documentation only
- `ci:` build/verification infrastructure only
- `chore:` repository or release maintenance only

Do not create grab-bag commits that mix unrelated features, tests, fixes, and documentation.

## 3. Version law

Human-facing milestones use `v0.NNN`.

- Development branches use `v0.NNN-dev` in `VERSION`.
- A release/version commit removes `-dev` only after the release gate passes.
- npm SemVer maps `v0.001 → 0.1.0`, `v0.002 → 0.2.0`, and so on.

See `docs/VERSIONING.md`.

## 4. Safety law

ROOK may investigate autonomously. Production/demo-production mutation requires explicit human authorization.

A remediation must never execute merely because:

- an LLM recommended it;
- a subagent recommended it;
- a sandbox reproduction succeeded;
- a tool appears non-destructive by missing or ambiguous metadata;
- an action was previously authorized for a different scope.

Production authorization must be explicit, scoped to the exact action/resources, short-lived, auditable, and consumed only by the approved mutation path.

When tool sensitivity is ambiguous, **fail closed**.

## 5. Recovery law

**Applied ≠ verified.**

Execution success is not recovery success. ROOK may enter `verified` only after all required recovery checks pass with evidence. It may enter `resolved` only after verification and audit recording.

## 6. Visual-state law

The Citadel Watch color grammar is semantic:

- cyan = telemetry/intelligence;
- violet = AI orchestration;
- gold = human authority;
- red/amber = incident/risk;
- green = evidence-backed recovery only.

Do not use gold for decoration on sensitive flows. Do not use green for progress, execution started, or optimistic status.

## 7. Demo truth and authenticity law

**Never simulate proof. If a capability does not exist, remove the claim.**

Simulated, fixture, design-reference, or demo data must be clearly labeled until it is produced by the live TrueForge/MCP flow.

Never present mocked tool calls, sandbox work, approvals, subagent outcomes, execution, verification, or recovery evidence as live harness activity.

Every public functional claim must be no stronger than its retained evidence. Use the narrow verb that matches the earned state: observed, inferred, reproduced, proposed, authorized, applied, verified, candidate, or active.

A capability moves through claim confidence deliberately:

`design intent → implemented but not demonstrated → proven in an authentic run → cleared for public claim`

When evidence is incomplete, narrow or remove the claim rather than making the presentation more persuasive.

## 8. Secrets and data law

- Never commit model API keys, Qodo credentials, OAuth secrets, personal data, login-protected data, or private infrastructure data.
- `.env` files are ignored; `.env.example` contains names only.
- Demo integrations must touch only owned or explicitly permitted systems/data.

## 9. Scope law

The hackathon MVP is the Inventory Retry Storm vertical slice. New ideas are subordinate to completing that end-to-end job reliably and demonstrating TrueForge doing real work.

## 10. Human comprehension law

AI assistants may generate or review code, but the human participant must be able to explain the architecture, safety boundaries, tool behavior, and material technical decisions.

## 11. Lesson-to-Guardrail Law

**We are not merely learning intellectually; every legitimate lesson becomes a permanent guardrail in ROOK.**

When a review finding, defect, incident, failed assumption, adversarial test, or implementation mistake exposes a repeatable failure mode, convert the lesson into durable protection before considering the issue complete.

Prefer executable guardrails over prose alone:

- code defect → invariant, validation, or safer abstraction;
- regression risk → automated regression test;
- build/tooling failure → CI or static check;
- architecture/safety lesson → domain boundary plus tests, and update doctrine when needed;
- workflow failure → repository/process automation or an explicit gate;
- reviewer false positive → preserve the technical rationale; do not encode an incorrect workaround merely to satisfy a tool.

A finding is not fully learned if the same class of mistake can silently recur.

Durable learning does **not** grant standing authority. A verified lesson may produce a **Guardrail Candidate**, but a candidate that changes active enforcement policy remains inactive until separately authorized by a human with the exact policy diff, scope, and rollback visible. **Learning is not authority.**
