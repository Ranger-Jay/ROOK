import { describe, expect, it } from 'vitest'
import type { HarnessEvent, IncidentSessionRequest } from './adapter'
import type {
  TrueForgeSessionSeed,
  TrueForgeStreamItem,
  TrueForgeTransport,
} from './trueforge'
import {
  ROOK_V003_MCP_ATTACHMENT,
  ROOK_V003_MCP_SERVER_NAME,
  ROOK_V003_RUNTIME_GUARDRAILS,
  V003TrueForgeHarnessAdapter,
  buildV003ReadOnlyInstructions,
  normalizeV003TrueForgeEvent,
} from './v003'

const observedAt = '2026-08-27T05:30:00.000Z'
const request: IncidentSessionRequest = {
  incidentId: 'INC-2048',
  title: 'Inventory Retry Storm',
  objective: 'Investigate the owned non-production demo incident with read-only evidence only.',
}

const mcpCall = ({
  eventId = 'evt_call',
  callId = 'call_01',
  threadId = 'main',
  toolName = 'get_retry_pressure',
  serverName = ROOK_V003_MCP_SERVER_NAME,
  toolInfoName = toolName,
  argumentsText = '{}',
  toolInfoType = 'mcp',
}: {
  eventId?: string
  callId?: string
  threadId?: string
  toolName?: string
  serverName?: string
  toolInfoName?: string
  argumentsText?: string
  toolInfoType?: string
} = {}) => ({
  id: eventId,
  type: 'model.message',
  threadId,
  createdAt: '2026-08-27T05:29:58.000Z',
  toolCalls: [{
    id: callId,
    type: 'function',
    function: { name: toolName, arguments: argumentsText },
    toolInfo: {
      type: toolInfoType,
      serverId: 'mcp_rook_01',
      serverName,
      name: toolInfoName,
    },
  }],
})

const mcpResponse = ({
  eventId = 'evt_response',
  callId = 'call_01',
  threadId = 'main',
  content = '{"source":{"classification":"owned-demo-non-production"},"data":{"retryMultiplier":5.3}}',
}: {
  eventId?: string
  callId?: string
  threadId?: string
  content?: string
} = {}) => ({
  id: eventId,
  type: 'tool.response',
  threadId,
  toolCallId: callId,
  content,
  createdAt: '2026-08-27T05:29:59.000Z',
})

const turnStart = () => ({
  id: 'evt_turn',
  type: 'turn.created',
  threadId: null,
  turnId: 'turn_01',
  createdAt: '2026-08-27T05:29:57.000Z',
})

const turnDone = (overrides: Record<string, unknown> = {}) => ({
  id: 'evt_done',
  type: 'turn.done',
  threadId: null,
  createdAt: '2026-08-27T05:30:00.000Z',
  state: { status: 'done', requiredActions: [] },
  ...overrides,
})

class ScriptedTransport implements TrueForgeTransport {
  capturedSeed?: TrueForgeSessionSeed

  constructor(private readonly items: TrueForgeStreamItem[]) {}

  async createSession(seed: TrueForgeSessionSeed): Promise<{ id: string }> {
    this.capturedSeed = seed
    return { id: 'sess_v003_01' }
  }

  async *streamTurn(): AsyncIterable<TrueForgeStreamItem> {
    for (const item of this.items) yield item
  }
}

const createAdapter = (items: TrueForgeStreamItem[]) => {
  const transport = new ScriptedTransport(items)
  const adapter = new V003TrueForgeHarnessAdapter(
    { modelName: 'ollama-local/qwen2-5-1-5b' },
    transport,
    () => observedAt,
  )
  return { adapter, transport }
}

const createSession = (adapter: V003TrueForgeHarnessAdapter) => adapter.createIncidentSession(request)

describe('ROOK v0.003 TrueForge authority contract', () => {
  it('pins exactly one named MCP server to the positive @read-only selector', () => {
    expect(ROOK_V003_MCP_SERVER_NAME).toBe('rook-inventory-retry-storm')
    expect(ROOK_V003_MCP_ATTACHMENT).toEqual({
      name: 'rook-inventory-retry-storm',
      enableTools: ['@read-only'],
      preload: false,
    })
    expect(Object.isFrozen(ROOK_V003_MCP_ATTACHMENT)).toBe(true)
    expect(Object.isFrozen(ROOK_V003_MCP_ATTACHMENT.enableTools)).toBe(true)
  })

  it('disables every unrelated default capability and bounds agent-loop iterations', () => {
    expect(ROOK_V003_RUNTIME_GUARDRAILS).toEqual({
      iterationLimit: 12,
      sandboxEnabled: false,
      dynamicSubAgentsEnabled: false,
      askUserQuestionsEnabled: false,
      generativeUiEnabled: false,
    })
    expect(Object.isFrozen(ROOK_V003_RUNTIME_GUARDRAILS)).toBe(true)
  })

  it('labels the source as owned non-production demo evidence and preserves claim-state doctrine', () => {
    const instructions = buildV003ReadOnlyInstructions(request)
    expect(instructions).toContain('owned, fictional, non-production demo system')
    expect(instructions).toContain('Never present its observations as production telemetry')
    expect(instructions).toContain('Use only MCP tools exposed by the @read-only selector')
    expect(instructions).toContain('Treat MCP tool output as observed evidence')
    expect(instructions).toContain('causal explanations as inferred')
    expect(instructions).toContain('INC-2048 — Inventory Retry Storm')
  })
})

describe('normalizeV003TrueForgeEvent', () => {
  it('retains a settled MCP tool call with raw arguments and complete source provenance', () => {
    const [event] = normalizeV003TrueForgeEvent(
      mcpCall({ argumentsText: '{"service":"inventory-api"}' }),
      'sess_v003_01',
      '12',
      observedAt,
    )

    expect(event).toEqual({
      source: 'trueforge',
      sourceEventId: 'evt_call',
      sourceTimestamp: '2026-08-27T05:29:58.000Z',
      observedAt,
      sequence: '12',
      threadId: 'main',
      type: 'mcp.tool.called',
      sessionId: 'sess_v003_01',
      callId: 'call_01',
      name: 'get_retry_pressure',
      arguments: '{"service":"inventory-api"}',
      serverId: 'mcp_rook_01',
      serverName: ROOK_V003_MCP_SERVER_NAME,
    })
  })

  it('does not fabricate a tool call from fragmented tool-call deltas', () => {
    expect(normalizeV003TrueForgeEvent({
      id: 'evt_delta',
      type: 'model.message.delta',
      threadId: 'main',
      toolCalls: [{ index: 0, id: 'call_01', function: { name: 'get_retry_pressure' } }],
      finishReason: 'tool_calls',
    }, 'sess_v003_01', '13', observedAt)).toEqual([])
  })

  it('retains tool.response content as a raw string linked by toolCallId', () => {
    const rawContent = '{"nested":{"value":1}}'
    const [event] = normalizeV003TrueForgeEvent(
      mcpResponse({ content: rawContent }),
      'sess_v003_01',
      '14',
      observedAt,
    )

    expect(event).toEqual({
      source: 'trueforge',
      sourceEventId: 'evt_response',
      sourceTimestamp: '2026-08-27T05:29:59.000Z',
      observedAt,
      sequence: '14',
      threadId: 'main',
      type: 'mcp.tool.returned',
      sessionId: 'sess_v003_01',
      callId: 'call_01',
      content: rawContent,
    })
  })

  it('fails closed on missing MCP provenance, non-MCP calls, wrong server, conflicting tool identity, and unknown tools', () => {
    const missingToolInfo = mcpCall()
    delete (missingToolInfo.toolCalls[0] as { toolInfo?: unknown }).toolInfo
    expect(() => normalizeV003TrueForgeEvent(missingToolInfo, 'sess_v003_01')).toThrow(/missing toolInfo provenance/i)

    expect(() => normalizeV003TrueForgeEvent(
      mcpCall({ toolInfoType: 'truefoundry-system' }),
      'sess_v003_01',
    )).toThrow(/non-MCP tool call/i)

    expect(() => normalizeV003TrueForgeEvent(
      mcpCall({ serverName: 'unexpected-server' }),
      'sess_v003_01',
    )).toThrow(/unexpected MCP server/i)

    expect(() => normalizeV003TrueForgeEvent(
      mcpCall({ toolInfoName: 'get_service_health' }),
      'sess_v003_01',
    )).toThrow(/conflicting tool names/i)

    expect(() => normalizeV003TrueForgeEvent(
      mcpCall({ toolName: 'delete_inventory' }),
      'sess_v003_01',
    )).toThrow(/outside the owned read-only inventory/i)
  })

  it('fails closed when a tool response is missing its serialized content', () => {
    const response = mcpResponse() as Record<string, unknown>
    delete response.content
    expect(() => normalizeV003TrueForgeEvent(response, 'sess_v003_01')).toThrow(/tool.response content/i)
  })

  it('rejects user-supplied tool-response pauses in this milestone', () => {
    expect(() => normalizeV003TrueForgeEvent({
      id: 'evt_required',
      type: 'tool.response_required',
      threadId: 'main',
      createdAt: '2026-08-27T05:29:59.000Z',
      toolCalls: [{ id: 'call_01', sourceEventId: 'evt_call' }],
    }, 'sess_v003_01')).toThrow(/does not permit user-supplied tool responses/i)
  })
})

describe('V003TrueForgeHarnessAdapter MCP evidence correlation', () => {
  it('returns ready only after a retained MCP call, matching response, and one successful terminal turn', async () => {
    const { adapter, transport } = createAdapter([
      { sequence: '1', event: turnStart() },
      { sequence: '2', event: mcpCall() },
      { sequence: '3', event: mcpResponse() },
      { sequence: '4', event: turnDone() },
    ])
    const session = await createSession(adapter)
    const observed: HarnessEvent[] = []
    adapter.subscribe(session.sessionId, (event) => observed.push(event))

    await adapter.runTurn({ sessionId: session.sessionId, instruction: 'Investigate with read-only evidence.' })

    expect(adapter.connectionState).toBe('ready')
    expect(observed.map((event) => event.type)).toEqual([
      'turn.started',
      'mcp.tool.called',
      'mcp.tool.returned',
      'turn.completed',
    ])
    expect(transport.capturedSeed?.instructions).toContain('owned, fictional, non-production demo system')
  })

  it('rejects a tool response without a retained initiating call', async () => {
    const { adapter } = createAdapter([
      { sequence: '1', event: turnStart() },
      { sequence: '2', event: mcpResponse() },
      { sequence: '3', event: turnDone() },
    ])
    const session = await createSession(adapter)

    await expect(adapter.runTurn({ sessionId: session.sessionId, instruction: 'Investigate.' })).rejects.toThrow(
      /no retained tool call/i,
    )
    expect(adapter.connectionState).toBe('failed')
  })

  it('rejects duplicate responses for the same MCP call', async () => {
    const { adapter } = createAdapter([
      { sequence: '1', event: mcpCall() },
      { sequence: '2', event: mcpResponse() },
      { sequence: '3', event: mcpResponse({ eventId: 'evt_response_2' }) },
    ])
    const session = await createSession(adapter)

    await expect(adapter.runTurn({ sessionId: session.sessionId, instruction: 'Investigate.' })).rejects.toThrow(
      /repeated MCP tool response/i,
    )
  })

  it('rejects call/response thread mismatches', async () => {
    const { adapter } = createAdapter([
      { sequence: '1', event: mcpCall({ threadId: 'main' }) },
      { sequence: '2', event: mcpResponse({ threadId: 'other' }) },
    ])
    const session = await createSession(adapter)

    await expect(adapter.runTurn({ sessionId: session.sessionId, instruction: 'Investigate.' })).rejects.toThrow(
      /thread mismatch/i,
    )
  })

  it('rejects terminal completion while a retained MCP call still lacks a response', async () => {
    const { adapter } = createAdapter([
      { sequence: '1', event: mcpCall() },
      { sequence: '2', event: turnDone() },
    ])
    const session = await createSession(adapter)

    await expect(adapter.runTurn({ sessionId: session.sessionId, instruction: 'Investigate.' })).rejects.toThrow(
      /lacking tool.response evidence/i,
    )
  })

  it('rejects a text-only terminal turn because v0.003 requires correlated MCP evidence', async () => {
    const { adapter } = createAdapter([
      { sequence: '1', event: turnStart() },
      {
        sequence: '2',
        event: {
          id: 'evt_text',
          type: 'model.message.delta',
          threadId: 'main',
          content: 'I did not inspect the MCP source.',
        },
      },
      { sequence: '3', event: turnDone() },
    ])
    const session = await createSession(adapter)

    await expect(adapter.runTurn({ sessionId: session.sessionId, instruction: 'Investigate.' })).rejects.toThrow(
      /without any correlated MCP tool evidence/i,
    )
    expect(adapter.connectionState).toBe('failed')
  })

  it('rejects non-success terminal state even after correlated evidence', async () => {
    const { adapter } = createAdapter([
      { sequence: '1', event: mcpCall() },
      { sequence: '2', event: mcpResponse() },
      {
        sequence: '3',
        event: turnDone({ state: { status: 'error', requiredActions: [] } }),
      },
    ])
    const session = await createSession(adapter)

    await expect(adapter.runTurn({ sessionId: session.sessionId, instruction: 'Investigate.' })).rejects.toThrow(
      /non-success terminal status error/i,
    )
  })

  it.each([
    ['approval', {
      id: 'evt_approval',
      type: 'tool.approval_required',
      threadId: 'main',
      toolCalls: [{ id: 'call_approval', sourceEventId: 'evt_call' }],
    }, /forbidden capability event approval.requested/i],
    ['MCP authorization', {
      id: 'evt_auth',
      type: 'mcp.auth_required',
      threadId: null,
      mcpServers: [{ name: ROOK_V003_MCP_SERVER_NAME, authUrl: 'http://localhost/auth' }],
    }, /forbidden capability event mcp.authorization.required/i],
    ['sandbox', {
      id: 'evt_sandbox',
      type: 'sandbox.created',
      threadId: null,
      sandboxId: 'sandbox_01',
    }, /forbidden capability event sandbox.started/i],
    ['subagent', {
      id: 'evt_thread',
      type: 'thread.created',
      threadId: 'child_01',
      title: 'Unexpected child',
    }, /forbidden capability event subagent.started/i],
  ])('rejects unexpected %s capability activity', async (_label, event, pattern) => {
    const { adapter } = createAdapter([{ sequence: '1', event }])
    const session = await createSession(adapter)
    await expect(adapter.runTurn({ sessionId: session.sessionId, instruction: 'Investigate.' })).rejects.toThrow(pattern)
  })
})
