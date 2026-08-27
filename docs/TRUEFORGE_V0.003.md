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
- local TrueForge 0.1.3 on `http://127.0.0.1:8790`;
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

## 2. Start the owned proof stack

Open one terminal in the ROOK repository and run:

```bash
npm run demo:stack
```

This starts both owned local boundaries:

```text
owned demo source: http://127.0.0.1:8792
read-only MCP:     http://127.0.0.1:8791/mcp
```

Before reporting readiness, the command verifies:

- the source health boundary is `rook-owned-demo-source`;
- the source classification is `owned-demo-non-production`;
- the MCP health boundary is `rook-owned-read-only-mcp`;
- the MCP tool inventory is exactly the four approved v0.003 read-only tools;
- the retry-pressure source probe carries the exact owned-demo scenario/classification/kind.

Expected terminal output includes:

```text
[rook:v0.003] proof stack ready
[rook:v0.003] health/truth checks: passed
```

Keep this terminal running during the authentic capture. Press **Ctrl+C** after the proof to stop both servers cleanly.

The underlying individual commands remain available for diagnosis if needed:

```bash
npm run demo:source
npm run demo:mcp
```

`demo:stack` is the preferred capture path because it reduces setup drift and performs the health/truth checks automatically.

## 3. Configure and verify the TrueForge connector

With local TrueForge 0.1.3 already running on `http://127.0.0.1:8790`, open a second terminal in the ROOK repository and run:

```bash
npm run demo:trueforge-setup
```

This uses the pinned TrueForge 0.1.3 SDK/settings API. It is intentionally fail-closed:

- if `rook-inventory-retry-storm` is absent, it creates exactly one no-auth remote connector for `http://127.0.0.1:8791/mcp`;
- if the exact connector already exists, it reuses it without mutation;
- if the same name exists with a different URL, description, auth mode, or manifest, it refuses to overwrite it;
- it then asks TrueForge to list the connector's tools;
- it requires the exact four-tool set, with no duplicate or unexpected tools;
- every tool must retain `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, and `openWorldHint: false` through the TrueForge boundary.

Expected output ends with:

```text
[rook:v0.003] TrueForge connector/tool preflight passed
```

This setup command changes only local TrueForge connector configuration when the connector is absent. It does **not** create a TrueForge session, run a model turn, call an MCP tool through an agent, use a sandbox, start a subagent, request approval, or mutate the owned incident source.

If the command reports a mismatched existing connector, stop and inspect that local configuration. Do not use an upsert/overwrite workaround merely to make the proof proceed.

## 4. Confirm the local TrueForge model

Under **Settings → Models**, confirm the existing local model provider remains configured and available.

The model used for the authentic v0.003 capture must support tool/function calling. A model that only returns text will correctly fail the v0.003 evidence gate because ROOK requires correlated MCP call/response evidence and exactly one `get_retry_pressure` proof call.

Do not change to a paid provider merely to satisfy this milestone unless explicitly chosen.

## 5. Configure ROOK's non-secret local environment

Create or update `.env.local`:

```text
VITE_TRUEFORGE_URL=http://127.0.0.1:8790
VITE_TRUEFORGE_MODEL=<the exact model identifier configured in TrueForge>
```

`VITE_*` values are browser-visible. The model identifier is not a credential; API keys, bearer tokens, passwords, and other secrets must never be placed here.

## 6. Start ROOK

In the same second terminal after the TrueForge setup command exits successfully, run:

```bash
npm run dev
```

Open the Vite URL in a normal browser on the same machine.

The browser talks to TrueForge through ROOK's governed same-origin Vite proxy. The MCP server is reached by TrueForge itself, not by the browser.

## 7. Run the v0.003 proof

In ROOK, find:

**TRUEFORGE · v0.003 read-only incident evidence**

Choose:

**Run read-only investigation**

The proof contract requires the model to call `get_retry_pressure` **exactly once** before answering. Other positively classified tools from the same `@read-only` MCP inventory may be used, but they do not replace the required retry-pressure call.

ROOK must not display the success state merely because a session or text answer exists. Success requires:

1. a real TrueForge session response;
2. exactly one retained settled `get_retry_pressure` MCP tool call;
3. the exact owned MCP server identity;
4. any additional tool call to remain inside the approved read-only inventory;
5. raw serialized tool arguments retained without invented parsing;
6. matching `tool.response` evidence linked by `toolCallId` for every retained MCP call;
7. matching thread identity between each call and response;
8. a retry-pressure payload that passes the owned-demo public-truth projection gate;
9. exactly one successful `turn.done`;
10. zero required actions;
11. no sandbox, subagent, approval, MCP-auth, user-supplied tool response, or mutation activity.

## 8. Expected successful surface

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

- no `get_retry_pressure` MCP tool call;
- more than one `get_retry_pressure` MCP tool call;
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
- [ ] `npm run demo:stack` reports `proof stack ready` and `health/truth checks: passed`;
- [ ] owned demo source is on `127.0.0.1:8792`;
- [ ] owned read-only MCP server is on `127.0.0.1:8791/mcp`;
- [ ] `npm run demo:trueforge-setup` reports connector/tool preflight passed;
- [ ] connector `rook-inventory-retry-storm` is no-auth and points exactly to `http://127.0.0.1:8791/mcp`;
- [ ] TrueForge sees exactly the four positively read-only tools;
- [ ] real TrueForge session ID;
- [ ] exactly one `mcp.tool.called` for `get_retry_pressure`;
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

A green test suite, a green `demo:stack` health check, and a green TrueForge connector/tool preflight are **not** the authentic v0.003 proof.

The release gate remains closed until the real local chain is observed:

```text
owned demo source → MCP server → TrueForge tool call → tool.response → ROOK retained evidence → evidence-backed UI
```

Only after that capture, exact-final-head CI/Qodo review, and the applicable release decision may `VERSION` move from `v0.003-dev` to `v0.003`.
