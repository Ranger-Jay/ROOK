import { describe, expect, it } from 'vitest'
import type { AuthorizationArtifact, IncidentState, ProposedAction } from './incident'
import { IncidentTransitionError, transitionIncident, validateAuthorization } from './lifecycle'

const proposal: ProposedAction = {
  id: 'action-retry-backoff-v1',
  type: 'update-retry-policy',
  resources: ['inventory-reservation'],
  summary: 'Restore bounded exponential backoff.',
  risk: 'moderate',
  expectedResult: 'Retry pressure returns to baseline.',
  rollbackPlan: 'Restore previous retry-policy fixture.',
}

const authorization: AuthorizationArtifact = {
  id: 'auth-2048',
  incidentId: 'INC-2048',
  actionId: proposal.id,
  resources: proposal.resources,
  approvedBy: 'Jay',
  approvedAt: '2026-08-25T03:00:00.000Z',
  expiresAt: '2026-08-25T03:05:00.000Z',
  status: 'authorized',
}

const state = (overrides: Partial<IncidentState> = {}): IncidentState => ({
  id: 'INC-2048',
  stage: 'approve',
  proposal,
  authorization,
  verification: [
    { id: 'retry-rate', label: 'Retry rate normalized', required: true, status: 'pending' },
    { id: 'checkout-p95', label: 'Checkout p95 restored', required: true, status: 'pending' },
  ],
  ...overrides,
})

describe('ROOK incident lifecycle', () => {
  it('allows an exactly scoped, current authorization and consumes it for execution', () => {
    const next = transitionIncident(state(), 'execute', '2026-08-25T03:02:00.000Z')

    expect(next.stage).toBe('execute')
    expect(next.authorization?.status).toBe('consumed')
  })

  it('fails closed when authorization is missing', () => {
    expect(() =>
      transitionIncident(state({ authorization: undefined }), 'execute', '2026-08-25T03:02:00.000Z'),
    ).toThrow('Execution requires explicit human authorization.')
  })

  it('fails closed when authorized resources do not exactly match the proposal', () => {
    expect(() =>
      validateAuthorization(
        'INC-2048',
        proposal,
        { ...authorization, resources: ['inventory-reservation', 'checkout'] },
        '2026-08-25T03:02:00.000Z',
      ),
    ).toThrow('Authorization scope does not exactly match the proposed resources.')
  })

  it('rejects authorization at its expiry boundary', () => {
    expect(() =>
      validateAuthorization('INC-2048', proposal, authorization, authorization.expiresAt),
    ).toThrow('Authorization has expired.')
  })

  it('rejects authorization before its approval timestamp', () => {
    expect(() =>
      validateAuthorization('INC-2048', proposal, authorization, '2026-08-25T02:59:59.999Z'),
    ).toThrow('Authorization is not valid before its approval time.')
  })

  it('keeps execution and verification separate', () => {
    expect(() =>
      transitionIncident(state({ stage: 'execute' }), 'verify', '2026-08-25T03:03:00.000Z'),
    ).toThrow('Verification requires a recorded successful execution attempt.')
  })

  it('cannot finalize audit until every required recovery check passes', () => {
    const verifying = state({
      stage: 'verify',
      execution: {
        actionId: proposal.id,
        resources: proposal.resources,
        appliedAt: '2026-08-25T03:02:30.000Z',
        success: true,
      },
      verification: [
        { id: 'retry-rate', label: 'Retry rate normalized', required: true, status: 'passed' },
        { id: 'checkout-p95', label: 'Checkout p95 restored', required: true, status: 'failed' },
      ],
    })

    expect(() => transitionIncident(verifying, 'audit', '2026-08-25T03:04:00.000Z')).toThrow(
      'Audit cannot finalize until every required recovery check passes.',
    )
  })

  it('requires an audit record before resolution', () => {
    expect(() =>
      transitionIncident(state({ stage: 'audit' }), 'resolved', '2026-08-25T03:04:30.000Z'),
    ).toThrow(IncidentTransitionError)
  })
})
