# Architecture — v0.001

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
   ├── MCP tools (owned demo systems)
   ├── Sandbox execution
   ├── Subagents
   ├── Human approval checkpoints
   └── Persistent session context
```

The UI must make harness work visible: tool activity, delegated work, sandbox boundaries, approval waits, execution, verification, and audit evidence.

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

Names are product labels; TrueForge remains responsible for the actual delegation mechanism.

- **Sentinel** — telemetry/log investigation
- **Tracer** — dependency and blast-radius analysis
- **Forensic** — recent-change/config investigation
- **Forge** — sandbox reproduction and validation

The main ROOK agent synthesizes evidence, proposes the remediation, and owns the approval boundary.

## TrueForge integration plan

ROOK will use TrueForge for the capabilities the hackathon is evaluating:

### Sessions

A single incident maps to a durable TrueForge session so state survives browser reconnects and the incident remains explainable as one continuous job.

### MCP tools

The demo MCP surface will expose owned data/actions. The initial contract is intentionally narrow:

Read-only examples:

- fetch service health and SLO metrics;
- fetch retry/queue pressure metrics;
- fetch deployment/config history;
- fetch dependency topology.

Sensitive example:

- apply the bounded retry/backoff remediation to the fictional demo environment.

### Sandbox

Agent-written diagnostics and reproduction scripts run inside TrueForge's isolated sandbox. Sandbox output is evidence; it does not itself authorize production/demo-production mutation.

### Subagents

The main session delegates bounded investigation tasks and records the returned evidence. Subagents do not receive authority to mutate production/demo-production.

### Human approval

The proposed remediation stops at a visible approval gate. The exact action, resources, risk, expected result, and rollback/recovery plan are shown before authorization.

### Verification

After execution, ROOK independently re-queries telemetry and required checks. Execution success cannot advance the incident directly to resolved.

## Application architecture

Initial React boundaries:

```text
src/
  app/          application shell and composition
  components/   visual components
  domain/       incident state and safety invariants
  harness/      TrueForge adapter boundary
  fixtures/     clearly labeled demo data only
  styles/       generated Citadel Watch tokens + global styles
```

The domain package must not depend on React or TrueForge transport details. This keeps lifecycle/safety rules unit-testable.

## Data ownership

All demo telemetry, deployment history, source/config fixtures, and mutation targets are owned by this project or generated for the demo. Secrets remain outside the repo.

## Scope discipline

ROOK v0.001 establishes the architecture and product contract. Live TrueForge transport is a later milestone so the first PR remains coherent and reviewable rather than mixing scaffolding, tool integration, and remediation behavior at once.
