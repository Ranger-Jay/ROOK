import { describe, expect, it } from 'vitest'
import {
  ROOK_V003_MCP_SERVER_NAME,
  V003SdkTrueForgeTransport,
  normalizeV003TrueForgeEvent,
} from './v003'

const observedAt = '2026-08-29T18:20:00.000Z'

describe('V003SdkTrueForgeTransport streaming', () => {
  it('folds TrueForge MCP tool-call deltas into one settled message before normalization', async () => {
    const baseMessage = {
      id: 'evt_model',
      type: 'model.message',
      threadId: 'main',
      createdAt: '2026-08-29T18:19:58.000Z',
      content: null,
      toolCalls: [],
    }
    const firstDelta = {
      id: 'evt_model',
      type: 'model.message.delta',
      threadId: 'main',
      toolCalls: [{
        index: 0,
        id: 'call_01',
        function: { name: 'get_retry_pressure', arguments: '' },
        toolInfo: {
          type: 'mcp',
          serverId: 'mcp_rook_01',
          serverName: ROOK_V003_MCP_SERVER_NAME,
          name: 'get_retry_pressure',
        },
      }],
    }
    const finishDelta = {
      id: 'evt_model',
      type: 'model.message.delta',
      threadId: 'main',
      toolCalls: [{ index: 0, function: { arguments: '{}' } }],
      finishReason: 'tool_calls',
    }

    async function* withMetadata() {
      yield { data: baseMessage, id: '5' }
      yield { data: firstDelta, id: '6' }
      yield { data: finishDelta, id: '7' }
    }

    const transport = new V003SdkTrueForgeTransport({ baseUrl: '/__rook_trueforge' })
    ;(transport as any).client = {
      sessions: {
        createTurnStream: async () => ({ withMetadata }),
      },
    }

    const items = []
    for await (const item of transport.streamTurn('sess_v003_01', 'Investigate read-only evidence.')) {
      items.push(item)
    }

    expect(items).toHaveLength(1)
    expect(items[0]?.event).toMatchObject({
      id: 'evt_model',
      type: 'model.message',
      finishReason: 'tool_calls',
      toolCalls: [{
        id: 'call_01',
        function: { name: 'get_retry_pressure', arguments: '{}' },
        toolInfo: {
          type: 'mcp',
          serverId: 'mcp_rook_01',
          serverName: ROOK_V003_MCP_SERVER_NAME,
          name: 'get_retry_pressure',
        },
      }],
    })

    const [normalized] = normalizeV003TrueForgeEvent(
      items[0]!.event,
      'sess_v003_01',
      items[0]!.sequence,
      observedAt,
    )
    expect(normalized).toMatchObject({
      type: 'mcp.tool.called',
      callId: 'call_01',
      name: 'get_retry_pressure',
      serverName: ROOK_V003_MCP_SERVER_NAME,
      arguments: '{}',
    })
  })
})
