export const INCIDENT_STAGES = [
  'detect',
  'investigate',
  'delegate',
  'sandbox',
  'propose',
  'approve',
  'execute',
  'verify',
  'audit',
  'resolved',
] as const

export type IncidentStage = (typeof INCIDENT_STAGES)[number]
export type RiskLevel = 'low' | 'moderate' | 'high' | 'critical'
export type AuthorizationStatus = 'authorized' | 'consumed' | 'expired' | 'revoked'
export type CheckStatus = 'pending' | 'passed' | 'failed'

export interface ProposedAction {
  id: string
  type: string
  resources: readonly string[]
  summary: string
  risk: RiskLevel
  expectedResult: string
  rollbackPlan: string
}

export interface AuthorizationArtifact {
  id: string
  incidentId: string
  actionId: string
  actionType: string
  proposalFingerprint: string
  resources: readonly string[]
  approvedBy: string
  approvedAt: string
  expiresAt: string
  status: AuthorizationStatus
}

export interface ExecutionRecord {
  actionId: string
  resources: readonly string[]
  appliedAt: string
  success: boolean
}

interface VerificationCheckBase {
  id: string
  label: string
  required: boolean
}

export type VerificationCheck =
  | (VerificationCheckBase & { status: 'pending'; evidence?: never })
  | (VerificationCheckBase & { status: 'failed'; evidence: string })
  | (VerificationCheckBase & { status: 'passed'; evidence: string })

export interface IncidentState {
  id: string
  stage: IncidentStage
  proposal?: ProposedAction
  authorization?: AuthorizationArtifact
  execution?: ExecutionRecord
  verification: readonly VerificationCheck[]
  auditRecordedAt?: string
}

function normalizedResourceList(resources: readonly string[]): string[] {
  return [...new Set(resources)].sort()
}

/**
 * Canonical structural fingerprint of every proposal field a human approves.
 * This is an equality binding, not a cryptographic signature; the persistent
 * authorization store remains responsible for artifact integrity.
 */
export function proposalFingerprint(proposal: ProposedAction): string {
  return JSON.stringify({
    id: proposal.id,
    type: proposal.type,
    resources: normalizedResourceList(proposal.resources),
    summary: proposal.summary,
    risk: proposal.risk,
    expectedResult: proposal.expectedResult,
    rollbackPlan: proposal.rollbackPlan,
  })
}

export function allRequiredChecksPassed(checks: readonly VerificationCheck[]): boolean {
  const required = checks.filter((check) => check.required)
  return (
    required.length > 0 &&
    required.every((check) => check.status === 'passed' && check.evidence.trim().length > 0)
  )
}
