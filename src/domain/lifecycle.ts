import {
  allRequiredChecksPassed,
  type AuthorizationArtifact,
  type IncidentStage,
  type IncidentState,
  type ProposedAction,
} from './incident'

const ALLOWED_TRANSITIONS: Readonly<Record<IncidentStage, readonly IncidentStage[]>> = {
  detect: ['investigate'],
  investigate: ['delegate'],
  delegate: ['sandbox'],
  sandbox: ['propose'],
  propose: ['approve'],
  approve: ['execute', 'propose'],
  execute: ['verify'],
  verify: ['audit', 'propose'],
  audit: ['resolved'],
  resolved: [],
}

export class IncidentTransitionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IncidentTransitionError'
  }
}

function normalizedResources(resources: readonly string[]): string[] {
  return [...new Set(resources)].sort()
}

function exactResourceMatch(left: readonly string[], right: readonly string[]): boolean {
  const a = normalizedResources(left)
  const b = normalizedResources(right)
  return a.length === b.length && a.every((resource, index) => resource === b[index])
}

function parseTime(value: string, label: string): number {
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) {
    throw new IncidentTransitionError(`${label} must be a valid timestamp.`)
  }
  return parsed
}

export function validateAuthorization(
  incidentId: string,
  proposal: ProposedAction,
  authorization: AuthorizationArtifact | undefined,
  now: string,
): AuthorizationArtifact {
  if (!authorization) {
    throw new IncidentTransitionError('Execution requires explicit human authorization.')
  }
  if (authorization.status !== 'authorized') {
    throw new IncidentTransitionError(`Authorization is ${authorization.status}; execution is denied.`)
  }
  if (authorization.incidentId !== incidentId) {
    throw new IncidentTransitionError('Authorization belongs to a different incident.')
  }
  if (authorization.actionId !== proposal.id) {
    throw new IncidentTransitionError('Authorization does not match the proposed action.')
  }
  if (!exactResourceMatch(authorization.resources, proposal.resources)) {
    throw new IncidentTransitionError('Authorization scope does not exactly match the proposed resources.')
  }

  const approvedAt = parseTime(authorization.approvedAt, 'approvedAt')
  const expiresAt = parseTime(authorization.expiresAt, 'expiresAt')
  const currentTime = parseTime(now, 'now')

  if (expiresAt <= approvedAt) {
    throw new IncidentTransitionError('Authorization expiry must be later than approval time.')
  }
  if (currentTime > expiresAt) {
    throw new IncidentTransitionError('Authorization has expired.')
  }

  return authorization
}

export function transitionIncident(
  current: IncidentState,
  nextStage: IncidentStage,
  now: string,
): IncidentState {
  if (!ALLOWED_TRANSITIONS[current.stage].includes(nextStage)) {
    throw new IncidentTransitionError(`Transition ${current.stage} → ${nextStage} is not allowed.`)
  }

  if (nextStage === 'execute') {
    if (!current.proposal) {
      throw new IncidentTransitionError('Execution requires a proposed remediation.')
    }

    const authorization = validateAuthorization(current.id, current.proposal, current.authorization, now)

    return {
      ...current,
      stage: nextStage,
      authorization: { ...authorization, status: 'consumed' },
    }
  }

  if (nextStage === 'verify') {
    if (!current.execution?.success || !current.execution.appliedAt) {
      throw new IncidentTransitionError('Verification requires a recorded successful execution attempt.')
    }
  }

  if (nextStage === 'audit' && !allRequiredChecksPassed(current.verification)) {
    throw new IncidentTransitionError('Audit cannot finalize until every required recovery check passes.')
  }

  if (nextStage === 'resolved' && !current.auditRecordedAt) {
    throw new IncidentTransitionError('Resolution requires a recorded audit trail.')
  }

  return { ...current, stage: nextStage }
}
