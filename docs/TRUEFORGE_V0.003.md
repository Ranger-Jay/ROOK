# TrueForge v0.003 — authentic read-only MCP incident proof

ROOK v0.003 advances the released v0.002 connection boundary into the first authentic incident-evidence milestone.

The required chain is:

```text
owned non-production demo source :8792
        │ read-only HTTP GET
        ▼
ROOK MCP server :8791/mcp
        │ Streamable HTTP MCP
        ▼
TrueForge :8790
        │ real model tool call + tool.response
        ▼
ROOK same-origin harness adapter
        │ retained call/response provenance
        ▼
evidence-backed retry-pressure surface
```

`CLAIM → EVIDENCE → PUBLIC TRUTH`

This procedure proves only the v0.003 read-only investigation boundary. It does **not** prove production telemetry, sandbox execution, subagent delegation, approval, mutation, remediation, or recovery.

## Required local components

Run all components on the same local machine:

- ROOK branch `feat/v0.003-mcp-readonly-investigation`;
- Node.js compatible with the repository engine requirement;
- local TrueForge on `http://127.0.0.1:8790`;
- a model already configured in TrueForge that can issue function/tool calls;
- the ROOK owned demo source on `127.0.0.1:8792`;
- the ROOK read-only MCP server on `127.0.0.1:8791/mcp`.

No cloud API key is required when TrueForge is using the already-configured local model provider. Never place secrets in `VITE_*` variables, screenshots, GitHub comments, or chat messages.

## 1. Update and install ROOK

From the ROOK repository:

```bash
git fetch origin
git switch feat/v0.003-mcp-readonly-investigation
git pull --ff-only
npm install
```

Before capture, confirm the current branch head matches the PR #7 head selected by Command Center.

## 2. Start the owned non-production demo source

Open a terminal in the ROOK repository and run:

```bash
npm run demo:source
```

Expected listener:

```text
http://127.0.0.1:8792
```

The source is deterministic fictional data owned by ROOK. Reads are authentic observations from the running local boundary, but the data is **not production telemetry**.

Optional PowerShell health check:

```powershell
Invoke-RestMethod http://127.0.0.1:8792/healthz
```

The health response must identify the boundary as `rook-owned-demo-source` and classify it as `owned-demo-non-production`.

Keep this terminal running.

## 3. Start the owned read-only MCP server

Open a second terminal in the ROOK repository and run:

```bash
npm run demo:mcp
```

Expected MCP endpoint:

```text
http://127.0.0.1:8791/mcp
```

Optional PowerShell health check:

```powershell
Invoke-RestMethod http://127.0.0.1:8791/healthz
```

The MCP server exposes exactly four tools:

1. `get_service_health`
2. `get_retry_pressure`
3. `get_deployment_history`
4. `get_dependency_topology`

Every exposed tool declares:

```text
readOnlyHint: true
destructiveHint: false
idempotentHint: true
openWorldHint: false
```

Keep this terminal running.

## 4. Register the MCP server in TrueForge

Open the local TrueForge UI:

```text
http://127.0.0.1:8790
```

Then use:

**Settings → Connectors → Add MCP Server**

Enter exactly:

| Field | Value |
| --- | --- |
| **Name** | `rook-inventory-retry-storm` |
| **Description** | `ROOK owned non-production read-only Inventory Retry Storm evidence source` |
| **URL** | `http://127.0.0.1:8791/mcp` |
| **Auth type** | `None` |

Choose **Add**.

The exact name matters. The v0.003 inline agent attaches the configured connector by the name `rook-inventory-retry-storm`; it does not carry the MCP URL or credentials in the agent definition.

Do **not** select OAuth or API Key for this local owned server.

## 5. Confirm the local TrueForge model

Under **Settings → Models**, confirm the existing local model provider remains configured and available.

The model used for the authentic v0.003 capture must support tool/function calling. A model that only returns text will correctly fail the v0.003 evidence gate because ROOK requires at least one correlated MCP call/response pair.

Do not change to a paid provider merely to satisfy this milestone unless Jay explicitly chooses to do so.

## 6. Configure ROOK's non-secret local environment

Create or update `.env.local`:

```text
VITE_TRUEFORGE_URL=http://127.0.0.1:8790
VITE_TRUEFORGE_MODEL=<the exact model identifier configured in TrueForge>
```

`VITE_*` values are browser-visible. The model identifier is not a credential; API keys, bearer tokens, passwords, and other secrets must never be placed here.

## 7. Start ROOK

Open another terminal in the repository:

```bash
npm run dev
```

Open the Vite URL in a normal browser on the same machine.

The browser talks to TrueForge through ROOK's governed same-origin Vite proxy. The MCP server is reached by TrueForge itself, not by the browser.

## 8. Run the v0.003 proof

In ROOK, find:

**TRUEFORGE · v0.003 read-only incident evidence**

Choose:

**Run read-only investigation**

The proof instruction requires the model to call `get_retry_pressure` exactly once before answering.

ROOK must not display the success state merely because a session or text answer exists. Success requires:

1. a real TrueForge session response;
2. a retained settled `model.message` MCP tool call;
3. the exact owned MCP server identity;
4. an allowed read-only tool name;
5. raw serialized tool arguments retained without invented parsing;
6. a matching `tool.response` linked by `toolCallId`;
7. matching thread identity between call and response;
8. a payload that passes the owned-demo public-truth projection gate;
9. exactly one successful `turn.done`;
10. zero required actions;
11. no sandbox, subagent, approval, MCP-auth, user-supplied tool response, or mutation activity.

## 9. Expected successful surface

A passing capture shows:

```text
LIVE READ-ONLY MCP EVIDENCE
```

and an evidence-backed card labeled:

```text
OBSERVED · OWNED DEMO MCP
Retry pressure
```

The card is allowed to show retry metrics only after its response payload proves:

```text
source.system = rook-owned-demo-source
source.scenarioId = inventory-retry-storm-v1
source.classification = owned-demo-non-production
source.kind = retry-pressure
```

The card also retains the MCP call ID plus the source event IDs for the initiating tool call and matching response.

All surrounding incident fields that have not crossed this evidence gate remain explicitly labeled **FIXTURE**.

## Fail-closed conditions

The proof must fail rather than promote a live claim if any of these occurs:

- no MCP tool call;
- tool call from an unexpected MCP server;
- tool outside the exact owned read-only inventory;
- missing or malformed `toolInfo` provenance;
- duplicate tool-call ID;
- tool response without a retained call;
- duplicate tool response;
- call/response thread mismatch;
- terminal turn with an unresolved tool call;
- malformed response content;
- missing/wrong owned-demo classification;
- unexpected approval;
- unexpected MCP authentication pause;
- user-supplied tool-response pause;
- sandbox activity;
- subagent activity;
- required actions at terminal state;
- terminal status other than `done`;
- missing terminal `turn.done`;
- more than one terminal event;
- a text-only answer with no correlated MCP evidence.

## Authentic capture checklist

Retain screenshots/log evidence showing at minimum:

- [ ] current PR #7 head SHA;
- [ ] owned demo source healthy on `127.0.0.1:8792`;
- [ ] owned read-only MCP server healthy on `127.0.0.1:8791`;
- [ ] TrueForge connector named `rook-inventory-retry-storm` using Auth type `None`;
- [ ] real TrueForge session ID;
- [ ] `mcp.tool.called` for `get_retry_pressure`;
- [ ] MCP server identity/provenance;
- [ ] matching `mcp.tool.returned` / source `tool.response` call ID;
- [ ] call and response source event IDs and timestamps;
- [ ] evidence-backed retry-pressure card;
- [ ] explicit `owned-demo-non-production` classification;
- [ ] exactly one terminal `turn.done`;
- [ ] no sandbox, subagent, approval, auth pause, or mutation activity;
- [ ] remaining fixture surfaces still visibly labeled.

Do not commit local screenshots containing secrets or machine-specific sensitive information. Sanitized capture evidence may be attached to PR #7.

## Release rule

A green test suite is not the authentic v0.003 proof.

The release gate remains closed until the real local chain is observed:

```text
owned demo source → MCP server → TrueForge tool call → tool.response → ROOK retained evidence → evidence-backed UI
```

Only after that capture, exact-head CI/Qodo review, and Jay's human release decision may `VERSION` move from `v0.003-dev` to `v0.003`.
