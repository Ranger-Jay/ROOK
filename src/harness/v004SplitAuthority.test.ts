import { describe, expect, it } from 'vitest'
import type { HarnessEvent, IncidentSessionRequest } from './adapter'
import type { TrueForgeSessionSeed, TrueForgeStreamItem } from './trueforge'
import { ROOK_V003_MCP_SERVER_NAME } from './v003'
import {
  ROOK_V004_REPRODUCTION_INPUT,
  ROOK_V004_SANDBOX_COMMAND,
  ROOK_V004_SANDBOX_INTENT,
} from './v004'
import {
  V004_SPLIT_OBSERVATION_TURN_INSTRUCTION,
  V004_SPLIT_REPRODUCTION_TURN_INSTRUCTION,
  V004SplitAuthorityTrueForgeHarnessAdapter,
} from './v004SplitAuthority'
import {
  buildV004ObservationAgentSpec,
  buildV004ReproductionAgentSpec,
  type V004SplitAuthorityTransport,
} from './v004SplitAuthorityTransport'

const observedAt = '2026-08-30T04:00:00.000Z'
const request: IncidentSessionRequest = {
  incidentId: 'INC-2048',
  title: 'Inventory Retry Storm',
  objective: 'Observe retry pressure, then reproduce it in an isolated sandbox.',
}

const eventItems = (events: unknown[]): TrueForgeStreamItem[] =>
  events.map((event, index) => ({ event, sequence: String(index + 1) }))

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
  createdAt: '2026-08-30T03:59:51.000Z',
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

const retryPressurePayload = (attemptsPerMinute: number = ROOK_V004_REPRODUCTION_INPUT.attemptsPerMinute) => ({
  source: {
    system: 'rook-owned-demo-source',
    scenarioId: 'inventory-retry-storm-v1',
    classification: 'owned-demo-non-production',
    kind: 'retry-pressure',
    sourceTimestamp: '2026-08-30T03:59:52.000Z',
    observationWindow: {
      start: '2026-08-30T03:54:52.000Z',
      end: '2026-08-30T03:59:52.000Z',
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

const mcpResponse = (attemptsPerMinute: number = ROOK_V004_REPRODUCTION_INPUT.attemptsPerMinute) => ({
  id: 'evt_mcp_response',
  type: 'tool.response',
  threadId: 'main',
  toolCallId: 'call_mcp',
  content: JSON.stringify(retryPressurePayload(attemptsPerMinute)),
  createdAt: '2026-08-30T03:59:52.000Z',
})

const sandboxArguments = JSON.stringify({
  intent: ROOK_V004_SANDBOX_INTENT,
  command: ROOK_V004_SANDBOX_COMMAND,
})

const sandboxCall = () => ({
  id: 'evt_sandbox_call',
  type: 'model.message',
  threadId: 'main',
  createdAt: '2026-08-30T03:59:56.000Z',
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
  sandboxId: 'v1:daytona:rook-sandbox-01',
  createdAt: '2026-08-30T03:59:57.000Z',
})

const reproductionResult = () => JSON.stringify({
  kind: 'rook-v004-reproduction',
  retryMultiplier: ROOK_V004_REPRODUCTION_INPUT.retryMultiplier,
  attemptsPerMinute: ROOK_V004_REPRODUCTION_INPUT.attemptsPerMinute,
  baselineAttemptsPerMinute: ROOK_V004_REPRODUCTION_INPUT.baselineAttemptsPerMinute,
  queueDepth: ROOK_V004_REPRODUCTION_INPUT.queueDepth,
  queueSaturationPct: ROOK_V004_REPRODUCTION_INPUT.queueSaturationPct,
}) + '\n'

const sandboxResponse = () => ({
  id: 'evt_sandbox_response',
  type: 'tool.response',
  threadId: 'main',
  toolCallId: 'call_sandbox',
  content: JSON.stringify({
    success: true,
    response: { exitCode: 0, result: reproductionResult() },
  }),
  createdAt: '2026-08-30T03:59:58.000Z',
})

const validObservationTurn = () => eventItems([
  turnStarted('evt_obs_start', 'turn_observation', '2026-08-30T03:59:50.000Z'),
  mcpCall(),
  mcpResponse(),
  turnDone('evt_obs_done', '2026-08-30T03:59:53.000Z'),
])

const validReproductionTurn = () => eventItems([
  turnStarted('evt_rep_start', 'turn_reproduction', '2026-08-30T03:59:55.000Z'),
  sandboxCall(),
  sandboxCreated(),
  sandboxResponse(),
  turnDone('evt_rep_done', '2026-08-30T03:59:59.000Z'),
])

class ScriptedSplitTransport implements V004SplitAuthorityTransport {
  observationSeed?: TrueForgeSessionSeed
  reproductionSeed?: TrueForgeSessionSeed
  reproductionCreateCount = 0
  readonly turnInstructions: Array<{ sessionId: string; instruction: string }> = []

  constructor(
    private readonly observationItems: TrueForgeStreamItem[],
    private readonly reproductionItems: TrueForgeStreamItem[],
  ) {}

  async createObservationSession(seed: TrueForgeSessionSeed): Promise<{ id: string }> {
    this.observationSeed = seed
    return { id: 'sess_observation_01' }
  }

  async createReproductionSession(seed: TrueForgeSessionSeed): Promise<{ id: string }> {
    this.reproductionCreateCount += 1
    this.reproductionSeed = seed
    return { id: 'sess_reproduction_01' }
  }

  async *streamTurn(sessionId: string, instruction: string): AsyncIterable<TrueForgeStreamItem> {
    this.turnInstructions.push({ sessionId, instruction })
    const items = sessionId === 'sess_observation_01' ? this.observationItems : this.reproductionItems
    for (const item of items) yield item
  }
}

const createAdapter = (observationItems = validObservationTurn(), reproductionItems = validReproductionTurn()) => {
  const transport = new ScriptedSplitTransport(observationItems, reproductionItems)
  const adapter = new V004SplitAuthorityTrueForgeHarnessAdapter(
    { modelName: 'ollama-local/qwen2-5-1-5b' },
    transport,
    () => observedAt,
  )
  return { adapter, transport }
}

describe('v0.004 split-authority TrueForge specs', () => {
  it('gives the observer MCP authority with sandbox disabled, and the reproducer sandbox authority with no MCP attachment', () => {
    const seed = { modelName: 'ollama-local/qwen2-5-1-5b', instructions: 'test' }
    const observation = buildV004ObservationAgentSpec(seed)
    const reproduction = buildV004ReproductionAgentSpec(seed)

    expect(observation.mcpServers).toHaveLength(1)
    expect(observation.mcpServers[0]).toMatchObject({
      name: ROOK_V003_MCP_SERVER_NAME,
      enableTools: ['@read-only'],
      preload: true,
    })
    expect(observation.config.sandbox).toEqual({ enabled: false })

    expect('mcpServers' in reproduction).toBe(false)
    expect(reproduction.config.sandbox).toEqual({ enabled: true, fileDownloads: false })
    expect(reproduction.config.dynamicSubAgents.enabled).toBe(false)
    expect(reproduction.config.askUserQuestions.enabled).toBe(false)
    expect(reproduction.config.generativeUi.enabled).toBe(false)
  })
})

describe('V004SplitAuthorityTrueForgeHarnessAdapter', () => {
  it('retains one observation turn, then creates a separate sandbox-only session and retains one exact reproduction chain', async () => {
    const { adapter, transport } = createAdapter()
    const session = await adapter.createIncidentSession(request)
    const observed: HarnessEvent[] = []
    adapter.subscribe(session.sessionId, event => observed.push(event))

    await adapter.runTurn({ sessionId: session.sessionId, instruction: 'Run proof.' })

    expect(adapter.connectionState).toBe('ready')
    expect(transport.reproductionCreateCount).toBe(1)
    expect(transport.observationSeed?.instructions).toContain('READ-ONLY observation authority only')
    expect(transport.reproductionSeed?.instructions).toContain('NO MCP connector')
    expect(transport.turnInstructions).toEqual([
      { sessionId: 'sess_observation_01', instruction: V004_SPLIT_OBSERVATION_TURN_INSTRUCTION },
      { sessionId: 'sess_reproduction_01', instruction: V004_SPLIT_REPRODUCTION_TURN_INSTRUCTION },
    ])

    expect(observed.filter(event => event.type === 'mcp.tool.called')).toHaveLength(1)
    expect(observed.filter(event => event.type === 'sandbox.exec.called')).toHaveLength(1)
    expect(observed.filter(event => event.type === 'sandbox.started')).toHaveLength(1)
    expect(observed.filter(event => event.type === 'sandbox.exec.returned')).toHaveLength(1)
    expect(observed.filter(event => event.type === 'turn.completed')).toHaveLength(2)

    const turnStarts = observed.filter((event): event is Extract<HarnessEvent, { type: 'turn.started' }> => event.type === 'turn.started')
    expect(turnStarts.map(event => event.sessionId)).toEqual(['sess_observation_01', 'sess_reproduction_01'])
  })

  it('does not create any sandbox-authorized session when the observed values drift', async () => {
    const driftedObservation = eventItems([
      turnStarted('evt_obs_start', 'turn_observation', '2026-08-30T03:59:50.000Z'),
      mcpCall(),
      mcpResponse(4900),
      turnDone('evt_obs_done', '2026-08-30T03:59:53.000Z'),
    ])
    const { adapter, transport } = createAdapter(driftedObservation)
    const session = await adapter.createIncidentSession(request)

    await expect(adapter.runTurn({ sessionId: session.sessionId, instruction: 'Run proof.' }))
      .rejects.toThrow(/no sandbox-authorized session was created/i)
    expect(transport.reproductionCreateCount).toBe(0)
    expect(adapter.connectionState).toBe('failed')
  })

  it('fails closed if the read-only observation session attempts sandbox execution', async () => {
    const badObservation = eventItems([
      turnStarted('evt_obs_start', 'turn_observation', '2026-08-30T03:59:50.000Z'),
      sandboxCall(),
      turnDone('evt_obs_done', '2026-08-30T03:59:53.000Z'),
    ])
    const { adapter, transport } = createAdapter(badObservation)
    const session = await adapter.createIncidentSession(request)

    await expect(adapter.runTurn({ sessionId: session.sessionId, instruction: 'Run proof.' }))
      .rejects.toThrow(/observation session attempted sandbox execution/i)
    expect(transport.reproductionCreateCount).toBe(0)
  })

  it('fails closed if the sandbox-only reproduction session emits an MCP call', async () => {
    const badReproduction = eventItems([
      turnStarted('evt_rep_start', 'turn_reproduction', '2026-08-30T03:59:55.000Z'),
      mcpCall(),
      turnDone('evt_rep_done', '2026-08-30T03:59:59.000Z'),
    ])
    const { adapter } = createAdapter(validObservationTurn(), badReproduction)
    const session = await adapter.createIncidentSession(request)

    await expect(adapter.runTurn({ sessionId: session.sessionId, instruction: 'Run proof.' }))
      .rejects.toThrow(/sandbox-only reproduction session attempted an MCP tool call/i)
  })
})
