import { describe, expect, it } from 'vitest'
import type { IncidentSessionRequest } from './adapter'
import type {
  TrueForgeSessionSeed,
  TrueForgeStreamItem,
  TrueForgeTransport,
} from './trueforge'
import {
  ROOK_V003_MCP_SERVER_NAME,
  V003TrueForgeHarnessAdapter,
} from './v003'

const observedAt = '2026-08-27T20:30:00.000Z'
const incident: IncidentSessionRequest = {
  incidentId: 'INC-2048',
  title: 'Inventory Retry Storm',
  objective: 'Prove retry pressure through owned read-only evidence.',
}

const mcpCall = (callId: string, toolName: string, eventId = `evt_${callId}`) => ({
  id: eventId,
  type: 'model.message',
  threadId: 'main',
  createdAt: '2026-08-27T20:29:58.000Z',
  toolCalls: [{
    id: callId,
    type: 'function',
    function: { name: toolName, arguments: '{}' },
    toolInfo: {
      type: 'mcp',
      serverId: 'mcp_rook_01',
      serverName: ROOK_V003_MCP_SERVER_NAME,
      name: toolName,
    },
  }],
})

const mcpResponse = (callId: string, eventId = `evt_response_${callId}`) => ({
  id: eventId,
  type: 'tool.response',
  threadId: 'main',
  toolCallId: callId,
  content: '{"source":{"classification":"owned-demo-non-production"}}',
  createdAt: '2026-08-27T20:29:59.000Z',
})

const turnDone = () => ({
  id: 'evt_done',
  type: 'turn.done',
  threadId: null,
  createdAt: observedAt,
  state: { status: 'done', requiredActions: [] },
})

class ScriptedTransport implements TrueForgeTransport {
  constructor(private readonly items: TrueForgeStreamItem[]) {}

  async createSession(_seed: TrueForgeSessionSeed): Promise<{ id: string }> {
    return { id: 'sess_v003_contract' }
  }

  async *streamTurn(): AsyncIterable<TrueForgeStreamItem> {
    for (const item of this.items) yield item
  }
}

const runProof = async (events: unknown[]) => {
  const adapter = new V003TrueForgeHarnessAdapter(
    { modelName: 'ollama-local/qwen2-5-1-5b' },
    new ScriptedTransport(events.map((event, index) => ({ sequence: String(index + 1), event }))),
    () => observedAt,
  )
  const session = await adapter.createIncidentSession(incident)
  const result = adapter.runTurn({
    sessionId: session.sessionId,
    instruction: 'Call get_retry_pressure exactly once before answering.',
  })
  return { adapter, result }
}

describe('v0.003 retry-pressure proof contract', () => {
  it('accepts exactly one correlated get_retry_pressure call', async () => {
    const { adapter, result } = await runProof([
      mcpCall('retry_01', 'get_retry_pressure'),
      mcpResponse('retry_01'),
      turnDone(),
    ])

    await expect(result).resolves.toBeUndefined()
    expect(adapter.connectionState).toBe('ready')
  })

  it('rejects zero retry-pressure calls even when another allowed read-only call is correlated', async () => {
    const { adapter, result } = await runProof([
      mcpCall('health_01', 'get_service_health'),
      mcpResponse('health_01'),
      turnDone(),
    ])

    await expect(result).rejects.toThrow(/exactly one get_retry_pressure call; observed 0/i)
    expect(adapter.connectionState).toBe('failed')
  })

  it('rejects more than one retry-pressure call even when both responses correlate', async () => {
    const { adapter, result } = await runProof([
      mcpCall('retry_01', 'get_retry_pressure'),
      mcpResponse('retry_01'),
      mcpCall('retry_02', 'get_retry_pressure'),
      mcpResponse('retry_02'),
      turnDone(),
    ])

    await expect(result).rejects.toThrow(/exactly one get_retry_pressure call; observed 2/i)
    expect(adapter.connectionState).toBe('failed')
  })

  it('allows one retry-pressure proof call plus another positively read-only investigation call', async () => {
    const { adapter, result } = await runProof([
      mcpCall('health_01', 'get_service_health'),
      mcpResponse('health_01'),
      mcpCall('retry_01', 'get_retry_pressure'),
      mcpResponse('retry_01'),
      turnDone(),
    ])

    await expect(result).resolves.toBeUndefined()
    expect(adapter.connectionState).toBe('ready')
  })
})
