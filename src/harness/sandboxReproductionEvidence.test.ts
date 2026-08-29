import { describe, expect, it } from 'vitest'
import type { HarnessEvent } from './adapter'
import {
  ROOK_V004_SANDBOX_COMMAND,
  ROOK_V004_SANDBOX_INTENT,
} from './v004'
import {
  correlateSandboxReproductionEvidence,
  projectReproducedRetryPressure,
  selectLatestReproducedRetryPressure,
} from './sandboxReproductionEvidence'

const evidence = {
  source: 'trueforge' as const,
  observedAt: '2026-08-29T19:00:00.000Z',
}

const validEvents = (): HarnessEvent[] => [
  {
    ...evidence,
    sourceEventId: 'evt_call',
    sourceTimestamp: '2026-08-29T18:59:57.000Z',
    threadId: 'main',
    type: 'sandbox.exec.called',
    sessionId: 'sess_v004',
    callId: 'call_sandbox',
    toolName: 'exec',
    arguments: JSON.stringify({ intent: ROOK_V004_SANDBOX_INTENT, command: ROOK_V004_SANDBOX_COMMAND }),
  },
  {
    ...evidence,
    sourceEventId: 'evt_sandbox',
    sourceTimestamp: '2026-08-29T18:59:58.000Z',
    threadId: null,
    type: 'sandbox.started',
    sessionId: 'sess_v004',
    sandboxId: 'rook.sandbox.01',
  },
  {
    ...evidence,
    sourceEventId: 'evt_response',
    sourceTimestamp: '2026-08-29T18:59:59.000Z',
    threadId: 'main',
    type: 'sandbox.exec.returned',
    sessionId: 'sess_v004',
    callId: 'call_sandbox',
    content: JSON.stringify({
      success: true,
      response: {
        exitCode: 0,
        result: JSON.stringify({
          kind: 'rook-v004-reproduction',
          retryMultiplier: 5.3,
          attemptsPerMinute: 4800,
          baselineAttemptsPerMinute: 900,
          queueDepth: 7200,
          queueSaturationPct: 91,
        }) + '\n',
      },
    }),
  },
]

describe('sandbox reproduction public-truth projection', () => {
  it('correlates the exec, sandbox.created, and response without inventing provider identity', () => {
    const [pair] = correlateSandboxReproductionEvidence(validEvents())
    expect(pair).toEqual(expect.objectContaining({
      callId: 'call_sandbox',
      sandboxId: 'rook.sandbox.01',
      callSourceEventId: 'evt_call',
      sandboxSourceEventId: 'evt_sandbox',
      responseSourceEventId: 'evt_response',
    }))
    expect(pair).not.toHaveProperty('provider')
  })

  it('projects only the exact deterministic successful reproduction payload', () => {
    const [pair] = correlateSandboxReproductionEvidence(validEvents())
    const projected = projectReproducedRetryPressure(pair!)
    expect(projected).toEqual({
      evidenceState: 'reproduced',
      kind: 'rook-v004-reproduction',
      retryMultiplier: 5.3,
      attemptsPerMinute: 4800,
      baselineAttemptsPerMinute: 900,
      queueDepth: 7200,
      queueSaturationPct: 91,
      sandboxId: 'rook.sandbox.01',
      callId: 'call_sandbox',
      callSourceEventId: 'evt_call',
      sandboxSourceEventId: 'evt_sandbox',
      responseSourceEventId: 'evt_response',
    })
  })

  it('rejects a response without sandbox.created evidence', () => {
    const events = validEvents().filter(event => event.type !== 'sandbox.started')
    expect(selectLatestReproducedRetryPressure(events)).toBeNull()
  })

  it('rejects command drift even when the returned numbers look correct', () => {
    const events = validEvents()
    const call = events[0] as Extract<HarnessEvent, { type: 'sandbox.exec.called' }>
    call.arguments = JSON.stringify({ intent: ROOK_V004_SANDBOX_INTENT, command: 'python -c "print(5.3)"' })
    expect(selectLatestReproducedRetryPressure(events)).toBeNull()
  })

  it('rejects provider errors, non-zero exits, malformed result JSON, metric drift, and extra payload keys', () => {
    const mutateResponse = (mutator: (outer: Record<string, any>) => void) => {
      const events = validEvents()
      const returned = events[2] as Extract<HarnessEvent, { type: 'sandbox.exec.returned' }>
      const outer = JSON.parse(returned.content) as Record<string, any>
      mutator(outer)
      returned.content = JSON.stringify(outer)
      return selectLatestReproducedRetryPressure(events)
    }

    expect(mutateResponse(outer => { outer.success = false })).toBeNull()
    expect(mutateResponse(outer => { outer.response.exitCode = 2 })).toBeNull()
    expect(mutateResponse(outer => { outer.response.result = 'not-json' })).toBeNull()
    expect(mutateResponse(outer => {
      const result = JSON.parse(outer.response.result) as Record<string, unknown>
      result.retryMultiplier = 5.4
      outer.response.result = JSON.stringify(result)
    })).toBeNull()
    expect(mutateResponse(outer => {
      const result = JSON.parse(outer.response.result) as Record<string, unknown>
      result.unreviewed = true
      outer.response.result = JSON.stringify(result)
    })).toBeNull()
  })
})
