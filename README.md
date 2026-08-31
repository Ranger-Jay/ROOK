# ROOK

**Resilient Operations Orchestration Kernel**

ROOK is an approval-gated AI incident commander built for the 2026 TrueForge Agent Harness Hackathon.

Its operational contract is simple:

> **Investigate autonomously. Mutate only with human authority. Verify recovery with evidence.**

## For judges

ROOK is an approval-gated AI incident commander built on TrueForge for the 2026 Agent Harness Hackathon. It is designed so that no incident claim reaches the interface unless retained harness evidence supports it; everything else stays visibly labeled `FIXTURE`.

Verify the build with no TrueForge installation and no network calls to a model:

```bash
npm install
npm test
```

`npm test` runs the unit suite. For the remaining CI checks, run `npm run tokens:check` and `npm run build`.

- **Representative merged pull request** (hackathon submission requirement): [PR #5 - v0.002 live TrueForge session and evidence boundary](https://github.com/Ranger-Jay/ROOK/pull/5), merged into main.
- **v0.003 review/release trail:** [PR #7 - owned MCP demo stack and read-only incident investigation](https://github.com/Ranger-Jay/ROOK/pull/7).

ROOK releases milestones through reviewed pull requests. PR #7 carries `v0.003`: authentic local MCP proof passed, the final substantive code passed exact-head CI and Qodo review, and human release authority was granted before the release metadata was promoted.

Current v0.003 proof is intentionally narrow: owned demo source -> read-only MCP -> TrueForge model tool call -> correlated tool.response -> evidence-backed UI. Sandbox, subagents, approval, mutation, remediation, and recovery remain later milestones and are not claimed by v0.003.

The canonical demo is the **Inventory Retry Storm**: a faulty retry/backoff deployment in a fictional commerce stack creates retry pressure on shared infrastructure. ROOK is built milestone-by-milestone so every public capability claim has a real evidence chain behind it.

## ROOK Truth Doctrine

ROOK is not designed to appear autonomous. ROOK is designed to make autonomy accountable.

> **Never simulate proof. If a capability does not exist, remove the claim.**

`CLAIM → EVIDENCE → PUBLIC TRUTH`

The state model preserves distinctions that persuasive interfaces often blur:

- **Observed ≠ inferred.** A tool result is evidence; a causal explanation is a conclusion.
- **Proposed ≠ approved.** A recommendation is not authority.
- **Applied ≠ verified.** Execution is not recovery.
- **Verified ≠ policy.** A proven lesson is not automatically active enforcement.
- **AI proposes. Human authorizes.** Privileged mutation remains a human decision.
- **Green is earned.** Verified Green appears only after required recovery evidence passes.

Functional claims advance only as evidence advances:

`design intent → implemented → authentic run → cleared public claim`

Fixture and reference surfaces remain labeled until authentic TrueForge evidence replaces them.

## Current milestone

`v0.003` — owned read-only MCP incident investigation and evidence correlation.

### Released baseline: v0.002

PR #5 established and authentically demonstrated:

- real local TrueForge session creation;
- real streamed model turn;
- same-origin ROOK → TrueForge browser transport;
- source event IDs/timestamps/sequence/thread provenance;
- exactly one terminal `turn.done`;
- fail-closed handling of malformed or unexpected capability events;
- explicit separation between live harness evidence and fixture incident data.

v0.002 remains the historical released baseline from which v0.003 was developed.

### Implemented on v0.003 PR #7

ROOK contains an owned non-production demo evidence stack:

```text
owned demo source :8792
        │ read-only GET
        ▼
ROOK MCP server :8791/mcp
        │ Streamable HTTP MCP
        ▼
TrueForge :8790
        │ model tool call + tool.response
        ▼
ROOK evidence contract
        │ correlated provenance
        ▼
evidence-backed retry-pressure surface
```

The owned MCP server exposes exactly:

1. `get_service_health`
2. `get_retry_pressure`
3. `get_deployment_history`
4. `get_dependency_topology`

Every tool declares:

- `readOnlyHint: true`
- `destructiveHint: false`
- `idempotentHint: true`
- `openWorldHint: false`

The TrueForge v0.003 agent attaches only the configured server `rook-inventory-retry-storm` with:

```text
enableTools: ["@read-only"]
preload: true
```

Eager preload is required for the verified local Qwen tool-call path, but authority remains bounded by the named connector and positive `@read-only` selector. Unrelated default capabilities remain disabled:

- sandbox;
- dynamic subagents;
- ask-user-question tools;
- Generative UI;
- skills;
- mutation authority.

### v0.003 evidence gate

A text response is not enough.

The live investigation passes only after ROOK retains and correlates:

1. a settled TrueForge `model.message` MCP tool call;
2. its call ID, tool name, server identity, raw arguments, thread, source event ID/timestamp, and stream sequence;
3. the matching `tool.response` linked by `toolCallId`;
4. matching thread identity;
5. exactly one successful `turn.done`;
6. zero required actions;
7. no approval, auth pause, sandbox, subagent, user-supplied response, or mutation activity.

For the first promoted incident surface, the response must additionally prove:

```text
source.system = rook-owned-demo-source
source.scenarioId = inventory-retry-storm-v1
source.classification = owned-demo-non-production
source.kind = retry-pressure
```

Only then may the UI display the observed retry-pressure card. All surrounding incident fields remain explicitly **FIXTURE** until they cross their own evidence gate.

## Release status

v0.003 has satisfied its substantive release gates:

- authentic local proof demonstrated `owned demo source → MCP → TrueForge tool call → tool.response → ROOK retained evidence → evidence-backed UI`;
- the feature branch was reconciled with current `main` and remained mergeable;
- the final substantive head passed CI;
- Qodo reported 0 bugs, 0 rule violations, and 0 skill findings, with the earlier Medium finding resolved;
- human release authority was explicitly granted.

`VERSION` is therefore promoted to `v0.003`. The release metadata commit is rechecked by CI/Qodo before PR #7 is merged into `main`.

## Run the v0.003 local proof

The complete procedure is documented in:

[`docs/TRUEFORGE_V0.003.md`](./docs/TRUEFORGE_V0.003.md)

High-level local topology:

### 1. Install

```bash
npm install
```

### 2. Start the owned proof stack

```bash
npm run demo:stack
```

This starts and verifies:

```text
owned demo source: http://127.0.0.1:8792
read-only MCP:     http://127.0.0.1:8791/mcp
```

### 3. Configure the TrueForge connector

With TrueForge 0.1.3 running locally, use:

```bash
ROOK_TRUEFORGE_URL=http://localhost:8790 npm run demo:trueforge-setup
```

The helper validates/creates the exact no-auth connector manifest. TrueForge 0.1.3 on the verified Windows runtime does not expose the SDK connector-tools listing route, so the helper does not use that unavailable endpoint. The owned MCP inventory is independently verified by `demo:stack`, while the authentic TrueForge turn proves the connector/model can invoke the bounded tool surface.

### 4. Configure the non-secret ROOK local environment

```text
VITE_TRUEFORGE_URL=http://localhost:8790
VITE_TRUEFORGE_MODEL=<exact configured TrueForge model identifier>
```

Never place API keys, tokens, passwords, or other credentials in `VITE_*` variables.

### 5. Start ROOK

```bash
npm run dev
```

In the ROOK command surface choose **Run read-only investigation**.

A successful authentic capture shows `LIVE READ-ONLY MCP EVIDENCE`, the evidence-backed retry-pressure card, source event provenance, and exactly one terminal `turn.done`.

## Milestone sequence

- **v0.001** — domain/safety foundation and command shell
- **v0.002** — authentic TrueForge session/turn boundary ✅
- **v0.003** — owned read-only MCP investigation and live incident evidence ✅
- **v0.004** — sandbox reproduction and delegated investigators ← next
- **v0.005** — human approval and bounded authorized remediation
- **v0.006** — independent recovery verification and audit trail

Canonical incident flow:

`DETECT → INVESTIGATE → DELEGATE → SANDBOX → PROPOSE → APPROVE → EXECUTE → VERIFY → AUDIT`

## TrueForge role

TrueForge is the agent runtime, not a decorative wrapper.

ROOK uses the official `@truefoundry/trueforge-sdk` and makes harness work visible in the command surface.

Current authentic/implemented boundaries include:

- session creation and streamed turns;
- model/source event provenance;
- owned MCP attachment by configured connector name;
- positive `@read-only` tool selection;
- bounded eager preload for the verified local model path;
- official SDK folding of streamed model-message deltas before normalization;
- retained MCP tool-call provenance;
- retained `tool.response` evidence;
- one-to-one call/response correlation;
- fail-closed capability drift detection;
- explicit public-truth projection for owned non-production demo evidence.

Later milestones add sandbox execution, delegated subagents, approval checkpoints, bounded mutation, and recovery verification only when each capability has its own evidence gate.

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

`design/design-tokens.json` is the canonical token source. CI verifies generated token synchronization before tests/build.

## Engineering workflow

Every substantive change follows:

`branch → scoped commits → tests/CI → pull request → Qodo review → resolve/dismiss findings → Qodo follow-up → Buddy Main exact-head verification → human merge`

No substantive direct pushes to `main`.

See [`AGENTS.md`](./AGENTS.md), [`REVIEW.md`](./REVIEW.md), and [`docs/VERSIONING.md`](./docs/VERSIONING.md).

## Qodo Code Review Evidence

- **PR #2** — intentionally non-substantive Qodo workflow verification; closed without merge.
- **PR #3** — v0.001 foundation. Qodo findings around authorization replay/binding, one-time claims, evidence-backed verification, and audit provenance became regression-tested invariants.
- **PR #4** — Citadel Watch integration. Qodo found runtime token drift; the fix restored semantic design-token use.
- **PR #5** — v0.002 TrueForge runtime. Qodo findings around provenance, terminal streams, local credential boundaries, malformed events, and truth vocabulary became code/test guardrails before authentic proof and merge.
- **PR #7** — v0.003 read-only MCP investigation and release trail. The first Qodo Medium finding identified inadequate code-level demo labeling; it was accepted, fixed, regression-locked, and resolved. The final substantive review reported no remaining findings.

The public PR discussion is the canonical review evidence trail. Screenshots supplement it but do not replace it.

## AI assistance disclosure

AI assistants were used as development collaborators, testing and code review. Coding, material implementation decisions, Qodo findings, fixes, architecture choices, authentic capture evidence, release authority, and final merges remain human-governed.

## Status

`v0.003` is the current release milestone carried by PR #7. Its authentic proof, substantive CI/Qodo review, and human release-authority gates were satisfied before merge; the release metadata commit receives the final exact-head verification before entering `main`.
