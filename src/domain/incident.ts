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

export interface VerificationCheck {
  id: string
  label: string
  required: boolean
  status: CheckStatus
  evidence?: string
}

export interface IncidentState {
  id: string
  stage: IncidentStage
  proposal?: ProposedAction
  authorization?: AuthorizationArtifact
  execution?: ExecutionRecord
  verification: readonly VerificationCheck[]
  auditRecordedAt?: string
}

export function allRequiredChecksPassed(checks: readonly VerificationCheck[]): boolean {
  const required = checks.filter((check) => check.required)
  return required.length > 0 && required.every((check) => check.status === 'passed')
}
