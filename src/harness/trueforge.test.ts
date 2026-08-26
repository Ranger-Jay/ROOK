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
      { ...base, type: 'model.message.delta', content: 'Connection response received.' },
      'sess_01',
      undefined,
      observedAt,
    )

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ type: 'agent.message.delta', text: 'Connection response received.' })
  })

  it('ignores unknown future events even when current common provenance fields are absent', () => {
    expect(normalizeTrueForgeEvent({ type: 'future.event', futureField: true }, 'sess_01', undefined, observedAt)).toEqual([])
  })

  it('fails closed when a known event omits its event id or required payload', () => {
    expect(() => normalizeTrueForgeEvent({ type: 'turn.created', turnId: 'turn_01' }, 'sess_01')).toThrow(HarnessProtocolError)
    expect(() => normalizeTrueForgeEvent({ ...base, type: 'tool.response' }, 'sess_01')).toThrow(HarnessProtocolError)
    expect(() => normalizeTrueForgeEvent({ ...base, type: 'model.message.delta', content: '   ' }, 'sess_01')).toThrow(
      /delta content/i,
    )
  })

  it('fails the entire approval observation when any pending call is malformed', () => {
    expect(() => normalizeTrueForgeEvent(
      {
        ...base,
        type: 'tool.approval_required',
        toolCalls: [
          { id: 'call_01', sourceEventId: 'msg_01' },
          { id: 'call_02' },
        ],
      },
      'sess_01',
      undefined,
      observedAt,
    )).toThrow(/approval entry 1 source event id/i)
  })

  it('preserves every approval reference when all entries are valid', () => {
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

    expect(events).toHaveLength(2)
    expect(events[0]).toMatchObject({ type: 'approval.requested', approvalId: 'call_01', sourceMessageId: 'msg_01' })
    expect(events[1]).toMatchObject({ type: 'approval.requested', approvalId: 'call_02', sourceMessageId: 'msg_02' })
  })

  it('fails the entire MCP authorization observation when any target is malformed', () => {
    expect(() => normalizeTrueForgeEvent(
      {
        ...base,
        type: 'mcp.auth_required',
        mcpServers: [
          { name: 'metrics', authUrl: 'http://localhost/auth/metrics' },
          { name: 'history' },
        ],
      },
      'sess_01',
      undefined,
      observedAt,
    )).toThrow(/target 1 URL/i)
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
})

describe('assertLocalTrueForgeUrl', () => {
  it('accepts only credential-free local origins', () => {
    expect(assertLocalTrueForgeUrl('http://localhost:8790')).toBe('http://localhost:8790')
    expect(assertLocalTrueForgeUrl('http://127.0.0.1:8790/')).toBe('http://127.0.0.1:8790')
  })

  it('rejects hosted, remote, malformed, and endpoint-path targets', () => {
    expect(() => assertLocalTrueForgeUrl('https://trueforge.example.com')).toThrow(/only the official local no-login/i)
    expect(() => assertLocalTrueForgeUrl('http://192.168.1.50:8790')).toThrow(/only the official local no-login/i)
    expect(() => assertLocalTrueForgeUrl('http://localhost:8790/api/sessions')).toThrow(/only the local TrueForge origin/i)
    expect(() => assertLocalTrueForgeUrl('not-a-url')).toThrow(/valid URL/i)
  })

  it('rejects every URL component that can carry browser-visible secrets', () => {
    expect(() => assertLocalTrueForgeUrl('http://user@localhost:8790')).toThrow(/credential-free/i)
    expect(() => assertLocalTrueForgeUrl('http://user:pass@localhost:8790')).toThrow(/credential-free/i)
    expect(() => assertLocalTrueForgeUrl('http://localhost:8790?token=secret')).toThrow(/credential-free/i)
    expect(() => assertLocalTrueForgeUrl('http://localhost:8790#token=secret')).toThrow(/credential-free/i)
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
    expect(instruction).toBe('Verify the text-only TrueForge connection.')
    yield {
      sequence: '1',
      event: { id: 'evt_turn', type: 'turn.created', threadId: null, turnId: 'turn_01' },
    }
    yield {
      sequence: '2',
      event: { id: 'evt_delta', type: 'model.message.delta', threadId: 'main', content: 'Session active.' },
    }
    yield {
      sequence: '3',
      event: { id: 'evt_done', type: 'turn.done', threadId: null, state: { status: 'done', requiredActions: [] } },
    }
  }
}

class TruncatedTransport implements TrueForgeTransport {
  async createSession(_seed: TrueForgeSessionSeed): Promise<{ id: string }> {
    return { id: 'sess_truncated' }
  }

  async *streamTurn(): AsyncIterable<TrueForgeStreamItem> {
    yield { event: { id: 'evt_start', type: 'turn.created', turnId: 'turn_truncated', threadId: null } }
    yield { event: { id: 'evt_delta', type: 'model.message.delta', content: 'partial', threadId: 'main' } }
  }
}

class DuplicateTerminalTransport implements TrueForgeTransport {
  async createSession(_seed: TrueForgeSessionSeed): Promise<{ id: string }> {
    return { id: 'sess_duplicate' }
  }

  async *streamTurn(): AsyncIterable<TrueForgeStreamItem> {
    yield { event: { id: 'evt_done_1', type: 'turn.done', threadId: null, state: { status: 'done', requiredActions: [] } } }
    yield { event: { id: 'evt_done_2', type: 'turn.done', threadId: null, state: { status: 'done', requiredActions: [] } } }
  }
}

class CapabilityDriftTransport implements TrueForgeTransport {
  async createSession(_seed: TrueForgeSessionSeed): Promise<{ id: string }> {
    return { id: 'sess_drift' }
  }

  async *streamTurn(): AsyncIterable<TrueForgeStreamItem> {
    yield { event: { id: 'evt_tool', type: 'tool.response', threadId: 'main', toolCallId: 'call_unexpected' } }
  }
}

class RequiredActionDriftTransport implements TrueForgeTransport {
  async createSession(_seed: TrueForgeSessionSeed): Promise<{ id: string }> {
    return { id: 'sess_action_drift' }
  }

  async *streamTurn(): AsyncIterable<TrueForgeStreamItem> {
    yield {
      event: {
        id: 'evt_done',
        type: 'turn.done',
        threadId: null,
        state: { status: 'done', requiredActions: [{ type: 'tool.approval_required' }] },
      },
    }
  }
}

class FailingTransport implements TrueForgeTransport {
  async createSession(_seed: TrueForgeSessionSeed): Promise<{ id: string }> {
    return { id: 'sess_fail' }
  }

  async *streamTurn(): AsyncIterable<TrueForgeStreamItem> {
    throw new Error('connection refused')
  }
}

const createAdapter = (transport: TrueForgeTransport) => new TrueForgeHarnessAdapter(
  { modelName: 'anthropic/claude-sonnet-4-6' },
  transport,
  () => observedAt,
)

const createSession = (adapter: TrueForgeHarnessAdapter) => adapter.createIncidentSession({
  incidentId: 'INC-2048',
  title: 'Inventory Retry Storm',
  objective: 'Verify the live harness connection without mutation.',
})

describe('TrueForgeHarnessAdapter', () => {
  it('creates a model-only inline session seed with explicit no-authority instructions', async () => {
    const transport = new FakeTransport()
    const adapter = createAdapter(transport)
    const session = await createSession(adapter)

    expect(transport.capturedSeed?.modelName).toBe('anthropic/claude-sonnet-4-6')
    expect(transport.capturedSeed?.instructions).toContain('no MCP tools, skills, sandbox, or mutation authority')
    expect(transport.capturedSeed?.instructions).toContain('Never claim that you observed telemetry')
    expect(transport.capturedSeed?.instructions).toContain('INC-2048 — Inventory Retry Storm')
    expect(Object.keys(transport.capturedSeed ?? {}).sort()).toEqual(['instructions', 'modelName'])
    expect(session).toEqual({
      incidentId: 'INC-2048',
      sessionId: 'sess_live_01',
      observation: { source: 'trueforge-session-response', observedAt },
    })
  })

  it('observes exactly one terminal streamed turn and returns to ready', async () => {
    const adapter = createAdapter(new FakeTransport())
    const session = await createSession(adapter)
    const received: HarnessEvent[] = []
    const unsubscribe = adapter.subscribe(session.sessionId, (event) => received.push(event))

    await adapter.runTurn({ sessionId: session.sessionId, instruction: 'Verify the text-only TrueForge connection.' })
    unsubscribe()

    expect(adapter.connectionState).toBe('ready')
    expect(received.map((event) => event.type)).toEqual(['turn.started', 'agent.message.delta', 'turn.completed'])
    expect(received.every((event) => event.source === 'trueforge')).toBe(true)
  })

  it('fails if the stream closes without terminal turn evidence', async () => {
    const adapter = createAdapter(new TruncatedTransport())
    const session = await createSession(adapter)
    const received: HarnessEvent[] = []
    adapter.subscribe(session.sessionId, (event) => received.push(event))

    await expect(adapter.runTurn({ sessionId: session.sessionId, instruction: 'Verify.' })).rejects.toThrow(/ended before one terminal/i)

    expect(adapter.connectionState).toBe('failed')
    expect(received.at(-1)).toMatchObject({ type: 'error', source: 'rook-adapter' })
  })

  it('fails if more than one terminal turn event is observed', async () => {
    const adapter = createAdapter(new DuplicateTerminalTransport())
    const session = await createSession(adapter)

    await expect(adapter.runTurn({ sessionId: session.sessionId, instruction: 'Verify.' })).rejects.toThrow(/more than one terminal/i)
    expect(adapter.connectionState).toBe('failed')
  })

  it('fails closed if the text-only session unexpectedly exposes a capability event', async () => {
    const adapter = createAdapter(new CapabilityDriftTransport())
    const session = await createSession(adapter)

    await expect(adapter.runTurn({ sessionId: session.sessionId, instruction: 'Verify.' })).rejects.toThrow(
      /unexpected capability event tool.returned/i,
    )
    expect(adapter.connectionState).toBe('failed')
  })

  it('fails closed if a text-only terminal state carries a required action', async () => {
    const adapter = createAdapter(new RequiredActionDriftTransport())
    const session = await createSession(adapter)

    await expect(adapter.runTurn({ sessionId: session.sessionId, instruction: 'Verify.' })).rejects.toThrow(/required action/i)
    expect(adapter.connectionState).toBe('failed')
  })

  it('fails visibly and records adapter-origin error evidence when streaming fails', async () => {
    const adapter = createAdapter(new FailingTransport())
    const session = await createSession(adapter)
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
