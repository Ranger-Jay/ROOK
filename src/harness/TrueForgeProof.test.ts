import { describe, expect, it } from 'vitest'
import type { HarnessEvent } from './adapter'
import { evidenceEventLabel } from './TrueForgeProof'

describe('TrueForge proof evidence labels', () => {
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
})
