import { describe, expect, it } from 'vitest'
import type { HarnessEvent, IncidentSessionRequest } from './adapter'
import type { TrueForgeSessionSeed, TrueForgeStreamItem, TrueForgeTransport } from './trueforge'
import {
  ROOK_V004_RUNTIME_GUARDRAILS,
  ROOK_V004_SANDBOX_COMMAND,
  ROOK_V004_SANDBOX_INTENT,
  V004TrueForgeHarnessAdapter,
  assertV004SandboxExecArguments,
  assertV004SandboxExecResponseContent,
  buildV004SandboxInstructions,
  normalizeV004TrueForgeEvent,
} from './v004'
import { ROOK_V003_MCP_SERVER_NAME } from './v003'

const observedAt = '2026-08-29T19:00:00.000Z'
const request: IncidentSessionRequest = {
  incidentId: 'INC-2048',
  title: 'Inventory Retry Storm',
  objective: 'Reproduce the observed retry-pressure arithmetic in the bounded sandbox.',
}

const mcpCall = () => ({
  id: 'evt_mcp_call',
  type: 'model.message',
  threadId: 'main',
  createdAt: '2026-08-29T18:59:55.000Z',
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

const mcpResponse = () => ({
  id: 'evt_mcp_response',
  type: 'tool.response',
  threadId: 'main',
  toolCallId: 'call_mcp',
  content: '{"source":{"classification":"owned-demo-non-production"},"data":{"retryMultiplier":5.3}}',
  createdAt: '2026-08-29T18:59:56.000Z',
})

const sandboxArgs = () => JSON.stringify({
  intent: ROOK_V004_SANDBOX_INTENT,
  command: ROOK_V004_SANDBOX_COMMAND,
})

const sandboxCall = (argumentsText = sandboxArgs()) => ({
  id: 'evt_sandbox_call',
  type: 'model.message',
  threadId: 'main',
  createdAt: '2026-08-29T18:59:57.000Z',
  toolCalls: [{
    id: 'call_sandbox',
    type: 'function',
    function: { name: 'exec', arguments: argumentsText },
    toolInfo: { type: 'truefoundry-system', name: 'exec' },
  }],
})

const sandboxCreated = () => ({
  id: 'evt_sandbox_created',
  type: 'sandbox.created',
  threadId: null,
  sandboxId: 'rook.sandbox.01',
  createdAt: '2026-08-29T18:59:58.000Z',
})

const reproductionResult = () => JSON.stringify({
  kind: 'rook-v004-reproduction',
  retryMultiplier: 5.3,
  attemptsPerMinute: 4800,
  baselineAttemptsPerMinute: 900,
  queueDepth: 7200,
  queueSaturationPct: 91,
}) + '\n'

const sandboxResponse = (overrides: Record<string, unknown> = {}) => ({
  id: 'evt_sandbox_response',
  type: 'tool.response',
  threadId: 'main',
  toolCallId: 'call_sandbox',
  content: JSON.stringify({
    success: true,
    response: { exitCode: 0, result: reproductionResult() },
    ...overrides,
  }),
  createdAt: '2026-08-29T18:59:59.000Z',
})

const turnDone = () => ({
  id: 'evt_done',
  type: 'turn.done',
  threadId: null,
  createdAt: '2026-08-29T19:00:00.000Z',
  state: { status: 'done', requiredActions: [] },
})

class ScriptedTransport implements TrueForgeTransport {
  capturedSeed?: TrueForgeSessionSeed
  constructor(private readonly items: TrueForgeStreamItem[]) {}
  async createSession(seed: TrueForgeSessionSeed): Promise<{ id: string }> {
    this.capturedSeed = seed
    return { id: 'sess_v004_01' }
  }
  async *streamTurn(): AsyncIterable<TrueForgeStreamItem> {
    for (const item of this.items) yield item
  }
}

const createAdapter = (events: unknown[]) => {
  const transport = new ScriptedTransport(events.map((event, index) => ({ event, sequence: String(index + 1) })))
  const adapter = new V004TrueForgeHarnessAdapter({ modelName: 'ollama-local/qwen2-5-1-5b' }, transport, () => observedAt)
  return { adapter, transport }
}

const run = async (events: unknown[]) => {
  const { adapter, transport } = createAdapter(events)
  const session = await adapter.createIncidentSession(request)
  const observed: HarnessEvent[] = []
  adapter.subscribe(session.sessionId, event => observed.push(event))
  await adapter.runTurn({ sessionId: session.sessionId, instruction: 'Run the bounded v0.004 reproduction.' })
  return { adapter, transport, observed }
}

describe('ROOK v0.004 sandbox evidence contract', () => {
  it('enables sandbox only while disabling file downloads and unrelated default capabilities', () => {
    expect(ROOK_V004_RUNTIME_GUARDRAILS).toEqual({
      iterationLimit: 16,
      sandboxEnabled: true,
      sandboxFileDownloadsEnabled: false,
      dynamicSubAgentsEnabled: false,
      askUserQuestionsEnabled: false,
      generativeUiEnabled: false,
    })
  })

  it('pins one exact deterministic exec payload for evidence acceptance and rejects cwd/env/extra keys', () => {
    expect(() => assertV004SandboxExecArguments(sandboxArgs())).not.toThrow()
    expect(() => assertV004SandboxExecArguments(JSON.stringify({
      intent: ROOK_V004_SANDBOX_INTENT,
      command: ROOK_V004_SANDBOX_COMMAND,
      cwd: '/tmp',
    }))).toThrow(/exactly intent and command/i)
    expect(() => assertV004SandboxExecArguments(JSON.stringify({
      intent: ROOK_V004_SANDBOX_INTENT,
      command: 'curl https://example.com',
    }))).toThrow(/deterministic reproduction evidence contract/i)
  })

  it('accepts only the exact successful zero-exit reproduction result', () => {
    const valid = sandboxResponse().content
    expect(() => assertV004SandboxExecResponseContent(valid)).not.toThrow()
    expect(() => assertV004SandboxExecResponseContent(JSON.stringify({ success: false, response: {} }))).toThrow(/provider failure/i)
    expect(() => assertV004SandboxExecResponseContent(JSON.stringify({
      success: true,
      response: { exitCode: 1, result: reproductionResult() },
    }))).toThrow(/exit code 0/i)
  })

  it('labels observation versus reproduction truth states in the session instructions', () => {
    const instructions = buildV004SandboxInstructions(request)
    expect(instructions).toContain('get_retry_pressure exactly once')
    expect(instructions).toContain('OBSERVED owned-demo evidence')
    expect(instructions).toContain('sandbox exec tool exactly once')
    expect(instructions).toContain('REPRODUCED evidence')
    expect(instructions).toContain('not production observation, applied remediation, or verified recovery')
  })
})

describe('normalizeV004TrueForgeEvent', () => {
  it('retains only the exact public truefoundry-system exec provenance for sandbox execution', () => {
    const [event] = normalizeV004TrueForgeEvent(sandboxCall(), 'sess_v004_01', '4', observedAt)
    expect(event).toMatchObject({
      type: 'sandbox.exec.called',
      sessionId: 'sess_v004_01',
      callId: 'call_sandbox',
      toolName: 'exec',
      arguments: sandboxArgs(),
      sourceEventId: 'evt_sandbox_call',
      threadId: 'main',
    })
  })

  it('rejects any other truefoundry-system tool identity', () => {
    const event = sandboxCall()
    event.toolCalls[0]!.toolInfo.name = 'open_ui'
    expect(() => normalizeV004TrueForgeEvent(event, 'sess_v004_01')).toThrow(/permits only the TrueForge sandbox exec/i)
  })
})

describe('V004TrueForgeHarnessAdapter evidence correlation', () => {
  it('passes only after observed MCP evidence then sandbox creation, one successful bounded exec response, and one successful terminal', async () => {
    const { adapter, transport, observed } = await run([
      mcpCall(),
      mcpResponse(),
      sandboxCall(),
      sandboxCreated(),
      sandboxResponse(),
      turnDone(),
    ])

    expect(adapter.connectionState).toBe('ready')
    expect(transport.capturedSeed?.instructions).toContain(ROOK_V004_SANDBOX_COMMAND)
    expect(observed.map(event => event.type)).toEqual([
      'mcp.tool.called',
      'mcp.tool.returned',
      'sandbox.exec.called',
      'sandbox.started',
      'sandbox.exec.returned',
      'turn.completed',
    ])
  })

  it('fails closed if sandbox execution begins before the MCP observation is correlated', async () => {
    const { adapter } = createAdapter([mcpCall(), sandboxCall(), mcpResponse(), sandboxCreated(), sandboxResponse(), turnDone()])
    const session = await adapter.createIncidentSession(request)
    await expect(adapter.runTurn({ sessionId: session.sessionId, instruction: 'Run.' })).rejects.toThrow(/before the observed retry-pressure MCP evidence was fully correlated/i)
    expect(adapter.connectionState).toBe('failed')
  })

  it('fails closed when sandbox.created evidence is missing', async () => {
    const { adapter } = createAdapter([mcpCall(), mcpResponse(), sandboxCall(), sandboxResponse(), turnDone()])
    const session = await adapter.createIncidentSession(request)
    await expect(adapter.runTurn({ sessionId: session.sessionId, instruction: 'Run.' })).rejects.toThrow(/without sandbox.created evidence/i)
  })

  it('fails closed when TrueForge reports sandbox provider failure or non-zero execution', async () => {
    for (const response of [
      sandboxResponse({ success: false }),
      {
        ...sandboxResponse(),
        content: JSON.stringify({ success: true, response: { exitCode: 9, result: reproductionResult() } }),
      },
    ]) {
      const { adapter } = createAdapter([mcpCall(), mcpResponse(), sandboxCall(), sandboxCreated(), response, turnDone()])
      const session = await adapter.createIncidentSession(request)
      await expect(adapter.runTurn({ sessionId: session.sessionId, instruction: 'Run.' })).rejects.toThrow(/sandbox exec/i)
      expect(adapter.connectionState).toBe('failed')
    }
  })
})
