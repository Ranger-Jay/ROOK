# TrueForge v0.004 — authentic split-authority sandbox reproduction proof

ROOK v0.004 extends the released v0.003 read-only incident boundary with one deliberately bounded code-execution step inside a real TrueForge sandbox.

The proof now uses **two distinct least-authority TrueForge sessions**. This is intentional:

- the **observation session** has the owned read-only MCP connector and **sandbox disabled**;
- only after ROOK validates the OBSERVED evidence does it create the **reproduction session**;
- the reproduction session has **sandbox enabled and no MCP connector at all**.

That split removes unnecessary cross-authority and prevents MCP discovery helpers from competing with TrueForge's managed sandbox `exec` tool in the constrained local model's reproduction context.

Required chain:

```text
owned non-production demo source :8792
        │ read-only HTTP
        ▼
ROOK MCP :8791/mcp
        │ @read-only
        ▼
TrueForge observation session + local model
        │ sandbox disabled
        │ get_retry_pressure exactly once
        ▼
OBSERVED owned-demo evidence
        │ exact values must pass ROOK's projection gate
        ▼
ROOK authority handoff
        │ only after OBSERVED validation
        ▼
NEW TrueForge reproduction session + same local model
        │ no MCP connector
        │ sandbox enabled / downloads disabled
        │ exec exactly once
        ▼
Daytona sandbox
        │ sandbox.created
        │ correlated zero-exit tool.response
        ▼
REPRODUCED evidence
```

`CLAIM → EVIDENCE → PUBLIC TRUTH`

This milestone proves **reproduction**, not remediation and not recovery. Incident mutation remains unavailable in v0.004.

## Truth and authority boundary

The v0.004 proof may succeed only when ROOK retains all of the following:

1. one TrueForge observation session with the configured `rook-inventory-retry-storm` MCP attachment and sandbox disabled;
2. exactly one `get_retry_pressure` call from that owned read-only MCP source;
3. a matching MCP `tool.response` on the same call/thread;
4. an owned-demo payload that passes the OBSERVED projector;
5. OBSERVED numeric values that exactly match the deterministic reproduction input contract;
6. **no sandbox-authorized reproduction session created before steps 1–5 pass**;
7. a second, distinct TrueForge reproduction session with sandbox enabled, file downloads disabled, and **no MCP attachment**;
8. exactly one public TrueForge system-tool call identified as `truefoundry-system / exec` in the reproduction session;
9. the exact v0.004 `intent` and `command` arguments, with no `cwd`, `env`, or extra keys;
10. exactly one real `sandbox.created` event;
11. a matching sandbox `tool.response` on the same call/thread;
12. Daytona provider success, exit code `0`, and the exact reproduction result schema/values;
13. exactly **two** successful `turn.done` events with zero required actions — one per TrueForge session;
14. no approval, MCP-auth pause, subagent, user-supplied tool response, or incident mutation activity;
15. no sandbox execution in the observation session and no MCP activity in the reproduction session.

If any part is missing or drifts, ROOK fails closed and does not promote `REPRODUCED` evidence.

### Why two TrueForge sessions

TrueForge adds its sandbox as a managed tool set. Its deferred MCP discovery helpers are associated with attached user/MCP tool sets. ROOK therefore separates the proof by authority instead of asking a small local model to choose among observation and execution capabilities in one context.

This is not a simulated handoff. Both sessions are real TrueForge sessions. The observation is obtained through TrueForge's real MCP path; the reproduction is executed through TrueForge's real sandbox `exec` path backed by Daytona.

### Execution-policy distinction

TrueForge owns execution of its built-in sandbox tool. ROOK does **not** intercept a model-issued shell command before TrueForge executes it in Daytona.

ROOK therefore treats its exact-command check as a **public-evidence acceptance gate**, not as a pre-execution shell firewall. A different command cannot become valid v0.004 evidence, but the TrueForge/Daytona sandbox remains the execution isolation boundary.

## Pinned TrueForge 0.1.3 sandbox facts

ROOK is tested against TrueForge `0.1.3` / source commit:

```text
888bf74a0e59da47880ff1da5f5f1ae08e534eeb
```

In this release:

- sandbox-enabled agent specs require a server-side sandbox factory;
- the registered sandbox provider is Daytona;
- `SANDBOX_SETTINGS` selects the provider and snapshot;
- `SANDBOX_API_KEY` may provide the Daytona API key separately from the settings JSON;
- the built-in sandbox execution tool is `exec`;
- a newly created sandbox emits `sandbox.created`;
- execution results return through ordinary `tool.response` evidence.

ROOK explicitly sets sandbox file downloads to `false` for the reproduction session. The observation session explicitly sets sandbox `enabled: false`.

## Daytona account prerequisite

Create a Daytona API key in the Daytona Dashboard. The key must be able to create/use sandboxes. Do not grant snapshot-management, secret-management, or unrelated administrative scopes merely for this proof.

**Never paste the Daytona key into GitHub, a ROOK file, a `VITE_*` variable, a screenshot, or chat.**

The proof uses Daytona's official default snapshot:

```text
daytona-small
```

A custom snapshot is unnecessary unless authentic execution shows that the default snapshot is incompatible with TrueForge 0.1.3 initialization.

## Old Faithful prerequisites

The verified local topology uses:

```text
ROOK repo:      C:\Users\Aurae\Documents\GitHub\ROOK
TrueForge:      http://localhost:8790
ROOK MCP:       http://127.0.0.1:8791/mcp
owned source:   http://127.0.0.1:8792
ROOK UI:        http://localhost:5173
model FQN:      ollama-local/qwen2-5-1-5b
Ollama model:   qwen2.5:1.5b
```

On the verified Windows host, TrueForge 0.1.3 bound IPv6 loopback (`[::1]:8790`). Use `localhost` for the TrueForge origin. Do not replace it with `127.0.0.1` unless a fresh health check proves that binding works.

The outside-repository Windows ESM loader remains:

```text
C:\Users\Aurae\trueforge-win-esm-loader.mjs
```

## 1. Put the local worktree on the reviewed v0.004 branch

Before authentic capture:

```powershell
git fetch origin
git switch feat/v0.004-sandbox-reproduction
git pull --ff-only
git status --short
git rev-parse HEAD
```

The worktree must be clean. Record the exact head used for capture.

## 2. Start or verify the owned read-only proof stack

From the ROOK repository:

```powershell
npm run demo:stack
```

Expected boundaries:

```text
owned demo source: http://127.0.0.1:8792
read-only MCP:     http://127.0.0.1:8791/mcp
```

The stack must report its health/truth checks as passed. This proves the owned source/MCP boundary only; it is not sandbox proof.

## 3. Verify the TrueForge MCP connector

With TrueForge reachable through `http://localhost:8790`, run:

```powershell
$env:ROOK_TRUEFORGE_URL='http://localhost:8790'
npm run demo:trueforge-setup
```

The connector must remain exactly:

```text
name: rook-inventory-retry-storm
url:  http://127.0.0.1:8791/mcp
auth: not_required
```

The connector is attached only to the observation session. The reproduction session intentionally omits `mcpServers`.

## 4. Load the Daytona key without echoing it

Use a secure PowerShell prompt in the terminal that will launch TrueForge:

```powershell
$secure = Read-Host 'Daytona API key' -AsSecureString
$env:SANDBOX_API_KEY = [System.Net.NetworkCredential]::new('', $secure).Password
Remove-Variable secure
```

Do not print `$env:SANDBOX_API_KEY`.

Set the non-secret sandbox settings separately:

```powershell
$env:SANDBOX_SETTINGS='{"type":"daytona","snapshotName":"daytona-small","timeoutMs":60000,"autoStopIntervalInMinutes":5,"autoArchiveIntervalInMinutes":60,"autoDeleteIntervalInMinutes":60}'
```

These settings deliberately use short lifecycle intervals for a hackathon proof sandbox. They are not a general production policy.

## 5. Restart TrueForge with sandbox support

TrueForge reads its server configuration at startup. A process started before `SANDBOX_API_KEY` / `SANDBOX_SETTINGS` were defined does not become sandbox-enabled merely because the parent shell later changes.

In the configured TrueForge terminal:

```powershell
cd C:\Users\Aurae
$env:NODE_OPTIONS='--experimental-loader=file:///C:/Users/Aurae/trueforge-win-esm-loader.mjs'
& npx.cmd --yes '@truefoundry/trueforge@0.1.3'
```

Verify from a separate terminal:

```powershell
Invoke-WebRequest 'http://localhost:8790/healthz' -UseBasicParsing
```

Expected status: HTTP `200` / `OK!`.

Never expose the TrueForge process environment in capture output.

## 6. Start ROOK with non-secret browser configuration

The browser receives only non-secret identifiers:

```powershell
cd C:\Users\Aurae\Documents\GitHub\ROOK
$env:VITE_TRUEFORGE_URL='http://localhost:8790'
$env:VITE_TRUEFORGE_MODEL='ollama-local/qwen2-5-1-5b'
npm run dev
```

Never place `SANDBOX_API_KEY` or any other credential in a `VITE_*` variable.

## 7. Run the authentic v0.004 proof

Open the local ROOK UI and choose:

```text
Run bounded sandbox reproduction
```

One click orchestrates this split-authority sequence:

```text
TrueForge observation session
  sandbox disabled
  get_retry_pressure exactly once
→ correlated OBSERVED owned-demo response
→ exact values pass ROOK's reproduction-input gate
→ create a distinct TrueForge reproduction session
  no MCP attachment
  sandbox enabled
→ TrueForge sandbox exec exactly once
→ sandbox.created
→ successful zero-exit tool.response
→ second successful turn.done
```

A successful public surface must display:

```text
OBSERVED + REPRODUCED EVIDENCE
```

with separate cards:

```text
OBSERVED · OWNED DEMO MCP
REPRODUCED · TRUEFORGE SANDBOX
```

The surface also exposes the separate observation and reproduction TrueForge session IDs. The REPRODUCED card must display a real sandbox ID plus call, sandbox-event, and response-event provenance.

## 8. Authentic evidence to freeze

Retain, outside the repository until sanitized:

- exact ROOK branch head SHA;
- TrueForge version and local model identifier;
- real **observation TrueForge session ID**;
- real **reproduction TrueForge session ID**;
- one real turn ID from each session;
- the `get_retry_pressure` call event and correlated response event;
- evidence that the observation session had sandbox disabled;
- evidence that the reproduction session had no MCP connector and sandbox enabled;
- the real `sandbox.created` event and sandbox ID;
- the `truefoundry-system / exec` call event;
- the correlated sandbox `tool.response`;
- provider success / exit code `0` reproduction result;
- both successful terminal `turn.done` events;
- screenshots of the two evidence cards and split session IDs with no secrets or private account information.

Do not commit raw machine-environment dumps or credential-bearing screenshots.

## 9. Fail-closed conditions

The v0.004 proof is invalid if any of these occur:

- missing or duplicate `get_retry_pressure` call;
- owned-demo projector rejection;
- OBSERVED numeric values differ from the deterministic reproduction input;
- a sandbox-authorized reproduction session is created before the OBSERVED contract passes;
- observation and reproduction use the same TrueForge session ID;
- sandbox execution occurs in the read-only observation session;
- MCP activity occurs in the sandbox-only reproduction session;
- system tool other than `exec` in the reproduction evidence path;
- wrong exec intent/command or any extra `cwd` / `env` / key;
- missing/duplicate `sandbox.created`;
- sandbox response without the retained exec call;
- call/response thread mismatch;
- Daytona provider failure;
- non-zero sandbox exit code;
- wrong reproduction schema or numeric result;
- approval, auth pause, subagent, client tool response, or mutation activity;
- required actions at either terminal state;
- terminal state other than `done`;
- missing/duplicate terminal turn in either session;
- UI lacks either the OBSERVED or REPRODUCED projection.

## 10. Daytona troubleshooting rule

If `daytona-small` cannot initialize the pinned TrueForge sandbox runtime, record the exact non-secret failure and stop the proof attempt.

Do **not** weaken ROOK's evidence contract or fabricate `sandbox.created` / execution events. The next corrective path is a dedicated Daytona snapshot containing the runtime prerequisites demonstrated by the TrueForge source (Linux shell utilities and Python), followed by another authentic run.

## 11. Cleanup

The proof configuration uses Daytona lifecycle controls to stop/archive/delete idle proof sandboxes automatically. After capture, the Daytona Dashboard may also be used to verify that no unnecessary proof sandbox remains running.

Do not revoke the API key until all required authentic capture retries are complete. Revoke it after the hackathon proof no longer needs Daytona access.

## Release rule

Passing tests or a mocked/scripted sandbox sequence is not enough.

v0.004 may move from `v0.004-dev` to `v0.004` only after:

1. the real Daytona-backed split-authority chain passes;
2. authentic two-session/turn/sandbox evidence is frozen and sanitized;
3. the exact final branch head passes the full repository gate;
4. Qodo reports no unresolved valid High/Medium findings;
5. the PR text/README accurately describe what was actually proven;
6. a human explicitly authorizes release/merge.

Until then, v0.003 remains the released baseline and v0.004 remains pre-release development.
