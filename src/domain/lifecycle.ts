import type { AuditProvenanceStore } from './auditProvenance'
import type { AuthorizationClaimStore } from './authorizationClaims'
import {
  allRequiredChecksPassed,
  normalizedResourceList,
  proposalFingerprint,
  verificationFingerprint,
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

function exactResourceMatch(left: readonly string[], right: readonly string[]): boolean {
  const a = normalizedResourceList(left)
  const b = normalizedResourceList(right)
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
  if (authorization.actionType !== proposal.type) {
    throw new IncidentTransitionError('Authorization does not match the proposed action type.')
  }
  if (authorization.proposalFingerprint !== proposalFingerprint(proposal)) {
    throw new IncidentTransitionError('Authorization does not match the exact approved proposal.')
  }
  if (!exactResourceMatch(authorization.resources, proposal.resources)) {
    throw new IncidentTransitionError('Authorization scope does not exactly match the proposed resources.')
  }

  const approvedAt = parseTime(authorization.approvedAt, 'approvedAt')
  const expiresAt = parseTime(authorization.expiresAt, 'expiresAt')
  const currentTime = Date.now()

  if (expiresAt <= approvedAt) {
    throw new IncidentTransitionError('Authorization expiry must be later than approval time.')
  }
  if (currentTime < approvedAt) {
    throw new IncidentTransitionError('Authorization is not valid before its approval time.')
  }
  if (currentTime >= expiresAt) {
    throw new IncidentTransitionError('Authorization has expired.')
  }

  return authorization
}

function assertExecutionMatchesApproval(current: IncidentState): void {
  const execution = current.execution
  const authorization = current.authorization
  const proposal = current.proposal

  if (!execution?.success || !execution.appliedAt) {
    throw new IncidentTransitionError('Verification requires a recorded successful execution attempt.')
  }
  if (!authorization || authorization.status !== 'consumed') {
    throw new IncidentTransitionError('Verification requires the consumed authorization used for execution.')
  }
  if (!proposal) {
    throw new IncidentTransitionError('Verification requires the approved proposal used for execution.')
  }

  const matchesAuthorization =
    execution.actionId === authorization.actionId &&
    execution.actionType === authorization.actionType &&
    execution.proposalFingerprint === authorization.proposalFingerprint &&
    exactResourceMatch(execution.resources, authorization.resources)

  const matchesProposal =
    execution.actionId === proposal.id &&
    execution.actionType === proposal.type &&
    execution.proposalFingerprint === proposalFingerprint(proposal) &&
    exactResourceMatch(execution.resources, proposal.resources)

  if (!matchesAuthorization || !matchesProposal) {
    throw new IncidentTransitionError('Verification execution does not match the exact approved remediation.')
  }
}

function auditBindingFingerprint(current: IncidentState, recordedAt: string): string {
  const authorization = current.authorization
  const proposal = current.proposal
  const execution = current.execution

  if (!authorization || !proposal || !execution) {
    throw new IncidentTransitionError('Audit provenance requires authorization, proposal, and execution state.')
  }

  return JSON.stringify({
    incidentId: current.id,
    authorizationId: authorization.id,
    proposalFingerprint: proposalFingerprint(proposal),
    execution: {
      actionId: execution.actionId,
      actionType: execution.actionType,
      proposalFingerprint: execution.proposalFingerprint,
      resources: normalizedResourceList(execution.resources),
      appliedAt: execution.appliedAt,
      success: execution.success,
    },
    verificationFingerprint: verificationFingerprint(current.verification),
    recordedAt,
  })
}

export class IncidentLifecycle {
  constructor(
    private readonly authorizationClaims: AuthorizationClaimStore,
    private readonly auditProvenance: AuditProvenanceStore,
  ) {}

  async transition(current: IncidentState, nextStage: IncidentStage): Promise<IncidentState> {
    if (!ALLOWED_TRANSITIONS[current.stage].includes(nextStage)) {
      throw new IncidentTransitionError(`Transition ${current.stage} → ${nextStage} is not allowed.`)
    }

    if (nextStage === 'execute') {
      if (!current.proposal) {
        throw new IncidentTransitionError('Execution requires a proposed remediation.')
      }

      const authorization = validateAuthorization(current.id, current.proposal, current.authorization)
      const claimed = await this.authorizationClaims.claimOnce(authorization.id)

      if (!claimed) {
        throw new IncidentTransitionError('Authorization has already been consumed by another execution attempt.')
      }

      return {
        ...current,
        stage: nextStage,
        authorization: { ...authorization, status: 'consumed' },
      }
    }

    if (nextStage === 'verify') {
      assertExecutionMatchesApproval(current)
    }

    if (nextStage === 'audit') {
      assertExecutionMatchesApproval(current)

      if (!allRequiredChecksPassed(current.verification)) {
        throw new IncidentTransitionError('Audit cannot finalize until every required recovery check passes with evidence.')
      }

      const recordedAt = new Date(Date.now()).toISOString()
      const fingerprint = auditBindingFingerprint(current, recordedAt)
      const provenanceToken = await this.auditProvenance.issue(fingerprint)

      return {
        ...current,
        stage: 'audit',
        audit: {
          provenanceToken,
          incidentId: current.id,
          authorizationId: current.authorization!.id,
          proposalFingerprint: proposalFingerprint(current.proposal!),
          verificationFingerprint: verificationFingerprint(current.verification),
          recordedAt,
        },
      }
    }

    if (nextStage === 'resolved') {
      assertExecutionMatchesApproval(current)

      if (!allRequiredChecksPassed(current.verification)) {
        throw new IncidentTransitionError('Resolution requires evidence-backed recovery checks to remain valid.')
      }

      const audit = current.audit
      const authorization = current.authorization
      const proposal = current.proposal
      const execution = current.execution

      if (!audit || !authorization || !proposal || !execution) {
        throw new IncidentTransitionError('Resolution requires a lifecycle-issued audit record.')
      }

      const auditTime = parseTime(audit.recordedAt, 'audit.recordedAt')
      const appliedAt = parseTime(execution.appliedAt, 'execution.appliedAt')
      const expectedProposalFingerprint = proposalFingerprint(proposal)
      const expectedVerificationFingerprint = verificationFingerprint(current.verification)

      if (auditTime < appliedAt) {
        throw new IncidentTransitionError('Audit record cannot predate the approved execution.')
      }

      if (
        audit.incidentId !== current.id ||
        audit.authorizationId !== authorization.id ||
        audit.proposalFingerprint !== expectedProposalFingerprint ||
        audit.verificationFingerprint !== expectedVerificationFingerprint
      ) {
        throw new IncidentTransitionError('Audit record does not match the current verified incident state.')
      }

      const fingerprint = auditBindingFingerprint(current, audit.recordedAt)
      const provenanceValid = await this.auditProvenance.verify(audit.provenanceToken, fingerprint)

      if (!provenanceValid) {
        throw new IncidentTransitionError('Audit record provenance is invalid or was not issued by ROOK.')
      }
    }

    return { ...current, stage: nextStage }
  }
}
