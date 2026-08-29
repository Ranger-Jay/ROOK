# Architecture — v0.003-dev

## Product boundary

ROOK is an incident-command application around a real TrueForge agent runtime.

```text
ROOK React command surface
        │
        ▼
ROOK harness adapter
        │
        ▼
TrueForge session / agent loop
   ├── owned read-only MCP tools (v0.003)
   ├── Sandbox execution (v0.004+)
   ├── Subagents (v0.004+)
   ├── Human approval checkpoints (v0.005+)
   └── Persistent session context
```

The UI must make harness work visible as each capability becomes authentic.

ROOK must never let one authentic layer launder another simulated layer into a live claim. v0.003 therefore allows a specific read-only MCP observation to become live evidence while unrelated Inventory Retry Storm metrics, topology, investigators, and progression remain explicitly fixture data.

`CLAIM → EVIDENCE → PUBLIC TRUTH`

`Observed ≠ Inferred · Proposed ≠ Approved · Applied ≠ Verified · Verified ≠ Policy`

## Canonical demo: Inventory Retry Storm

The Inventory Retry Storm is an owned, fictional, non-production scenario.

The current v0.003 source contains:

- `inventory-api`;
- `checkout-api`;
- `fulfillment-worker`;
- `inventory-retry-queue`;
- `inventory-cache`;
- deterministic service-health observations;
- deterministic retry-pressure observations;
- deployment/config history;
- dependency topology.

The scenario models an aggressive retry/backoff change that raises retry pressure on shared infrastructure. Causal synthesis remains **inferred** unless ROOK visibly retains the observations supporting it.

No third-party production system is read or modified.

## Released v0.002 boundary

v0.002 established the real TrueForge session/turn transport:

```text
ROOK browser
    │ /__rook_trueforge/api/v1/...
    ▼
Vite dev / preview proxy
    │ validated credential-free loopback target
    ▼
TrueForge :8790
    │ SDK REST + SSE
    ▼
real session + streamed turn evidence
```

The configured TrueForge target is restricted to credential-free HTTP `localhost` / `127.0.0.1`. Browser SDK traffic remains same-origin through the dedicated Vite proxy.

v0.002 authentic proof requires a real session response and exactly one terminal `turn.done`. A proxy response alone is not live harness evidence.

See [`TRUEFORGE_V0.002.md`](./TRUEFORGE_V0.002.md).

## v0.003 owned evidence topology

v0.003 adds two new owned loopback boundaries behind TrueForge:

```text
Inventory Retry Storm demo state
        │ detached read
        ▼
Owned demo source
127.0.0.1:8792
        │ GET only
        ▼
Owned MCP server
127.0.0.1:8791/mcp
        │ Streamable HTTP MCP
        ▼
TrueForge
127.0.0.1:8790
        │ model tool call + tool.response
        ▼
ROOK same-origin SDK transport
        │
        ▼
normalization + correlation
        │
        ▼
public-truth projection
        │
        ▼
evidence-backed UI observation
```

The deterministic scenario is intentionally fictional. The observation path is authentic: ROOK's promoted fields must have crossed the running source → MCP → TrueForge → ROOK evidence chain.

## Owned demo source — `:8792`

The source server is loopback-only and read-only.

It exposes GET observations for:

- service health;
- retry pressure;
- deployment history;
- dependency topology.

Each evidence envelope carries:

```text
source.system = rook-owned-demo-source
source.scenarioId = inventory-retry-storm-v1
source.classification = owned-demo-non-production
source.kind = <observation kind>
source.sourceTimestamp = <source time>
source.observationWindow = <start/end>
```

Reads return detached copies so callers cannot mutate future observations.

## Owned MCP server — `:8791/mcp`

The MCP server exposes exactly four tools:

1. `get_service_health`
2. `get_retry_pressure`
3. `get_deployment_history`
4. `get_dependency_topology`

All four positively declare:

```text
readOnlyHint: true
destructiveHint: false
idempotentHint: true
openWorldHint: false
```

The server performs no mutation. It reads the owned demo source and returns the resulting envelope as MCP text/structured content.

## TrueForge v0.003 authority boundary

ROOK creates a fresh inline TrueForge agent for the proof session.

The agent attaches only the configured connector named:

```text
rook-inventory-retry-storm
```

with:

```text
enableTools: ["@read-only"]
preload: false
```

The agent definition does not carry the MCP URL or credentials. TrueForge resolves the configured connector by name.

v0.003 explicitly disables capabilities that TrueForge may otherwise default-enable:

```text
sandbox.enabled = false
dynamicSubAgents.enabled = false
askUserQuestions.enabled = false
generativeUi.enabled = false
skills = []
```

The agent loop is also bounded by an explicit iteration limit.

No approval resumption or mutation authority is introduced in this milestone.

## MCP evidence normalization

v0.003 does not reconstruct authoritative tool calls from fragmented streaming deltas.

The settled TrueForge `model.message` event is the retained tool-call observation. ROOK requires:

- source event ID;
- source timestamp;
- stream sequence when supplied;
- thread identity;
- tool call ID;
- function name;
- raw serialized argument string;
- `toolInfo.type = mcp`;
- MCP server ID;
- exact MCP server name;
- exact allowed tool name.

ROOK retains this as:

```text
mcp.tool.called
```

TrueForge `tool.response` is retained as:

```text
mcp.tool.returned
```

with:

- source event ID/timestamp;
- stream sequence when supplied;
- thread identity;
- `toolCallId`;
- raw serialized content.

Raw argument/response strings are retained without inventing parsed semantics at the normalization boundary.

## Correlation contract

A v0.003 turn cannot become ready from a text answer alone.

ROOK requires a one-to-one evidence relationship:

```text
settled model.message tool call
        │ call ID
        ▼
tool.response
```

The adapter fails closed on:

- duplicate call IDs;
- response without retained call;
- duplicate response;
- call/response thread mismatch;
- terminal turn while a call remains unresolved;
- no correlated MCP evidence;
- event after terminal evidence;
- approval activity;
- MCP auth pause;
- user-supplied tool-response pause;
- sandbox activity;
- subagent activity;
- required terminal actions;
- terminal status other than `done`;
- missing or multiple terminal events.

Exactly one terminal `turn.done` remains required.

## Public-truth projection

Observed tool output is not automatically a UI fact.

The first v0.003 promoted surface is retry pressure. Before ROOK displays the live observation, the correlated `get_retry_pressure` response must parse as the exact owned demo envelope and prove:

```text
source.system = rook-owned-demo-source
source.scenarioId = inventory-retry-storm-v1
source.classification = owned-demo-non-production
source.kind = retry-pressure
```

Required numeric/string fields must also be present and valid.

Only then can the UI display:

```text
OBSERVED · OWNED DEMO MCP
```

with retry multiplier, attempts/minute, queue depth, queue saturation, source timestamp, call ID, and call/response source event IDs.

A malformed, unclassified, wrong-scenario, wrong-server, or incomplete response is not promoted.

All other incident surfaces remain fixture-labeled until they receive their own projection gate.

## Evidence-state ownership

### Authentic v0.003 evidence can include

- TrueForge session ID;
- session-response observation time;
- streamed TrueForge source event IDs;
- source timestamps;
- SSE sequence IDs;
- thread identity;
- exact owned MCP server identity;
- settled MCP tool call ID/name/raw arguments;
- matching tool response ID/content;
- call/response correlation;
- exactly one successful terminal turn;
- classified owned-demo retry-pressure observation projected to UI.

### Still fixture/design-only in v0.003

Unless separately promoted through a matching evidence gate:

- fault-source confidence;
- legacy dashboard retry/error/latency metrics;
- blast-radius topology presentation;
- delegated investigator states;
- sandbox state;
- incident progression;
- remediation proposal;
- approval;
- mutation;
- recovery verification.

A successful MCP proof does not promote any of those fields automatically.

## Application structure

```text
scripts/v003/
  incident-source.mjs       owned non-production demo observations
  source-server.mjs         loopback GET boundary
  mcp-server.mjs            four read-only MCP tools
  read-only-boundary.test.mjs

src/harness/
  adapter.ts                ROOK evidence event contract
  localProxy.ts             same-origin TrueForge loopback guard
  trueforge.ts              released v0.002 normalization/transport
  v003.ts                   v0.003 agent authority + MCP normalization/correlation
  liveIncidentEvidence.ts   public-truth projection
  runtime.ts                local runtime composition
  TrueForgeProof.tsx        visible authentic evidence surface
```

The released v0.002 transport remains separate from the v0.003 adapter so the new authority surface does not silently rewrite the prior milestone's contract.

## Future boundaries

### v0.004 — sandbox + delegated investigators

Sandbox execution and subagents remain disabled until their own evidence/authority contracts are implemented.

### v0.005 — human authorization + bounded remediation

Mutation may occur only after an exact proposed action reaches a visible human approval boundary.

### v0.006 — independent recovery verification

Execution success cannot become recovery. ROOK must independently re-observe required health evidence before Verified Green.

## Reproduction

See [`TRUEFORGE_V0.003.md`](./TRUEFORGE_V0.003.md) for the exact local connector registration, process topology, authentic capture requirements, and fail-closed checklist.

The project sequence remains:

`connection proof → read-only evidence → isolated reproduction/delegation → human-authorized mutation → independent verification`
