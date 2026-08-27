import { describe, expect, it } from 'vitest'
import type { HarnessEvent } from './adapter'
import { V003_PROOF_INSTRUCTION, evidenceEventLabel } from './TrueForgeProof'

describe('TrueForge v0.003 proof truth boundary', () => {
  it('shows the authentic TrueForge terminal event name in the evidence row', () => {
    const event: HarnessEvent = {
      type: 'turn.completed',
      sessionId: 'session_live',
      status: 'done',
      requiredActionCount: 0,
      source: 'trueforge',
      sourceEventId: 'event_done',
      observedAt: '2026-08-27T01:08:15.474Z',
    }

    expect(evidenceEventLabel(event)).toBe('turn.done')
  })

  it('requires the observed retry-pressure tool while forbidding authority expansion', () => {
    expect(V003_PROOF_INSTRUCTION).toContain('call get_retry_pressure exactly once')
    expect(V003_PROOF_INSTRUCTION).toContain('label any causal explanation as inferred')
    expect(V003_PROOF_INSTRUCTION).toContain('Do not request mutation, approval, sandbox, subagent')
    expect(V003_PROOF_INSTRUCTION).not.toContain('text-only')
  })
})
