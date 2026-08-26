import { describe, expect, it } from 'vitest'
import type { HarnessEvent } from './adapter'
import {
  HarnessProtocolError,
  TrueForgeHarnessAdapter,
  assertLocalTrueForgeUrl,
  normalizeTrueForgeEvent,
  type TrueForgeSessionSeed,
  type TrueForgeStreamItem,
  type TrueForgeTransport,
} from './trueforge'

const observedAt = '2026-08-26T04:00:00.000Z'

const base = {
  id: 'evt_01',
  createdAt: '2026-08-26T03:59:59.000Z',
  threadId: 'main',
}

describe('normalizeTrueForgeEvent', () => {
  it('preserves TrueForge evidence on turn start', () => {
    const [event] = normalizeTrueForgeEvent(
      { ...base, type: 'turn.created', turnId: 'turn_01' },
      'sess_01',
      '42',
      observedAt,
    )

    expect(event).toEqual({
      source: 'trueforge',
      sourceEventId: 'evt_01',
      sourceTimestamp: '2026-08-26T03:59:59.000Z',
      observedAt,
      sequence: '42',
      threadId: 'main',
      type: 'turn.started',
      sessionId: 'sess_01',
      turnId: 'turn_01',
    })
  })

  it('normalizes streamed assistant text without promoting it to verification evidence', () => {
    const events = normalizeTrueForgeEvent(
      { ...base, type: 'model.message.delta', content: 'Investigating retry pressure.' },
      'sess_01',
      undefined,
      observedAt,
    )

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ type: 'agent.message.delta', text: 'Investigating retry pressure.' })
  })

  it('emits one observable approval request per TrueForge pending tool call', () => {
    const events = normalizeTrueForgeEvent(
      {
        ...base,
        type: 'tool.approval_required',
        toolCalls: [
          { id: 'call_01', sourceEventId: 'msg_01' },
          { id: 'call_02', sourceEventId: 'msg_02' },
        ],
      },
      'sess_01',
      undefined,
      observedAt,
    )

    expect(events.map((event) => event.type)).toEqual(['approval.requested', 'approval.requested'])
    expect(events[0]).toMatchObject({ approvalId: 'call_01', sourceMessageId: 'msg_01' })
    expect(events[1]).toMatchObject({ approvalId: 'call_02', sourceMessageId: 'msg_02' })
  })

  it('reports terminal turn state and pending-action count exactly as emitted', () => {
    const [event] = normalizeTrueForgeEvent(
      {
        ...base,
        threadId: null,
        type: 'turn.done',
        state: {
          status: 'done',
          requiredActions: [{ type: 'tool.approval_required' }],
        },
      },
      'sess_01',
      '99',
      observedAt,
    )

    expect(event).toMatchObject({
      type: 'turn.completed',
      status: 'done',
      requiredActionCount: 1,
      threadId: null,
      sequence: '99',
    })
  })

  it('ignores unknown event types instead of inventing a ROOK meaning', () => {
    expect(normalizeTrueForgeEvent({ ...base, type: 'future.event' }, 'sess_01', undefined, observedAt)).toEqual([])
  })

  it('fails closed when a known event omits required evidence', () => {
    expect(() => normalizeTrueForgeEvent({ type: 'turn.created', turnId: 'turn_01' }, 'sess_01')).toThrow(HarnessProtocolError)
    expect(() => normalizeTrueForgeEvent({ ...base, type: 'tool.response' }, 'sess_01')).toThrow(HarnessProtocolError)
  })
})

describe('assertLocalTrueForgeUrl', () => {
  it('accepts only the v0.002 local no-login boundary', () => {
    expect(assertLocalTrueForgeUrl('http://localhost:8790')).toBe('http://localhost:8790')
    expect(assertLocalTrueForgeUrl('http://127.0.0.1:8790/')).toBe('http://127.0.0.1:8790')
  })

  it('rejects hosted, encrypted remote, and malformed targets', () => {
    expect(() => assertLocalTrueForgeUrl('https://trueforge.example.com')).toThrow(/only the official local no-login/i)
    expect(() => assertLocalTrueForgeUrl('http://192.168.1.50:8790')).toThrow(/only the official local no-login/i)
    expect(() => assertLocalTrueForgeUrl('not-a-url')).toThrow(/valid URL/i)
  })
})

class FakeTransport implements TrueForgeTransport {
  capturedSeed?: TrueForgeSessionSeed

  async createSession(seed: TrueForgeSessionSeed): Promise<{ id: string }> {
    this.capturedSeed = seed
    return { id: 'sess_live_01' }
  }

  async *streamTurn(sessionId: string, instruction: string): AsyncIterable<TrueForgeStreamItem> {
    expect(sessionId).toBe('sess_live_01')
    expect(instruction).toBe('Investigate read-only telemetry.')
    yield {
      sequence: '1',
      event: { id: 'evt_turn', type: 'turn.created', threadId: null, turnId: 'turn_01' },
    }
    yield {
      sequence: '2',
      event: { id: 'evt_delta', type: 'model.message.delta', threadId: 'main', content: 'Evidence found.' },
    }
    yield {
      sequence: '3',
      event: { id: 'evt_done', type: 'turn.done', threadId: null, state: { status: 'done', requiredActions: [] } },
    }
  }
}

class FailingTransport implements TrueForgeTransport {
  async createSession(): Promise<{ id: string }> {
    return { id: 'sess_fail' }
  }

  async *streamTurn(): AsyncIterable<TrueForgeStreamItem> {
    throw new Error('connection refused')
  }
}

describe('TrueForgeHarnessAdapter', () => {
  it('creates a model-only inline session seed with explicit no-authority instructions', async () => {
    const transport = new FakeTransport()
    const adapter = new TrueForgeHarnessAdapter(
      { modelName: 'anthropic/claude-sonnet-4-6' },
      transport,
      () => observedAt,
    )

    await adapter.createIncidentSession({
      incidentId: 'INC-2048',
      title: 'Inventory Retry Storm',
      objective: 'Verify the live harness connection without mutation.',
    })

    expect(transport.capturedSeed?.modelName).toBe('anthropic/claude-sonnet-4-6')
    expect(transport.capturedSeed?.instructions).toContain('no MCP tools, skills, sandbox, or mutation authority')
    expect(transport.capturedSeed?.instructions).toContain('Never claim that you observed telemetry')
    expect(transport.capturedSeed?.instructions).toContain('INC-2048 — Inventory Retry Storm')
    expect(Object.keys(transport.capturedSeed ?? {}).sort()).toEqual(['instructions', 'modelName'])
  })

  it('creates a real session boundary and emits normalized streamed evidence', async () => {
    const transport = new FakeTransport()
    const adapter = new TrueForgeHarnessAdapter(
      { modelName: 'anthropic/claude-sonnet-4-6' },
      transport,
      () => observedAt,
    )

    const session = await adapter.createIncidentSession({
      incidentId: 'INC-2048',
      title: 'Inventory Retry Storm',
      objective: 'Verify the live harness connection without mutation.',
    })

    expect(session).toEqual({ incidentId: 'INC-2048', sessionId: 'sess_live_01' })
    expect(adapter.connectionState).toBe('ready')

    const received: HarnessEvent[] = []
    const unsubscribe = adapter.subscribe(session.sessionId, (event) => received.push(event))

    await adapter.runTurn({ sessionId: session.sessionId, instruction: 'Investigate read-only telemetry.' })
    unsubscribe()

    expect(adapter.connectionState).toBe('ready')
    expect(received.map((event) => event.type)).toEqual(['turn.started', 'agent.message.delta', 'turn.completed'])
    expect(received.every((event) => event.source === 'trueforge')).toBe(true)
  })

  it('fails visibly and emits adapter-origin error evidence when streaming fails', async () => {
    const adapter = new TrueForgeHarnessAdapter(
      { modelName: 'anthropic/claude-sonnet-4-6' },
      new FailingTransport(),
      () => observedAt,
    )
    const session = await adapter.createIncidentSession({ incidentId: 'INC-1', title: 'Test', objective: 'Read only.' })
    const received: HarnessEvent[] = []
    adapter.subscribe(session.sessionId, (event) => received.push(event))

    await expect(adapter.runTurn({ sessionId: session.sessionId, instruction: 'Inspect.' })).rejects.toThrow('connection refused')

    expect(adapter.connectionState).toBe('failed')
    expect(received).toHaveLength(1)
    expect(received[0]).toMatchObject({
      type: 'error',
      source: 'rook-adapter',
      message: 'connection refused',
    })
  })
})
