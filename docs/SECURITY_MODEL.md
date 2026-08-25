# Security and Control Model

ROOK is designed around **autonomy with control**.

## Trust zones

### 1. Investigation zone

Read-only evidence gathering may proceed autonomously through approved MCP tools.

Examples:

- service health;
- logs/metrics;
- deployment/config history;
- topology;
- sandbox files and generated diagnostics.

### 2. Sandbox zone

Generated code may execute only inside the configured TrueForge sandbox. Sandbox success is evidence, not permission to mutate the demo-production environment.

### 3. Production/demo-production zone

Any state-changing action is sensitive by default and requires explicit human authorization.

## Fail-closed authorization

ROOK does not infer that an action is safe merely because destructive metadata is missing or ambiguous.

The mutation path must enforce both:

1. a TrueForge human approval checkpoint; and
2. a ROOK authorization artifact scoped to the exact approved action/resources.

The ROOK authorization artifact should contain at minimum:

- incident id;
- action id/type;
- exact resource scope;
- approval timestamp;
- short expiry;
- unique nonce/id;
- approving actor label;
- status (`authorized`, `consumed`, `expired`, `revoked`).

A token/artifact for one action may not authorize another action or broader resource set.

## Known upstream consideration

As of the hackathon start, TrueForge has a public open issue concerning destructive-tool classification in Code Mode when tool annotations are absent or incompatible. ROOK therefore does **not** depend solely on Code Mode's inferred destructive classification for the critical remediation step.

Reference: https://github.com/truefoundry/trueforge/issues/318

This is a defense-in-depth decision, not a claim that the entire TrueForge approval system is unsafe.

## Execution invariants

A sensitive remediation must be rejected when any of the following is true:

- no explicit authorization exists;
- authorization is expired, revoked, or already consumed;
- action id/type differs from the authorization;
- resource scope differs from the authorization;
- incident id differs;
- the tool cannot determine whether the requested action is inside the approved scope.

Ambiguity fails closed.

## Verification invariants

After execution:

- ROOK returns to read-only evidence gathering;
- required recovery checks run independently;
- execution status and verification status remain separate;
- `verified` requires all mandatory checks to pass;
- `resolved` requires verified recovery plus an audit record.

## Audit requirements

The audit trail records:

- evidence gathered;
- subagent tasks/results;
- sandbox commands/results relevant to the decision;
- proposed remediation;
- approval details;
- exact mutation invoked;
- mutation result;
- verification evidence;
- final resolution state.

Secrets, raw credentials, and private data must never be written to the audit trail.

## Demo-data truthfulness

Fixtures and simulations are clearly labeled. The final demo must distinguish fixture data from real TrueForge tool calls and must show the harness's actual tool/sandbox/approval behavior when claiming those capabilities.
