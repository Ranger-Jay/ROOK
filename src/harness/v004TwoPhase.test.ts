import { describe, expect, it } from 'vitest'
import type { HarnessEvent, IncidentSessionRequest } from './adapter'
import type { TrueForgeSessionSeed, TrueForgeStreamItem, TrueForgeTransport } from './trueforge'
import { ROOK_V003_MCP_SERVER_NAME } from './v003'
import {
  ROOK_V004_REPRODUCTION_INPUT,
  ROOK_V004_SANDBOX_COMMAND,
  ROOK_V004_SANDBOX_INTENT,
} from './v004'
import {
  V004_OBSERVATION_TURN_INSTRUCTION,
  V004_REPRODUCTION_TURN_INSTRUCTION,
  V004TwoPhaseTrueForgeHarnessAdapter,
} from './v004TwoPhase'

const observedAt = '2026-08-30T03:00:00.000Z'
const request: IncidentSessionRequest = {
  incidentId: 'INC-2048',
  title: 'Inventory Retry Storm',
  objective: 'Observe retry pressure, then reproduce it in the isolated sandbox.',
}

const turnStarted = (id: string, turnId: string, createdAt: string) => ({
  id,
  type: 'turn.created',
  turnId,
  threadId: null,
  createdAt,
})

const turnDone = (id: string, createdAt: string) => ({
  id,
  type: 'turn.done',
  threadId: null,
  createdAt,
  state: { status: 'done', requiredActions: [] },
})

const mcpCall = () => ({
  id: 'evt_mcp_call',
  type: 'model.message',
  threadId: 'main',
  createdAt: '2026-08-30T02:59:51.000Z',
  toolCalls: [{
    id: 'call_mcp',
    type: 'function',
    function: { name: 'get_retry_pressure', arguments: '{}' },
    toolInfo: {
      type: 'mcp',
      serverId: 'mcp_rook_01',
      serverName: ROOK_V003_MCP_SERVER_NAME,
      name: 'get_retry_pressure',
    },
  }],
})

const retryPressurePayload = (attemptsPerMinute = ROOK_V004_REPRODUCTION_INPUT.attemptsPerMinute) => ({
  source: {
    system: 'rook-owned-demo-source',
    scenarioId: 'inventory-retry-storm-v1',
    classification: 'owned-demo-non-production',
    kind: 'retry-pressure',
    sourceTimestamp: '2026-08-30T02:59:52.000Z',
    observationWindow: {
      start: '2026-08-30T02:54:52.000Z',
      end: '2026-08-30T02:59:52.000Z',
    },
  },
  data: {
    attemptsPerMinute,
    baselineAttemptsPerMinute: ROOK_V004_REPRODUCTION_INPUT.baselineAttemptsPerMinute,
    retryMultiplier: ROOK_V004_REPRODUCTION_INPUT.retryMultiplier,
    sharedQueueDepth: ROOK_V004_REPRODUCTION_INPUT.queueDepth,
    sharedQueueSaturationPct: ROOK_V004_REPRODUCTION_INPUT.queueSaturationPct,
    pressureSource: 'inventory-retry-queue',
  },
})

const mcpResponse = (attemptsPerMinute = ROOK_V004_REPRODUCTION_INPUT.attemptsPerMinute) => ({
  id: 'evt_mcp_response',
  type: 'tool.response',
  threadId: 'main',
  toolCallId: 'call_mcp',
  content: JSON.stringify(retryPressurePayload(attemptsPerMinute)),
  createdAt: '2026-08-30T02:59:52.000Z',
})

const sandboxArguments = JSON.stringify({
  intent: ROOK_V004_SANDBOX_INTENT,
  command: ROOK_V004_SANDBOX_COMMAND,
})

const sandboxCall = () => ({
  id: 'evt_sandbox_call',
  type: 'model.message',
  threadId: 'main',
  createdAt: '2026-08-30T02:59:56.000Z',
  toolCalls: [{
    id: 'call_sandbox',
    type: 'function',
    function: { name: 'exec', arguments: sandboxArguments },
    toolInfo: { type: 'truefoundry-system', name: 'exec' },
  }],
})

const sandboxCreated = () => ({
  id: 'evt_sandbox_created',
  type: 'sandbox.created',
  threadId: null,
  sandboxId: 'rook.sandbox.two-phase.01',
  createdAt: '2026-08-30T02:59:57.000Z',
})

const sandboxResponse = () => ({
  id: 'evt_sandbox_response',
  type: 'tool.response',
  threadId: 'main',
  toolCallId: 'call_sandbox',
  content: JSON.stringify({
    success: true,
    response: {
      exitCode: 0,
      result: JSON.stringify({
        kind: 'rook-v004-reproduction',
        retryMultiplier: ROOK_V004_REPRODUCTION_INPUT.retryMultiplier,
        attemptsPerMinute: ROOK_V004_REPRODUCTION_INPUT.attemptsPerMinute,
        baselineAttemptsPerMinute: ROOK_V004_REPRODUCTION_INPUT.baselineAttemptsPerMinute,
        queueDepth: ROOK_V004_REPRODUCTION_INPUT.queueDepth,
        queueSaturationPct: ROOK_V004_REPRODUCTION_INPUT.queueSaturationPct,
      }) + '\n',
    },
  }),
  createdAt: '2026-08-30T02:59:58.000Z',
})

class ScriptedTwoTurnTransport implements TrueForgeTransport {
  capturedSeed?: TrueForgeSessionSeed
  readonly instructions: string[] = []
  private turnIndex = 0

  constructor(private readonly turns: TrueForgeStreamItem[][]) {}

  async createSession(seed: TrueForgeSessionSeed): Promise<{ id: string }> {
    this.capturedSeed = seed
    return { id: 'sess_two_phase_01' }
  }

  async *streamTurn(_sessionId: string, instruction: string): AsyncIterable<TrueForgeStreamItem> {
    this.instructions.push(instruction)
    const items = this.turns[this.turnIndex] ?? []
    this.turnIndex += 1
    for (const item of items) yield item
  }
}

const items = (events: unknown[]): TrueForgeStreamItem[] =>
  events.map((event, index) => ({ event, sequence: String(index + 1) }))

const createAdapter = (turns: unknown[][]) => {
  const transport = new ScriptedTwoTurnTransport(turns.map(items))
  const adapter = new V004TwoPhaseTrueForgeHarnessAdapter(
    { modelName: 'ollama-local/qwen2-5-1-5b' },
    transport,
    () => observedAt,
  )
  return { adapter, transport }
}

const validObservationTurn = () => [
  turnStarted('evt_obs_start', 'turn_observation', '2026-08-30T02:59:50.000Z'),
  mcpCall(),
  mcpResponse(),
  turnDone('evt_obs_done', '2026-08-30T02:59:53.000Z'),
]

const validReproductionTurn = () => [
  turnStarted('evt_rep_start', 'turn_reproduction', '2026-08-30T02:59:55.000Z'),
  sandboxCall(),
  sandboxCreated(),
  sandboxResponse(),
  turnDone('evt_rep_done', '2026-08-30T02:59:59.000Z'),
]

describe('ROOK v0.004 two-phase TrueForge proof', () => {
  it('uses one session with an observation-only turn followed by an exec-only turn', async () => {
    const { adapter, transport } = createAdapter([validObservationTurn(), validReproductionTurn()])
    const session = await adapter.createIncidentSession(request)
    const observed: HarnessEvent[] = []
    adapter.subscribe(session.sessionId, event => observed.push(event))

    await adapter.runTurn({ sessionId: session.sessionId, instruction: 'Run the bounded proof.' })

    expect(adapter.connectionState).toBe('ready')
    expect(transport.instructions).toEqual([
      V004_OBSERVATION_TURN_INSTRUCTION,
      V004_REPRODUCTION_TURN_INSTRUCTION,
    ])
    expect(observed.filter(event => event.type === 'turn.started')).toHaveLength(2)
    expect(observed.filter(event => event.type === 'turn.completed')).toHaveLength(2)
    expect(observed.filter(event => event.type === 'mcp.tool.called')).toHaveLength(1)
    expect(observed.filter(event => event.type === 'sandbox.exec.called')).toHaveLength(1)
    expect(observed.filter(event => event.type === 'sandbox.started')).toHaveLength(1)
    expect(observed.filter(event => event.type === 'sandbox.exec.returned')).toHaveLength(1)
  })

  it('makes the phase instructions mutually exclusive and forbids discovery detours', () => {
    expect(V004_OBSERVATION_TURN_INSTRUCTION).toContain('OBSERVATION ONLY')
    expect(V004_OBSERVATION_TURN_INSTRUCTION).toContain('get_retry_pressure exactly once')
    expect(V004_OBSERVATION_TURN_INSTRUCTION).toContain('Do not call exec')
    expect(V004_REPRODUCTION_TURN_INSTRUCTION).toContain('SANDBOX REPRODUCTION ONLY')
    expect(V004_REPRODUCTION_TURN_INSTRUCTION).toContain('next and only tool call MUST be')
    expect(V004_REPRODUCTION_TURN_INSTRUCTION).toContain('Do NOT call get_retry_pressure again')
    expect(V004_REPRODUCTION_TURN_INSTRUCTION).toContain('Do NOT call list_tools, get_tool_info, get_tool_output_schema, or call_tool')
    expect(V004_REPRODUCTION_TURN_INSTRUCTION).toContain(ROOK_V004_SANDBOX_COMMAND)
  })

  it('does not start the sandbox turn when the observation is missing', async () => {
    const { adapter, transport } = createAdapter([[
      turnStarted('evt_obs_start', 'turn_observation', '2026-08-30T02:59:50.000Z'),
      turnDone('evt_obs_done', '2026-08-30T02:59:53.000Z'),
    ], validReproductionTurn()])
    const session = await adapter.createIncidentSession(request)

    await expect(adapter.runTurn({ sessionId: session.sessionId, instruction: 'Run.' })).rejects.toThrow(/one correlated get_retry_pressure/i)
    expect(transport.instructions).toEqual([V004_OBSERVATION_TURN_INSTRUCTION])
    expect(adapter.connectionState).toBe('failed')
  })

  it('does not start the sandbox turn when the observed values drift', async () => {
    const drifted = [
      turnStarted('evt_obs_start', 'turn_observation', '2026-08-30T02:59:50.000Z'),
      mcpCall(),
      mcpResponse(4900),
      turnDone('evt_obs_done', '2026-08-30T02:59:53.000Z'),
    ]
    const { adapter, transport } = createAdapter([drifted, validReproductionTurn()])
    const session = await adapter.createIncidentSession(request)

    await expect(adapter.runTurn({ sessionId: session.sessionId, instruction: 'Run.' })).rejects.toThrow(/exact owned-demo retry-pressure contract/i)
    expect(transport.instructions).toEqual([V004_OBSERVATION_TURN_INSTRUCTION])
  })

  it('fails closed if the reproduction turn chooses a managed discovery tool instead of exec', async () => {
    const listToolsCall = {
      id: 'evt_list_tools',
      type: 'model.message',
      threadId: 'main',
      createdAt: '2026-08-30T02:59:56.000Z',
      toolCalls: [{
        id: 'call_list_tools',
        type: 'function',
        function: { name: 'list_tools', arguments: '{"mcp_server":"rook-inventory-retry-storm"}' },
        toolInfo: { type: 'truefoundry-system', name: 'list_tools' },
      }],
    }
    const { adapter } = createAdapter([validObservationTurn(), [
      turnStarted('evt_rep_start', 'turn_reproduction', '2026-08-30T02:59:55.000Z'),
      listToolsCall,
    ]])
    const session = await adapter.createIncidentSession(request)

    await expect(adapter.runTurn({ sessionId: session.sessionId, instruction: 'Run.' })).rejects.toThrow(/permits only the TrueForge sandbox exec/i)
    expect(adapter.connectionState).toBe('failed')
  })
})
