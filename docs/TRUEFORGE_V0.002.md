# TrueForge v0.002 — Live Session Evidence Boundary

## Purpose

ROOK v0.002 proves the first authentic harness boundary without outrunning the later incident-response milestones.

The milestone may publicly claim only what the implementation can evidence:

> ROOK can create a real local TrueForge session and observe a streamed text-only turn through the official TypeScript SDK.

It may **not** claim from this proof alone that ROOK has observed live incident telemetry, used MCP tools, reproduced a fault in a sandbox, delegated real subagents, executed remediation, or verified recovery.

`CLAIM → EVIDENCE → PUBLIC TRUTH`

## Runtime boundary

v0.002 uses `@truefoundry/trueforge-sdk` with TrueForge's local no-login runtime only.

Allowed browser configuration:

```text
VITE_TRUEFORGE_URL=http://127.0.0.1:8790
VITE_TRUEFORGE_MODEL=provider/model-name
```

The URL validator accepts only a credential-free `http://localhost[:port]` or `http://127.0.0.1[:port]` origin. It rejects:

- hosted or remote hosts;
- HTTPS/hosted-OIDC use from the browser;
- username/password URL userinfo;
- query strings;
- fragments;
- endpoint paths.

`VITE_*` variables are browser-visible. No API token, OIDC token, password, or other secret belongs in this v0.002 path.

## Agent authority boundary

ROOK does **not** attach to an arbitrary saved TrueForge agent in v0.002.

For each proof session the SDK creates an inline agent specification containing only:

- a configured model identifier; and
- ROOK's evidence-first text instructions.

ROOK supplies no:

- MCP servers;
- MCP tools;
- skills;
- sandbox configuration;
- mutation authority.

The instructions explicitly prohibit claiming telemetry, configuration, topology, tool output, production state, or incident evidence that was not supplied in the conversation.

### Capability drift fails closed

Because the v0.002 session is intentionally text-only, these normalized observations are treated as unexpected capability drift and abort the proof:

- tool return;
- sandbox creation;
- subagent start/completion;
- tool approval request;
- MCP authorization request;
- terminal turn with one or more required actions.

These event shapes remain understood by the transport-normalization layer for later milestones, but v0.002 does not accept them as normal behavior.

## Evidence model

### Session observation

A successful `sessions.create` REST response yields:

- TrueForge session resource ID;
- ROOK observation timestamp.

This is recorded as a `trueforge-session-response` observation. It is **not** fabricated into a `session.created` stream event and is not assigned a fake source event ID.

### Streamed event observation

Known TrueForge stream events retain:

- source event ID;
- source timestamp when supplied by TrueForge;
- ROOK observation time;
- SSE/event sequence identifier when supplied;
- thread ID, including `null` for the documented root thread.

Unknown future event types are ignored without requiring today's common fields. Known event types with malformed required data fail closed.

### Terminal requirement

A turn proof is complete only when exactly one terminal `turn.done` event is observed.

ROOK fails the attempt if:

- the stream closes before a terminal event;
- more than one terminal event is observed;
- a known event is malformed;
- a forbidden v0.002 capability event appears;
- the transport fails.

A terminal event records its own TrueForge status (`done`, `cancelled`, or `error`). Observing a terminal event proves that the stream reached a terminal harness state; it does not prove incident recovery.

## UI truth split

The command center has two deliberately separate truth surfaces during v0.002.

### Live harness evidence

The TrueForge evidence panel may show `LIVE HARNESS OBSERVED` only after:

1. a real session response was observed; and
2. exactly one terminal streamed turn event was observed.

The panel exposes session/event provenance rather than relying on animation alone.

### Fixture incident data

The Inventory Retry Storm metrics, topology, investigator cards, confidence, and progression remain labeled fixture data.

A live harness connection does not promote those surfaces to live incident evidence.

## Reproduction procedure

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start TrueForge locally in its documented no-login mode.

3. Configure a real model in the local TrueForge installation.

4. Create `.env.local` from `.env.example` and set only:

   ```text
   VITE_TRUEFORGE_URL=http://127.0.0.1:8790
   VITE_TRUEFORGE_MODEL=provider/model-name
   ```

5. Start ROOK:

   ```bash
   npm run dev
   ```

6. Open the incident workspace and select **Observe live harness**.

7. Capture evidence showing:

   - the local TrueForge runtime is active;
   - ROOK receives a real session ID;
   - the panel shows one or more TrueForge stream event IDs;
   - the stream reaches exactly one terminal event;
   - the incident-data banner still says `FIXTURE INCIDENT DATA`.

## Release evidence gate

Do not remove `-dev` from v0.002 solely because the code compiles.

Before release promotion, require:

1. final CI green on the exact PR head;
2. Qodo follow-up review on the exact PR head;
3. every valid High finding resolved;
4. deliberate disposition of Medium/Low findings;
5. authentic local TrueForge capture following the procedure above;
6. no fixture incident field presented as live TrueForge evidence.

## Deferred capabilities

- **v0.003:** owned read-only MCP demo stack and authentic incident investigation.
- **v0.004:** sandbox reproduction and delegated investigators.
- **v0.005:** human approval gate and authorized remediation.
- **v0.006:** independent recovery verification and audit trail.
