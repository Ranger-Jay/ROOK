import { describe, expect, it } from 'vitest'
import {
  assertDistinctV004AuthoritySessions,
  buildV004ObservationAgentSpec,
  buildV004ReproductionAgentSpec,
} from './v004SplitAuthorityTransport'

describe('v0.004 split-authority transport invariants', () => {
  it('rejects an authority handoff that reuses the observation TrueForge session ID', () => {
    expect(() => assertDistinctV004AuthoritySessions('sess_same', 'sess_same'))
      .toThrow(/requires a distinct reproduction TrueForge session/i)
  })

  it('accepts two non-empty distinct TrueForge session IDs', () => {
    expect(() => assertDistinctV004AuthoritySessions('sess_observe', 'sess_reproduce')).not.toThrow()
  })

  it('keeps observation and reproduction authority mutually exclusive in their inline specs', () => {
    const seed = { modelName: 'ollama-local/qwen2-5-1-5b', instructions: 'bounded proof' }
    const observation = buildV004ObservationAgentSpec(seed)
    const reproduction = buildV004ReproductionAgentSpec(seed)

    expect(observation.config.sandbox).toEqual({ enabled: false })
    expect(observation.mcpServers).toHaveLength(1)

    expect('mcpServers' in reproduction).toBe(false)
    expect(reproduction.config.sandbox).toEqual({ enabled: true, fileDownloads: false })
  })
})
