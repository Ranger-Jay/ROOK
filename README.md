# ROOK

**Resilient Operations Orchestration Kernel**

ROOK is an approval-gated AI incident commander built for the 2026 TrueForge Agent Harness Hackathon.

Its operational contract is simple:

> **Investigate autonomously. Mutate only with human authority. Verify recovery with evidence.**

The canonical demo is the **Inventory Retry Storm**: a faulty retry/backoff deployment in a fictional commerce stack creates retry pressure on shared infrastructure. ROOK is being built milestone-by-milestone so every public capability claim has a real evidence chain behind it.

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

`v0.003-dev` — owned read-only MCP incident investigation and evidence correlation.

### Released baseline: v0.002

PR #5 established and authentically demonstrated:

- real local TrueForge session creation;
- real streamed model turn;
- same-origin ROOK → TrueForge browser transport;
- source event IDs/timestamps/sequence/thread provenance;
- exactly one terminal `turn.done`;
- fail-closed handling of malformed or unexpected capability events;
- explicit separation between live harness evidence and fixture incident data.

v0.002 is now the released baseline on `main`.

### Implemented on v0.003 PR #7

ROOK now contains an owned non-production demo evidence stack:

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
```

and explicitly disables unrelated default capabilities:

- sandbox;
- dynamic subagents;
- ask-user-question tools;
- Generative UI;
- skills;
- mutation authority.

### v0.003 evidence gate

A text response is not enough.

The live investigation can pass only after ROOK retains and correlates:

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

v0.003 is **implemented but not yet released**.

The release gate remains closed until an authentic local run demonstrates:

`owned demo source → MCP → TrueForge tool call → tool.response → ROOK retained evidence → evidence-backed UI`

Passing unit tests or CI does not substitute for that capture.

After authentic capture, PR #7 still requires exact-head CI/Qodo review and Jay's human release/merge decision before `VERSION` can move from `v0.003-dev` to `v0.003`.

## Run the v0.003 local proof

The complete procedure is documented in:

[`docs/TRUEFORGE_V0.003.md`](./docs/TRUEFORGE_V0.003.md)

High-level local topology:

### 1. Install

```bash
npm install
```

### 2. Start the owned demo source

```bash
npm run demo:source
```

Source:

```text
http://127.0.0.1:8792
```

### 3. Start the read-only MCP server

```bash
npm run demo:mcp
```

MCP endpoint:

```text
http://127.0.0.1:8791/mcp
```

### 4. Register the MCP connector in TrueForge

Use:

**Settings → Connectors → Add MCP Server**

```text
Name: rook-inventory-retry-storm
Description: ROOK owned non-production read-only Inventory Retry Storm evidence source
URL: http://127.0.0.1:8791/mcp
Auth type: None
```

### 5. Configure the non-secret ROOK local environment

```text
VITE_TRUEFORGE_URL=http://127.0.0.1:8790
VITE_TRUEFORGE_MODEL=<exact configured TrueForge model identifier>
```

Never place API keys, tokens, passwords, or other credentials in `VITE_*` variables.

### 6. Start ROOK

```bash
npm run dev
```

In the ROOK command surface choose **Run read-only investigation**.

A successful authentic capture must show `LIVE READ-ONLY MCP EVIDENCE`, the evidence-backed retry-pressure card, source event provenance, and exactly one terminal `turn.done`.

## Milestone sequence

- **v0.001** — domain/safety foundation and command shell
- **v0.002** — authentic TrueForge session/turn boundary ✅
- **v0.003** — owned read-only MCP investigation and live incident evidence ← current
- **v0.004** — sandbox reproduction and delegated investigators
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
- **PR #7** — active v0.003 read-only MCP investigation review trail. The first Qodo Medium finding identified inadequate code-level demo labeling; it was accepted, fixed, regression-locked, and resolved.

The public PR discussion is the canonical review evidence trail. Screenshots supplement it but do not replace it.

## AI assistance disclosure

AI coding and design assistants are used as development collaborators. Material implementation decisions, tests, Qodo findings, fixes, architecture choices, authentic capture evidence, and final merges remain human-governed.

## Status

Active hackathon development. `v0.003-dev` is implemented on PR #7 and remains pre-release until authentic local MCP capture plus final exact-head CI/Qodo review satisfy the release gate.
