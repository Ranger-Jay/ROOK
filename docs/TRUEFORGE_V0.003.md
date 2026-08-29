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

## Verified local proof

The authentic v0.003 chain passed on Old Faithful on 2026-08-29 with:

- TrueForge `0.1.3`;
- local Ollama provider `ollama-local`;
- model `ollama-local/qwen2-5-1-5b` backed by Ollama tag `qwen2.5:1.5b`;
- connector `rook-inventory-retry-storm`;
- required MCP call `get_retry_pressure`;
- session `01m17a7g48yk63nzcyenrf8pqt`;
- turn `01m17a7gq43apay5tppvhgtr4q.local`.

The resulting evidence-backed UI displayed `LIVE READ-ONLY MCP EVIDENCE` and the observed retry-pressure card with retry multiplier `5.3x`, attempts/minute `4,800`, queue depth `7,200`, queue saturation `91%`, source `inventory-retry-queue`, and classification `owned-demo-non-production`.

The persisted TrueForge proof was frozen outside the repository. Do not commit machine-specific proof files or screenshots containing secrets.

## Required local components

Run all components on the same local machine:

- ROOK branch `feat/v0.003-mcp-readonly-investigation`;
- Node.js compatible with the repository engine requirement;
- local TrueForge 0.1.3 reachable at `http://localhost:8790`;
- a model configured in TrueForge that supports function/tool calling;
- the ROOK owned demo source on `127.0.0.1:8792`;
- the ROOK read-only MCP server on `127.0.0.1:8791/mcp`.

No cloud API key is required when TrueForge is using a local model provider. Never place secrets in `VITE_*` variables, screenshots, GitHub comments, or chat messages.

## 1. Update and install ROOK

From the ROOK repository:

```bash
git fetch origin
git switch feat/v0.003-mcp-readonly-investigation
git pull --ff-only
npm install
```

Before capture, confirm the current branch head matches the PR #7 head selected for the proof.

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

- source boundary `rook-owned-demo-source`;
- source classification `owned-demo-non-production`;
- MCP boundary `rook-owned-read-only-mcp`;
- exact four-tool owned MCP inventory;
- retry-pressure source provenance and classification.

Expected output includes:

```text
[rook:v0.003] proof stack ready
[rook:v0.003] health/truth checks: passed
```

Keep this terminal running during the authentic capture.

## 3. Configure and verify the TrueForge connector

TrueForge 0.1.3 should be addressed through:

```text
http://localhost:8790
```

Then run:

```bash
npm run demo:trueforge-setup
```

The helper is intentionally fail-closed:

- if `rook-inventory-retry-storm` is absent, it creates exactly one no-auth remote connector for `http://127.0.0.1:8791/mcp`;
- if the exact connector already exists, it reuses it without mutation;
- if the same name exists with a different URL, description, auth mode, or manifest shape, it refuses to overwrite it;
- it verifies the exact connector manifest and `authStatus.status = not_required`.

Expected output includes:

```text
[rook:v0.003] connector manifest/no-auth preflight passed
```

### TrueForge 0.1.3 connector-tools API limitation

The installed TrueForge 0.1.3 server does **not** expose `GET /api/v1/mcp-servers/{name}/tools`. The SDK/server combination may surface a `listTools` client method in another namespace, but the installed server returns route-not-found for that endpoint.

Therefore `demo:trueforge-setup` does **not** treat that unavailable route as a proof requirement. Tool truth is established instead by:

1. the owned `demo:stack` boundary, which verifies the exact four-tool MCP inventory;
2. source/tests that lock the positive read-only annotations;
3. the authentic TrueForge turn, which proves the model can invoke the approved connector and produce a correlated `tool.response`.

A 404 from the unavailable connector-tools settings route is a TrueForge 0.1.3 SDK/server compatibility limitation, not evidence that the ROOK MCP server is unhealthy.

## 4. Confirm the local TrueForge model

Under **Settings → Models**, confirm a tool-capable model is configured.

The verified local model for the authentic proof was:

```text
ollama-local/qwen2-5-1-5b
```

A text-only model correctly fails the v0.003 evidence gate because ROOK requires correlated MCP call/response evidence and exactly one `get_retry_pressure` proof call.

## 5. Configure ROOK's non-secret local environment

Use:

```text
VITE_TRUEFORGE_URL=http://localhost:8790
VITE_TRUEFORGE_MODEL=<exact configured TrueForge model identifier>
```

`VITE_*` values are browser-visible. Never place API keys, bearer tokens, passwords, or other secrets in them.

## 6. Start ROOK

Run:

```bash
npm run dev
```

Open the Vite URL in a normal browser on the same machine. The browser talks to TrueForge through ROOK's governed same-origin Vite proxy; TrueForge talks to the MCP server directly.

## 7. Run the v0.003 proof

In ROOK, choose **Run read-only investigation** from the `TRUEFORGE · v0.003 READ-ONLY INCIDENT EVIDENCE` surface.

The proof contract requires `get_retry_pressure` **exactly once**. Other positively classified tools from the same `@read-only` MCP inventory may be used, but they do not replace the required retry-pressure call.

ROOK must not promote success merely because a session or text answer exists. Success requires:

1. a real TrueForge session response;
2. exactly one retained settled `get_retry_pressure` MCP tool call;
3. exact owned MCP server identity;
4. any additional call to remain inside the approved read-only inventory;
5. raw serialized tool arguments retained without invented parsing;
6. matching `tool.response` evidence linked by `toolCallId`;
7. matching call/response thread identity;
8. retry-pressure payload passing the owned-demo public-truth gate;
9. exactly one successful `turn.done`;
10. zero required actions;
11. no sandbox, subagent, approval, MCP-auth, user-supplied tool response, or mutation activity.

## 8. TrueForge eager-tool compatibility

The verified local Qwen path required the connector attachment to use:

```text
enableTools: ["@read-only"]
preload: true
```

With `preload: false`, TrueForge deferred tool discovery and the small local model received zero tool definitions (`toolDefinitions: 0`), producing a text-only turn that ROOK correctly rejected.

`preload: true` does **not** widen ROOK's tool authority: the attachment remains bounded by `enableTools: ["@read-only"]`, the named connector, the exact owned tool inventory, and ROOK's fail-closed evidence contract.

## 9. Streaming tool-call compatibility

TrueForge can emit a base `model.message` followed by one or more `model.message.delta` fragments containing tool-call fields. ROOK uses the official SDK `isEventDelta` / `mergeEventDelta` semantics to fold same-ID fragments into a settled `model.message` before normalization.

ROOK does not fabricate a tool call from an isolated fragment. The transport fails closed if a delta arrives without its base message, a base repeats unexpectedly, or the stream ends with an unsettled model message.

Regression coverage is in:

```text
src/harness/v003Transport.test.ts
```

## Expected successful surface

A passing capture shows:

```text
LIVE READ-ONLY MCP EVIDENCE
```

and:

```text
OBSERVED · OWNED DEMO MCP
Retry pressure
```

The retry-pressure surface may promote only after the response proves:

```text
source.system = rook-owned-demo-source
source.scenarioId = inventory-retry-storm-v1
source.classification = owned-demo-non-production
source.kind = retry-pressure
```

All surrounding incident fields that have not crossed their own evidence gates remain explicitly labeled `FIXTURE` or `DESIGN`.

## Windows / Old Faithful troubleshooting

### TrueForge responds on localhost but not 127.0.0.1

On the verified Windows machine, TrueForge 0.1.3 listened on IPv6 loopback:

```text
[::1]:8790
```

Consequently:

```text
http://localhost:8790/healthz  -> 200 OK
http://[::1]:8790/healthz      -> 200 OK
http://127.0.0.1:8790/healthz  -> connection failure
```

Use `localhost` for the TrueForge origin. The ROOK-owned source and MCP boundaries continue to use `127.0.0.1` on ports 8792 and 8791.

### Local model/provider missing

The verified recovery path used Ollama 0.33.2 and pulled:

```text
qwen2.5:1.5b
```

The TrueForge custom provider was restored as `ollama-local` with base URL `http://localhost:11434/v1` and model FQN `ollama-local/qwen2-5-1-5b`.

This is a local-development option, not a requirement to use Ollama for all ROOK deployments.

## Fail-closed conditions

The proof fails rather than promoting a live claim for any of the following:

- no `get_retry_pressure` call;
- more than one `get_retry_pressure` call;
- unexpected MCP server or tool;
- missing/malformed MCP provenance;
- duplicate tool-call ID;
- response without retained call;
- duplicate response;
- call/response thread mismatch;
- unresolved tool call at terminal state;
- malformed response content or wrong owned-demo classification;
- approval, MCP-auth, sandbox, subagent, or user-supplied tool-response activity;
- required actions at terminal state;
- terminal status other than `done`;
- missing or duplicate terminal event;
- text-only answer with no correlated MCP evidence.

## Authentic capture checklist

Retain evidence showing at minimum:

- [ ] current PR #7 head SHA;
- [ ] `demo:stack` reports proof-stack ready and health/truth checks passed;
- [ ] owned source on `127.0.0.1:8792`;
- [ ] read-only MCP on `127.0.0.1:8791/mcp`;
- [ ] connector manifest/no-auth preflight passed;
- [ ] TrueForge reachable through `http://localhost:8790`;
- [ ] connector points exactly to `http://127.0.0.1:8791/mcp`;
- [ ] exact four-tool owned MCP inventory verified by `demo:stack`;
- [ ] real TrueForge session ID;
- [ ] exactly one `mcp.tool.called` for `get_retry_pressure`;
- [ ] matching `mcp.tool.returned` / source `tool.response` call ID;
- [ ] call/response source event provenance;
- [ ] evidence-backed retry-pressure card;
- [ ] `owned-demo-non-production` classification;
- [ ] exactly one terminal `turn.done`;
- [ ] no sandbox, subagent, approval, auth pause, or mutation activity;
- [ ] remaining unproven surfaces still visibly labeled.

## Release rule

Green tests, a green proof-stack health check, and a valid connector configuration are not substitutes for authentic incident proof.

The release gate requires the real local chain:

```text
owned demo source → MCP server → TrueForge tool call → tool.response → ROOK retained evidence → evidence-backed UI
```

That authentic chain has now been demonstrated locally. `VERSION` may move from `v0.003-dev` to `v0.003` only after the exact final repository head also passes CI/Qodo review and the human release decision is explicitly made.
