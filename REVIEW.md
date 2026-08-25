# ROOK — Qodo Review Instructions

Review every substantive ROOK pull request against these project-specific laws in addition to normal correctness, security, maintainability, and test-quality checks.

## Safety-critical laws

### 1. Fail closed on production/demo-production mutation

Any state-changing operation against production or the owned demo-production environment must require explicit human authorization scoped to the exact incident, action, and resources.

Flag as **High severity** any path that can:

- mutate without explicit authorization;
- treat missing/ambiguous safety metadata as permission;
- reuse consumed, expired, revoked, or not-yet-valid authorization;
- use authorization for a different incident/action/resource scope;
- broaden resource scope implicitly;
- allow a subagent or sandbox result to bypass the human gate.

### 2. Applied ≠ verified

Execution success must never imply incident recovery.

Flag as **High severity** any path that can enter `verified` or `resolved` merely because a remediation command returned success.

Verified recovery requires independent evidence-backed checks. Resolution requires verified recovery plus an audit record.

### 3. Green is earned

Verified Green is a product/safety semantic, not decoration. Flag user-visible logic that presents green/success state before required recovery evidence passes.

### 4. Authorization is single-purpose

Authorization must be explicit, narrowly scoped, short-lived, auditable, and consumed by the approved mutation path. Ambiguity fails closed.

## TrueForge integration laws

- TrueForge must do real harness work for sessions, MCP tools, sandbox execution, approvals, subagents, and context where ROOK claims those capabilities.
- Fixture/simulated activity must remain clearly labeled until replaced by live harness events.
- Never accept a UI-only simulation as evidence of a functioning TrueForge capability.
- Sensitive tools must not rely solely on inferred destructive classification when metadata is absent or ambiguous.

## Security laws

Flag as **High severity**:

- committed credentials/secrets;
- credentials exposed to the browser unnecessarily;
- unsanitized sensitive data in logs/audit trails;
- mutation endpoints without authorization checks;
- obvious injection/path traversal/command-execution vulnerabilities;
- unsafe trust of model-generated action/resource parameters.

`.env` values must not be committed. `.env.example` contains names/placeholders only.

## Domain and testing expectations

For changes to incident lifecycle, authorization, remediation, or verification logic:

- require tests for allowed behavior and important fail-closed behavior;
- specifically look for boundary conditions around timestamps, resource matching, one-time authorization, retries, duplicate events, and state transitions;
- prefer explicit domain invariants over UI-only guards.

## Lesson-to-guardrail expectation

ROOK doctrine requires that legitimate lessons become durable guardrails rather than remain review commentary alone.

When reporting a repeatable failure mode, identify the most appropriate permanent protection when practical:

- invariant or validation;
- safer abstraction or trust boundary;
- regression test;
- CI/static check;
- repository/process gate;
- doctrine update when the lesson changes an architectural or safety rule.

A valid finding should not be considered fully resolved if the same class of defect can silently recur. Conversely, if a finding is a false positive, do not recommend an unnecessary workaround merely to make the review quiet; prefer an evidence-backed dismissal.

## Review quality

- Do not lower severity merely because this is a hackathon project when the issue affects the approval or safety boundary.
- Distinguish real defects from stylistic preferences.
- Prefer actionable findings with concrete failure scenarios.
- If implementation is intentionally deferred to a documented later milestone, do not treat the absence as a defect unless the current code falsely claims the capability already exists.

## Visual/product truth

ROOK uses Citadel Watch semantics:

- cyan = telemetry/intelligence;
- violet = AI orchestration;
- gold = human authority;
- red/amber = incident/risk;
- green = evidence-backed recovery only.

Accessibility and demo readability are requirements. Sensitive actions should identify the exact action/resource rather than use vague labels such as only “OK” or “Authorize.”
