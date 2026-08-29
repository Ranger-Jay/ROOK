# ROOK

**Resilient Operations Orchestration Kernel**

ROOK is an approval-gated AI incident commander built for the 2026 TrueForge Agent Harness Hackathon.

> **Investigate autonomously. Mutate only with human authority. Verify recovery with evidence.**

ROOK is built around one non-negotiable rule:

> **Never simulate proof. If a capability does not exist, remove the claim.**

`CLAIM → EVIDENCE → PUBLIC TRUTH`

## For judges

ROOK uses TrueForge as the actual agent runtime. Its interface promotes incident claims only when retained harness evidence satisfies the milestone-specific gate; unproven surrounding surfaces remain visibly `FIXTURE` or `DESIGN`.

Verify the repository without a TrueForge installation or model network call:

```bash
npm install
npm test
npm run tokens:check
npm run build
```

Review trail:

- **PR #5** — v0.002 authentic TrueForge session/turn boundary, merged.
- **PR #7** — v0.003 owned read-only MCP investigation, released and merged.
- **PR #12** — v0.004 TrueForge sandbox reproduction, active pre-release development.

The canonical demo incident is **Inventory Retry Storm**, an owned fictional non-production commerce stack used to prove the agent/evidence workflow without claiming production telemetry.

## Truth doctrine

ROOK preserves distinctions that agent interfaces often blur:

- **Observed ≠ inferred.** A retained tool result can be evidence; a causal explanation is still a conclusion.
- **Reproduced ≠ applied.** Code execution in a sandbox is not remediation.
- **Proposed ≠ approved.** A recommendation has no mutation authority.
- **Applied ≠ verified.** Executing a change is not proof of recovery.
- **Verified ≠ policy.** A demonstrated recovery does not silently become organizational policy.
- **AI proposes. Human authorizes.** Privileged mutation remains a human decision.
- **Green is earned.** Verified Green appears only after recovery evidence passes.

Functional claims move through:

`design intent → implemented → authentic run → cleared public claim`

## Released baseline — v0.003 ✅

`VERSION` on `main` is `v0.003`.

v0.003 authentically demonstrated:

```text
owned demo source
→ ROOK read-only MCP
→ TrueForge 0.1.3
→ local tool-capable Qwen model
→ get_retry_pressure
→ real tool.response
→ ROOK call/response correlation
→ OBSERVED owned-demo evidence
```

The authentic v0.003 proof used:

```text
connector: rook-inventory-retry-storm
model:     ollama-local/qwen2-5-1-5b
session:   01m17a7g48yk63nzcyenrf8pqt
turn:      01m17a7gq43apay5tppvhgtr4q.local
```

Observed owned-demo values were:

```text
retry multiplier:  5.3x
attempts/minute:   4,800
queue depth:       7,200
queue saturation:  91%
classification:    owned-demo-non-production
```

The v0.003 release passed exact-head CI and Qodo review before explicit human release/merge authority and PR #7 merge.

Historical procedure: [`docs/TRUEFORGE_V0.003.md`](./docs/TRUEFORGE_V0.003.md)

## Active milestone — v0.004 pre-release

Feature branch:

```text
feat/v0.004-sandbox-reproduction
```

PR #12 implements the next proof boundary:

```text
OBSERVED owned-demo MCP evidence
→ TrueForge sandbox creation
→ bounded deterministic exec
→ correlated sandbox tool.response
→ REPRODUCED evidence
```

v0.004 is **not released yet**. Authentic Daytona-backed sandbox capture remains a release requirement.

### v0.004 authority boundary

The configured TrueForge agent retains the v0.003 owned MCP attachment:

```text
server:      rook-inventory-retry-storm
enableTools: ["@read-only"]
preload:     true
```

The v0.004 runtime additionally enables the TrueForge sandbox while explicitly keeping unrelated authority disabled:

```text
sandbox:                    enabled
sandbox file downloads:     disabled
dynamic subagents:          disabled
ask-user tools:             disabled
Generative UI:              disabled
skills:                     none
incident mutation tools:    none
```

TrueForge 0.1.3 supports Daytona as its sandbox provider. ROOK does not treat sandbox execution as remediation authority.

### Exact reproduction evidence contract

The proof requires this ordering:

1. exactly one `get_retry_pressure` call from the owned read-only MCP;
2. matching MCP response on the same call/thread;
3. the payload must pass the owned-demo OBSERVED projector;
4. the retained OBSERVED numeric values must exactly match the deterministic reproduction-input contract;
5. exactly one public TrueForge system-tool call identified as `truefoundry-system / exec`;
6. exact bounded `intent` and `command` arguments, with no `cwd`, `env`, or extra keys;
7. exactly one real `sandbox.created` event;
8. matching sandbox `tool.response` on the same call/thread;
9. Daytona provider success, sandbox exit code `0`, and exact deterministic output;
10. exactly one successful `turn.done` with zero required actions;
11. no approval, auth pause, subagent, user-supplied tool response, or incident mutation activity.

Any drift fails closed.

The public UI cannot show the v0.004 success state until **both** projections exist:

```text
OBSERVED · OWNED DEMO MCP
REPRODUCED · TRUEFORGE SANDBOX
```

Success label:

```text
OBSERVED + REPRODUCED EVIDENCE
```

That label explicitly does **not** mean applied remediation or verified recovery.

### Execution-policy distinction

TrueForge owns its built-in sandbox execution inside Daytona. ROOK cannot intercept a model-issued sandbox shell command before TrueForge executes it.

ROOK's exact-command validation is therefore a **public-evidence acceptance gate**, not a pre-execution shell firewall. A command that drifts from the bounded proof contract cannot become valid v0.004 evidence.

### Qodo findings incorporated

PR #12 review has already converted substantive findings into guardrails:

- v0.004 live runtime was initially not wired and was corrected to use `V004TrueForgeHarnessAdapter` / `V004SdkTrueForgeTransport`;
- sandbox provider failure/non-zero exit initially could reach a successful adapter return and was corrected to fail closed;
- REPRODUCED evidence was initially not numerically bound to the retained OBSERVED values and was corrected so the adapter validates the owned-demo projection and exact reproduction inputs before permitting the sandbox evidence chain to advance.

Each correction is regression-tested. Final Qodo review is repeated on the exact release candidate head after authentic capture/documentation is complete.

Authentic v0.004 runbook: [`docs/TRUEFORGE_V0.004.md`](./docs/TRUEFORGE_V0.004.md)

## Local owned evidence stack

The owned non-production evidence source and MCP server remain:

```text
owned source:   http://127.0.0.1:8792
read-only MCP:  http://127.0.0.1:8791/mcp
```

Start and verify both:

```bash
npm run demo:stack
```

The owned MCP inventory is exactly:

1. `get_service_health`
2. `get_retry_pressure`
3. `get_deployment_history`
4. `get_dependency_topology`

Every owned tool is positively annotated read-only/non-destructive/idempotent/closed-world.

## Current verified Windows topology

The prior authentic proof on Old Faithful established this local topology:

```text
TrueForge:  http://localhost:8790
MCP:        http://127.0.0.1:8791/mcp
source:     http://127.0.0.1:8792
ROOK UI:    http://localhost:5173
Ollama:     local
model:      ollama-local/qwen2-5-1-5b
```

TrueForge 0.1.3 was observed binding IPv6 loopback (`[::1]:8790`), so `localhost` is the canonical TrueForge origin on that host. Fresh local state is rechecked before every authentic capture rather than assumed from an earlier run.

## Daytona requirement for v0.004

Pinned TrueForge 0.1.3 requires a server-side sandbox provider. Its registered provider is Daytona.

The first authentic attempt uses Daytona's official default snapshot:

```text
daytona-small
```

The Daytona API key is supplied only to the TrueForge server process through `SANDBOX_API_KEY`. It must never be committed, placed in `VITE_*`, posted to GitHub, or included in proof screenshots.

If the default snapshot cannot initialize the pinned TrueForge runtime, ROOK records the authentic failure and uses a dedicated compatible snapshot; it does not weaken or simulate the evidence contract.

## Milestone sequence

- **v0.001** — domain/safety foundation ✅
- **v0.002** — authentic TrueForge session/turn boundary ✅
- **v0.003** — owned read-only MCP investigation and live incident evidence ✅
- **v0.004** — authentic sandbox reproduction ← active pre-release
- **v0.005** — human approval + bounded authorized remediation
- **v0.006** — independent recovery verification + audit trail

Target end-to-end judge spine:

```text
failure
→ investigation
→ sandbox reproduction
→ bounded proposal
→ human approval pause
→ authorized execution
→ independent verification
→ verified recovery
→ audit/guardrail
```

Canonical lifecycle:

`DETECT → INVESTIGATE → SANDBOX → PROPOSE → APPROVE → EXECUTE → VERIFY → AUDIT`

## TrueForge is the runtime

ROOK uses the official `@truefoundry/trueforge-sdk` and retains harness evidence rather than treating TrueForge as branding around application logic.

Implemented boundaries include:

- real session creation and streamed turns;
- official SDK folding of streamed `model.message.delta` events;
- exact MCP provenance and tool-call IDs;
- correlated `tool.response` evidence;
- fail-closed event/capability drift handling;
- owned-demo public-truth projection;
- sandbox creation provenance;
- public `truefoundry-system / exec` provenance;
- sandbox call/response correlation;
- provider-success/zero-exit/result validation;
- separate OBSERVED and REPRODUCED truth states.

Human approval, mutation, and recovery verification remain later milestones until authentically demonstrated.

## Visual system

The canonical design doctrine is **Citadel Watch**:

- **70% Obsidian Watch** — product chassis/navigation/logs;
- **25% Citadel Glass** — evidence/approval/verification hierarchy;
- **5% Neon Bastion** — selective atmosphere.

Operational color semantics:

- Cyan — telemetry/intelligence
- Violet — AI orchestration and sandbox reproduction
- Gold — human authority only
- Red/Amber — incident/risk
- Green — evidence-backed recovery only

`design/design-tokens.json` is canonical; CI verifies generated token synchronization.

## Engineering workflow

Substantive work follows:

`branch → scoped commits → tests/CI → PR → Qodo review → fix/dismiss valid findings → Qodo follow-up → exact-head verification → human release/merge`

No substantive direct pushes to `main`.

See [`AGENTS.md`](./AGENTS.md), [`REVIEW.md`](./REVIEW.md), and [`docs/VERSIONING.md`](./docs/VERSIONING.md).

## AI assistance disclosure

AI coding and design assistants are used as development collaborators. Architecture decisions, evidence contracts, tests, Qodo findings, fixes, authentic capture, release authority, and merges remain human-governed and publicly reviewable in the repository trail.

## Status

**Released:** v0.003 on `main`.

**In development:** v0.004 on PR #12. Code/CI/Qodo review is advancing, but v0.004 remains pre-release until a real Daytona-backed TrueForge sandbox chain produces retained `OBSERVED + REPRODUCED EVIDENCE`, the final exact head clears review/CI, and a human authorizes release/merge.
