import { describe, expect, it } from 'vitest'
import type { HarnessEvent } from './adapter'
import {
  V004_PROOF_INSTRUCTION,
  evidenceEventLabel,
  shouldPromoteReproducedEvidence,
} from './TrueForgeProof'

describe('TrueForge v0.004 proof truth boundary', () => {
  it('shows the authentic TrueForge terminal event name in the evidence row', () => {
    const event: HarnessEvent = {
      type: 'turn.completed',
      sessionId: 'session_live',
      status: 'done',
      requiredActionCount: 0,
      source: 'trueforge',
      sourceEventId: 'event_done',
      observedAt: '2026-08-29T19:08:15.474Z',
    }

    expect(evidenceEventLabel(event)).toBe('turn.done')
  })

  it('uses a single high-level UI instruction while the adapter owns the split-authority phase prompts', () => {
    expect(V004_PROOF_INSTRUCTION).toBe('Run the split-authority v0.004 observation and bounded sandbox reproduction proof.')
    expect(V004_PROOF_INSTRUCTION).toContain('split-authority')
    expect(V004_PROOF_INSTRUCTION).toContain('observation')
    expect(V004_PROOF_INSTRUCTION).toContain('sandbox reproduction')
  })

  it('promotes the REPRODUCED claim card only after the whole proof reaches its final reproduced state', () => {
    expect(shouldPromoteReproducedEvidence('reproduced')).toBe(true)
    expect(shouldPromoteReproducedEvidence('failed')).toBe(false)
    expect(shouldPromoteReproducedEvidence('connecting')).toBe(false)
    expect(shouldPromoteReproducedEvidence('idle')).toBe(false)
    expect(shouldPromoteReproducedEvidence('unconfigured')).toBe(false)
  })

  it('retains distinct public labels for sandbox creation, execution, and return evidence', () => {
    const base = {
      sessionId: 'session_live',
      source: 'trueforge' as const,
      observedAt: '2026-08-29T19:08:15.474Z',
    }
    const started: HarnessEvent = {
      ...base,
      type: 'sandbox.started',
      sandboxId: 'rook.sandbox.01',
      sourceEventId: 'event_sandbox',
    }
    const called: HarnessEvent = {
      ...base,
      type: 'sandbox.exec.called',
      callId: 'call_sandbox',
      arguments: '{}',
      toolName: 'exec',
      sourceEventId: 'event_call',
    }
    const returned: HarnessEvent = {
      ...base,
      type: 'sandbox.exec.returned',
      callId: 'call_sandbox',
      content: '{}',
      sourceEventId: 'event_response',
    }

    expect(evidenceEventLabel(started)).toBe('sandbox.started')
    expect(evidenceEventLabel(called)).toBe('sandbox.exec.called')
    expect(evidenceEventLabel(returned)).toBe('sandbox.exec.returned')
  })
})
