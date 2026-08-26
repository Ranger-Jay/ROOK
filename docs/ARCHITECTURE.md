# Architecture — v0.002-dev

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
   ├── MCP tools (owned demo systems; v0.003+)
   ├── Sandbox execution (v0.004+)
   ├── Subagents (v0.004+)
   ├── Human approval checkpoints (v0.005+)
   └── Persistent session context
```

The UI must make harness work visible: session/turn evidence, tool activity, delegated work, sandbox boundaries, approval waits, execution, verification, and audit evidence as those capabilities become authentic.

ROOK must never let one authentic layer launder another simulated layer into a live claim. In v0.002, the TrueForge session/turn boundary can be live while the Inventory Retry Storm incident data remains fixture-only.

## Canonical demo: Inventory Retry Storm

Fictional services:

- `storefront`
- `checkout`
- `inventory-reservation`
- `payment`
- shared queue/cache infrastructure

A faulty deployment changes retry/backoff behavior in `inventory-reservation`. Under load, retries become aggressive enough to saturate shared infrastructure. Pressure propagates to checkout latency and failures.

The incident is intentionally owned/simulated. No third-party production systems are modified.

## Agent responsibilities

Names are product labels until the corresponding TrueForge delegation capability is authentically wired and evidenced.

- **Sentinel** — telemetry/log investigation
- **Tracer** — dependency and blast-radius analysis
- **Forensic** — recent-change/config investigation
- **Forge** — sandbox reproduction and validation

The main ROOK agent synthesizes evidence, proposes the remediation, and owns the approval boundary in later milestones.

## TrueForge integration

### v0.002 — implemented runtime boundary

ROOK uses the official `@truefoundry/trueforge-sdk` for a deliberately narrow proof:

- local no-login TrueForge origin only;
- inline model-only agent;
- real session creation;
- real streamed text-only turn;
- normalized source-event provenance;
- exactly one terminal `turn.done` required;
- malformed known events fail closed;
- unknown future events are ignored without inventing semantics;
- unexpected tool/sandbox/subagent/approval/MCP capability events fail the v0.002 proof.

No browser token exists in this boundary. Hosted/OIDC connectivity is deferred behind a server-side trust boundary rather than exposing credentials through Vite environment variables.

See [`TRUEFORGE_V0.002.md`](./TRUEFORGE_V0.002.md) for the reproducible proof and evidence rules.

### Sessions

A single incident is intended to map to a durable TrueForge session so state survives browser reconnects and the incident remains explainable as one continuous job.

v0.002 establishes the real session resource and streamed-turn transport. Durable client-side incident→session resumption is not yet promoted to a production durability claim.

### MCP tools — v0.003

The owned demo MCP surface will expose owned data/actions. The initial live contract is intentionally read-only:

- fetch service health and SLO metrics;
- fetch retry/queue pressure metrics;
- fetch deployment/config history;
- fetch dependency topology.

A later sensitive example will apply the bounded retry/backoff remediation to the fictional demo environment, but only after the authorization milestone lands.

### Sandbox — v0.004

Agent-written diagnostics and reproduction scripts run inside TrueForge's isolated sandbox. Sandbox output is evidence; it does not itself authorize production/demo-production mutation.

### Subagents — v0.004

The main session delegates bounded investigation tasks and records returned evidence. Subagents do not receive authority to mutate production/demo-production.

### Human approval — v0.005

The proposed remediation stops at a visible approval gate. The exact action, resources, risk, expected result, and rollback/recovery plan are shown before authorization.

### Verification — v0.006

After execution, ROOK independently re-queries telemetry and required checks. Execution success cannot advance the incident directly to resolved.

## Application architecture

```text
src/
  app/          application shell and composition
  components/   visual components
  domain/       incident state and safety invariants
  harness/      TrueForge adapter, transport, runtime config, evidence proof
  fixtures/     clearly labeled demo data only
  styles/       generated Citadel Watch tokens + global styles
```

The domain package does not depend on React or TrueForge transport details. This keeps lifecycle/safety rules unit-testable.

The harness package separates four concerns:

```text
runtime configuration
        │
        ▼
SDK transport
        │
        ▼
normalization + fail-closed capability boundary
        │
        ▼
ROOK evidence contract / React proof surface
```

Generated TrueForge SDK wire types do not become the command surface's public domain contract.

## Evidence ownership

### TrueForge live evidence

v0.002 can authentically own:

- session resource ID returned by TrueForge;
- ROOK observation timestamp for that response;
- TrueForge stream event IDs;
- source timestamps when supplied;
- stream sequence identifiers when supplied;
- thread identity, preserving `null` root-thread semantics;
- terminal turn status.

### Fixture incident evidence

Until v0.003, the following remain fixtures and must stay labeled:

- retry/error/latency metrics;
- deployment/config history;
- dependency topology;
- delegated investigator states;
- causal confidence;
- incident progression shown for the scripted scenario.

A live TrueForge connection does not promote fixture incident fields to observed truth.

## Data ownership

All demo telemetry, deployment history, source/config fixtures, and mutation targets are owned by this project or generated for the demo. Secrets remain outside the repo.

## Scope discipline

ROOK v0.002 establishes authentic TrueForge session/turn connectivity and its evidence boundary only. It intentionally does not add MCP incident evidence, sandbox work, subagent execution, approval resumption, or remediation authority.

This preserves the project sequence:

`connection proof → read-only evidence → isolated reproduction/delegation → human-authorized mutation → independent verification`
