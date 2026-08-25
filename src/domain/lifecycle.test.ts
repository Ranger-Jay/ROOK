import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InMemoryAuthorizationClaimStore } from './authorizationClaims'
import {
  proposalFingerprint,
  type AuthorizationArtifact,
  type IncidentState,
  type ProposedAction,
} from './incident'
import { IncidentLifecycle, IncidentTransitionError, validateAuthorization } from './lifecycle'

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
  actionType: proposal.type,
  proposalFingerprint: proposalFingerprint(proposal),
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
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-25T03:02:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows an exactly scoped, current authorization and consumes it for execution', async () => {
    const lifecycle = new IncidentLifecycle(new InMemoryAuthorizationClaimStore())
    const next = await lifecycle.transition(state(), 'execute')

    expect(next.stage).toBe('execute')
    expect(next.authorization?.status).toBe('consumed')
  })

  it('fails closed when authorization is missing', async () => {
    const lifecycle = new IncidentLifecycle(new InMemoryAuthorizationClaimStore())

    await expect(lifecycle.transition(state({ authorization: undefined }), 'execute')).rejects.toThrow(
      'Execution requires explicit human authorization.',
    )
  })

  it('fails closed when authorized resources do not exactly match the proposal', () => {
    expect(() =>
      validateAuthorization('INC-2048', proposal, {
        ...authorization,
        resources: ['inventory-reservation', 'checkout'],
      }),
    ).toThrow('Authorization scope does not exactly match the proposed resources.')
  })

  it('rejects authorization at its system-clock expiry boundary', () => {
    vi.setSystemTime(new Date(authorization.expiresAt))

    expect(() => validateAuthorization('INC-2048', proposal, authorization)).toThrow('Authorization has expired.')
  })

  it('rejects authorization before its system-clock approval timestamp', () => {
    vi.setSystemTime(new Date('2026-08-25T02:59:59.999Z'))

    expect(() => validateAuthorization('INC-2048', proposal, authorization)).toThrow(
      'Authorization is not valid before its approval time.',
    )
  })

  it('rejects an old approval if the action type changes under the same action id', () => {
    expect(() =>
      validateAuthorization('INC-2048', { ...proposal, type: 'delete-retry-policy' }, authorization),
    ).toThrow('Authorization does not match the proposed action type.')
  })

  it('rejects an old approval if any approved proposal content changes', () => {
    expect(() =>
      validateAuthorization(
        'INC-2048',
        { ...proposal, expectedResult: 'Also restart checkout.' },
        authorization,
      ),
    ).toThrow('Authorization does not match the exact approved proposal.')
  })

  it('atomically rejects replaying the same authorization against the same claim store', async () => {
    const lifecycle = new IncidentLifecycle(new InMemoryAuthorizationClaimStore())

    await lifecycle.transition(state(), 'execute')

    await expect(lifecycle.transition(state(), 'execute')).rejects.toThrow(
      'Authorization has already been consumed by another execution attempt.',
    )
  })

  it('keeps execution and verification separate', async () => {
    const lifecycle = new IncidentLifecycle(new InMemoryAuthorizationClaimStore())

    await expect(lifecycle.transition(state({ stage: 'execute' }), 'verify')).rejects.toThrow(
      'Verification requires a recorded successful execution attempt.',
    )
  })

  it('cannot finalize audit until every required recovery check passes', async () => {
    const lifecycle = new IncidentLifecycle(new InMemoryAuthorizationClaimStore())
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

    await expect(lifecycle.transition(verifying, 'audit')).rejects.toThrow(
      'Audit cannot finalize until every required recovery check passes.',
    )
  })

  it('requires an audit record before resolution', async () => {
    const lifecycle = new IncidentLifecycle(new InMemoryAuthorizationClaimStore())

    await expect(lifecycle.transition(state({ stage: 'audit' }), 'resolved')).rejects.toThrow(
      IncidentTransitionError,
    )
  })
})
