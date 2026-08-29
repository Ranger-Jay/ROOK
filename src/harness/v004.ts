import { TrueForge, isEventDelta, mergeEventDelta, type TrueForgeApi } from '@truefoundry/trueforge-sdk'
import type {
  HarnessConnectionState,
  HarnessEvent,
  IncidentSession,
  IncidentSessionRequest,
  RookHarnessAdapter,
  TurnRequest,
} from './adapter'
import { assertTrueForgeSdkBaseUrl } from './localProxy'
import {
  ROOK_V003_MCP_ATTACHMENT,
  ROOK_V003_MCP_SERVER_NAME,
  normalizeV003TrueForgeEvent,
} from './v003'
import {
  HarnessProtocolError,
  type LocalTrueForgeTransportConfig,
  type TrueForgeSessionSeed,
  type TrueForgeStreamItem,
  type TrueForgeTransport,
} from './trueforge'

export const ROOK_V004_SANDBOX_TOOL_NAME = 'exec' as const
export const ROOK_V004_SANDBOX_TOOL_INFO_TYPE = 'truefoundry-system' as const
export const ROOK_V004_SANDBOX_INTENT = 'Reproduce retry-pressure arithmetic from the observed owned-demo values.'
export const ROOK_V004_SANDBOX_COMMAND = `python -c "import json; a=4800; b=900; q=7200; s=91; print(json.dumps({'kind':'rook-v004-reproduction','retryMultiplier':round(a/b,1),'attemptsPerMinute':a,'baselineAttemptsPerMinute':b,'queueDepth':q,'queueSaturationPct':s},separators=(',',':')))"`

export const ROOK_V004_RUNTIME_GUARDRAILS = Object.freeze({
  iterationLimit: 16,
  sandboxEnabled: true,
  sandboxFileDownloadsEnabled: false,
  dynamicSubAgentsEnabled: false,
  askUserQuestionsEnabled: false,
  generativeUiEnabled: false,
})

export interface V004TrueForgeHarnessAdapterConfig {
  modelName: string
}

type HarnessSubscriber = (event: HarnessEvent) => void
type UnknownRecord = Record<string, unknown>
type McpToolCalledEvent = Extract<HarnessEvent, { type: 'mcp.tool.called' }>
type SandboxExecCalledEvent = Extract<HarnessEvent, { type: 'sandbox.exec.called' }>
export type V004ToolCallKind = 'mcp' | 'sandbox'

const isRecord = (value: unknown): value is UnknownRecord => typeof value === 'object' && value !== null && !Array.isArray(value)
const hasOwn = (record: UnknownRecord, key: string): boolean => Object.prototype.hasOwnProperty.call(record, key)

const readString = (record: UnknownRecord, ...keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim().length > 0) return value
  }
  return undefined
}

const readRawString = (record: UnknownRecord, ...keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string') return value
  }
  return undefined
}

const readRecord = (record: UnknownRecord, ...keys: string[]): UnknownRecord | undefined => {
  for (const key of keys) {
    const value = record[key]
    if (isRecord(value)) return value
  }
  return undefined
}

const readOptionalArray = (record: UnknownRecord, description: string, ...keys: string[]): unknown[] | undefined => {
  for (const key of keys) {
    if (!hasOwn(record, key)) continue
    const value = record[key]
    if (!Array.isArray(value)) throw new HarnessProtocolError(`TrueForge ${description} is not an array.`)
    return value
  }
  return undefined
}

const readThreadId = (record: UnknownRecord): string | null | undefined => {
  if (hasOwn(record, 'threadId')) {
    const value = record.threadId
    if (value === null) return null
    return typeof value === 'string' ? value : undefined
  }
  const value = record.thread_id
  if (value === null) return null
  return typeof value === 'string' ? value : undefined
}

const requireString = (record: UnknownRecord, description: string, ...keys: string[]): string => {
  const value = readString(record, ...keys)
  if (!value) throw new HarnessProtocolError(`TrueForge event is missing ${description}.`)
  return value
}

const requireRawString = (record: UnknownRecord, description: string, ...keys: string[]): string => {
  const value = readRawString(record, ...keys)
  if (value === undefined) throw new HarnessProtocolError(`TrueForge event is missing ${description}.`)
  return value
}

const v004EvidenceFor = (
  raw: UnknownRecord,
  sequence: string | undefined,
  observedAt: string,
  requireTimestamp = false,
) => ({
  source: 'trueforge' as const,
  sourceEventId: requireString(raw, 'event id', 'id'),
  sourceTimestamp: requireTimestamp
    ? requireString(raw, 'source timestamp', 'createdAt', 'created_at')
    : readString(raw, 'createdAt', 'created_at'),
  observedAt,
  sequence,
  threadId: readThreadId(raw),
})

const exactKeys = (record: UnknownRecord, expected: readonly string[]): boolean => {
  const actual = Object.keys(record).sort()
  const wanted = [...expected].sort()
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index])
}

export function assertV004SandboxExecArguments(argumentsText: string): void {
  let parsed: unknown
  try {
    parsed = JSON.parse(argumentsText)
  } catch (error) {
    throw new HarnessProtocolError(
      `v0.004 sandbox exec arguments are not valid JSON: ${error instanceof Error ? error.message : String(error)}.`,
    )
  }

  if (!isRecord(parsed) || !exactKeys(parsed, ['intent', 'command'])) {
    throw new HarnessProtocolError('v0.004 sandbox exec must contain exactly intent and command; cwd/env/extra authority is forbidden.')
  }
  if (parsed.intent !== ROOK_V004_SANDBOX_INTENT) {
    throw new HarnessProtocolError('v0.004 sandbox exec intent drifted from the bounded reproduction contract.')
  }
  if (parsed.command !== ROOK_V004_SANDBOX_COMMAND) {
    throw new HarnessProtocolError('v0.004 sandbox exec command drifted from the single approved deterministic reproduction command.')
  }
}

const normalizeV004ModelMessage = (
  raw: UnknownRecord,
  sessionId: string,
  sequence: string | undefined,
  observedAt: string,
): HarnessEvent[] => {
  const toolCalls = readOptionalArray(raw, 'model.message toolCalls', 'toolCalls', 'tool_calls')
  if (!toolCalls || toolCalls.length === 0) return []

  const events: HarnessEvent[] = []
  const threadId = requireString(raw, 'model.message thread id', 'threadId', 'thread_id')
  const createdAt = requireString(raw, 'model.message source timestamp', 'createdAt', 'created_at')
  const eventId = requireString(raw, 'model.message event id', 'id')

  toolCalls.forEach((candidate, index) => {
    if (!isRecord(candidate)) throw new HarnessProtocolError(`TrueForge model.message tool call ${index} is not an object.`)
    const callId = requireString(candidate, `tool call ${index} id`, 'id')
    const callType = requireString(candidate, `tool call ${index} type`, 'type')
    if (callType !== 'function') {
      throw new HarnessProtocolError(`v0.004 observed unsupported tool call type ${callType} for ${callId}.`)
    }

    const functionCall = readRecord(candidate, 'function')
    if (!functionCall) throw new HarnessProtocolError(`TrueForge tool call ${callId} is missing function metadata.`)
    const functionName = requireString(functionCall, `tool call ${callId} function name`, 'name')
    const args = requireRawString(functionCall, `tool call ${callId} serialized arguments`, 'arguments')
    const toolInfo = readRecord(candidate, 'toolInfo', 'tool_info')
    if (!toolInfo) throw new HarnessProtocolError(`TrueForge tool call ${callId} is missing toolInfo provenance.`)
    const toolInfoType = requireString(toolInfo, `tool call ${callId} toolInfo type`, 'type')

    if (toolInfoType === 'mcp') {
      events.push(...normalizeV003TrueForgeEvent({
        id: eventId,
        type: 'model.message',
        threadId,
        createdAt,
        toolCalls: [candidate],
      }, sessionId, sequence, observedAt))
      return
    }

    if (toolInfoType !== ROOK_V004_SANDBOX_TOOL_INFO_TYPE) {
      throw new HarnessProtocolError(`v0.004 observed unsupported system tool provenance ${toolInfoType} for ${callId}.`)
    }
    const toolInfoName = requireString(toolInfo, `tool call ${callId} system tool name`, 'name')
    if (functionName !== ROOK_V004_SANDBOX_TOOL_NAME || toolInfoName !== ROOK_V004_SANDBOX_TOOL_NAME) {
      throw new HarnessProtocolError(
        `v0.004 permits only the TrueForge sandbox exec system tool; observed function=${functionName} toolInfo=${toolInfoName}.`,
      )
    }
    assertV004SandboxExecArguments(args)

    events.push({
      ...v004EvidenceFor(raw, sequence, observedAt, true),
      threadId,
      type: 'sandbox.exec.called',
      sessionId,
      callId,
      arguments: args,
      toolName: ROOK_V004_SANDBOX_TOOL_NAME,
    })
  })

  return events
}

const normalizeV004ToolResponse = (
  raw: UnknownRecord,
  sessionId: string,
  sequence: string | undefined,
  observedAt: string,
  callKinds: ReadonlyMap<string, V004ToolCallKind>,
): HarnessEvent[] => {
  const callId = requireString(raw, 'tool.response tool call id', 'toolCallId', 'tool_call_id')
  const kind = callKinds.get(callId)
  if (!kind) throw new HarnessProtocolError(`v0.004 tool.response ${callId} has no retained initiating tool call.`)

  if (kind === 'mcp') {
    return normalizeV003TrueForgeEvent(raw, sessionId, sequence, observedAt)
  }

  return [{
    ...v004EvidenceFor(raw, sequence, observedAt, true),
    threadId: requireString(raw, 'tool.response thread id', 'threadId', 'thread_id'),
    type: 'sandbox.exec.returned',
    sessionId,
    callId,
    content: requireRawString(raw, 'tool.response content', 'content'),
  }]
}

export function normalizeV004TrueForgeEvent(
  rawEvent: unknown,
  sessionId: string,
  sequence?: string,
  observedAt = new Date().toISOString(),
  callKinds: ReadonlyMap<string, V004ToolCallKind> = new Map(),
): HarnessEvent[] {
  if (!isRecord(rawEvent)) throw new HarnessProtocolError('TrueForge stream yielded a non-object event.')
  const type = requireString(rawEvent, 'event type', 'type')

  switch (type) {
    case 'model.message':
      return normalizeV004ModelMessage(rawEvent, sessionId, sequence, observedAt)
    case 'tool.response':
      return normalizeV004ToolResponse(rawEvent, sessionId, sequence, observedAt, callKinds)
    case 'tool.response_required':
      throw new HarnessProtocolError('v0.004 does not permit user-supplied tool responses.')
    default:
      return normalizeV003TrueForgeEvent(rawEvent, sessionId, sequence, observedAt)
  }
}

export const buildV004SandboxInstructions = (request: IncidentSessionRequest): string => [
  'You are the ROOK v0.004 bounded sandbox-reproduction agent.',
  `The configured MCP server ${ROOK_V003_MCP_SERVER_NAME} is an owned, fictional, non-production demo evidence source.`,
  'Use only MCP tools exposed by the @read-only selector. Never request or imply incident mutation authority.',
  'First call get_retry_pressure exactly once and wait for its tool response. Treat that MCP result as OBSERVED owned-demo evidence.',
  'Then call the TrueForge sandbox exec tool exactly once to reproduce the retry-pressure arithmetic.',
  `The sandbox exec intent must be exactly: ${ROOK_V004_SANDBOX_INTENT}`,
  `The sandbox exec command must be exactly: ${ROOK_V004_SANDBOX_COMMAND}`,
  'Do not supply cwd, env, files, network requests, package installation, subprocess expansion, or any other sandbox command.',
  'Treat sandbox output as REPRODUCED evidence, not production observation, applied remediation, or verified recovery.',
  'Dynamic subagents, ask-user-question tools, Generative UI, skills, approval, and mutation are outside this milestone.',
  `Incident: ${request.incidentId} — ${request.title}.`,
  `Objective: ${request.objective}`,
].join('\n')

export class V004SdkTrueForgeTransport implements TrueForgeTransport {
  private readonly client: TrueForge

  constructor(config: LocalTrueForgeTransportConfig) {
    this.client = new TrueForge({
      baseUrl: assertTrueForgeSdkBaseUrl(config.baseUrl),
      timeoutInSeconds: config.timeoutInSeconds ?? 600,
    })
  }

  async createSession(seed: TrueForgeSessionSeed): Promise<{ id: string }> {
    const { data } = await this.client.sessions.create({
      agent: {
        spec: {
          model: { name: seed.modelName },
          instructions: seed.instructions,
          mcpServers: [{
            name: ROOK_V003_MCP_ATTACHMENT.name,
            enableTools: [...ROOK_V003_MCP_ATTACHMENT.enableTools],
            preload: ROOK_V003_MCP_ATTACHMENT.preload,
          }],
          skills: [],
          config: {
            iterationLimit: ROOK_V004_RUNTIME_GUARDRAILS.iterationLimit,
            sandbox: {
              enabled: ROOK_V004_RUNTIME_GUARDRAILS.sandboxEnabled,
              fileDownloads: ROOK_V004_RUNTIME_GUARDRAILS.sandboxFileDownloadsEnabled,
            },
            dynamicSubAgents: { enabled: ROOK_V004_RUNTIME_GUARDRAILS.dynamicSubAgentsEnabled },
            askUserQuestions: { enabled: ROOK_V004_RUNTIME_GUARDRAILS.askUserQuestionsEnabled },
            generativeUi: { enabled: ROOK_V004_RUNTIME_GUARDRAILS.generativeUiEnabled },
          },
        },
      },
    })
    return { id: data.id }
  }

  async *streamTurn(sessionId: string, instruction: string): AsyncIterable<TrueForgeStreamItem> {
    const stream = await this.client.sessions.createTurnStream(sessionId, {
      input: [{ type: 'user.message', content: instruction }],
    })
    const pendingModelMessages = new Map<string, TrueForgeApi.ModelMessageEvent>()

    for await (const item of stream.withMetadata()) {
      const event = item.data
      const sequence = item.id == null ? undefined : String(item.id)

      if (isEventDelta(event)) {
        const base = pendingModelMessages.get(event.id)
        if (!base) throw new HarnessProtocolError(`TrueForge model.message.delta ${event.id} arrived without its base model.message.`)
        mergeEventDelta(base, event)
        if (base.finishReason != null) {
          yield { event: base, sequence }
          pendingModelMessages.delete(event.id)
        }
        continue
      }

      if (event.type === 'model.message') {
        if (pendingModelMessages.has(event.id)) throw new HarnessProtocolError(`TrueForge repeated model.message base ${event.id}.`)
        pendingModelMessages.set(event.id, event)
        if (event.finishReason != null) {
          yield { event, sequence }
          pendingModelMessages.delete(event.id)
        }
        continue
      }

      yield { event, sequence }
    }

    if (pendingModelMessages.size > 0) {
      throw new HarnessProtocolError(`TrueForge stream ended with ${pendingModelMessages.size} unsettled model.message event(s).`)
    }
  }
}

const forbiddenV004EventTypes = new Set<HarnessEvent['type']>([
  'tool.returned',
  'subagent.started',
  'subagent.completed',
  'approval.requested',
  'mcp.authorization.required',
])

const assertV004CapabilityBoundary = (event: HarnessEvent): void => {
  if (forbiddenV004EventTypes.has(event.type)) {
    throw new HarnessProtocolError(`v0.004 observed forbidden capability event ${event.type} (${event.sourceEventId}).`)
  }
  if (event.type === 'turn.completed') {
    if (event.requiredActionCount !== 0) {
      throw new HarnessProtocolError(`v0.004 turn observed ${event.requiredActionCount} required action(s) at ${event.sourceEventId}.`)
    }
    if (event.status !== 'done') throw new HarnessProtocolError(`v0.004 reproduction ended with non-success terminal status ${event.status}.`)
  }
}

const errorMessage = (error: unknown): string => error instanceof Error ? error.message : 'Unknown TrueForge transport error.'

export class V004TrueForgeHarnessAdapter implements RookHarnessAdapter {
  private state: HarnessConnectionState = 'disconnected'
  private readonly subscribers = new Map<string, Set<HarnessSubscriber>>()
  private errorSequence = 0

  constructor(
    private readonly config: V004TrueForgeHarnessAdapterConfig,
    private readonly transport: TrueForgeTransport,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {
    if (!config.modelName.trim()) throw new Error('TrueForge modelName is required.')
  }

  get connectionState(): HarnessConnectionState {
    return this.state
  }

  async createIncidentSession(request: IncidentSessionRequest): Promise<IncidentSession> {
    this.state = 'connecting'
    try {
      const session = await this.transport.createSession({
        modelName: this.config.modelName,
        instructions: buildV004SandboxInstructions(request),
      })
      this.state = 'ready'
      return {
        incidentId: request.incidentId,
        sessionId: session.id,
        observation: { source: 'trueforge-session-response', observedAt: this.now() },
      }
    } catch (error) {
      this.state = 'failed'
      throw error
    }
  }

  async runTurn(request: TurnRequest): Promise<void> {
    this.state = 'connecting'
    let terminalEventCount = 0
    let retryPressureCallCount = 0
    let correlatedMcpResponseCount = 0
    let sandboxStartedCount = 0
    let sandboxExecCallCount = 0
    let sandboxExecResponseCount = 0
    let retryPressureObserved = false
    const pendingMcpCalls = new Map<string, McpToolCalledEvent>()
    const pendingSandboxCalls = new Map<string, SandboxExecCalledEvent>()
    const completedCallIds = new Set<string>()
    const callKinds = new Map<string, V004ToolCallKind>()

    try {
      for await (const item of this.transport.streamTurn(request.sessionId, request.instruction)) {
        const events = normalizeV004TrueForgeEvent(item.event, request.sessionId, item.sequence, this.now(), callKinds)
        for (const event of events) {
          if (terminalEventCount > 0) throw new HarnessProtocolError(`TrueForge stream emitted ${event.type} after terminal turn.done evidence.`)
          assertV004CapabilityBoundary(event)

          if (event.type === 'mcp.tool.called') {
            if (callKinds.has(event.callId) || completedCallIds.has(event.callId)) {
              throw new HarnessProtocolError(`TrueForge stream repeated tool call id ${event.callId}.`)
            }
            if (sandboxExecCallCount > 0) {
              throw new HarnessProtocolError('v0.004 observed an MCP call after sandbox reproduction had begun.')
            }
            if (event.name === 'get_retry_pressure') retryPressureCallCount += 1
            callKinds.set(event.callId, 'mcp')
            pendingMcpCalls.set(event.callId, event)
          } else if (event.type === 'mcp.tool.returned') {
            const call = pendingMcpCalls.get(event.callId)
            if (!call) {
              if (completedCallIds.has(event.callId)) throw new HarnessProtocolError(`TrueForge repeated tool response for ${event.callId}.`)
              throw new HarnessProtocolError(`TrueForge MCP response ${event.sourceEventId} has no retained initiating call ${event.callId}.`)
            }
            if (call.threadId !== event.threadId) throw new HarnessProtocolError(`TrueForge MCP call/response thread mismatch for ${event.callId}.`)
            pendingMcpCalls.delete(event.callId)
            completedCallIds.add(event.callId)
            correlatedMcpResponseCount += 1
            if (call.name === 'get_retry_pressure') retryPressureObserved = true
          } else if (event.type === 'sandbox.exec.called') {
            if (!retryPressureObserved || pendingMcpCalls.size > 0) {
              throw new HarnessProtocolError('v0.004 sandbox reproduction began before the observed retry-pressure MCP evidence was fully correlated.')
            }
            if (callKinds.has(event.callId) || completedCallIds.has(event.callId)) throw new HarnessProtocolError(`TrueForge stream repeated tool call id ${event.callId}.`)
            sandboxExecCallCount += 1
            if (sandboxExecCallCount !== 1) throw new HarnessProtocolError('v0.004 permits exactly one sandbox exec call.')
            callKinds.set(event.callId, 'sandbox')
            pendingSandboxCalls.set(event.callId, event)
          } else if (event.type === 'sandbox.started') {
            sandboxStartedCount += 1
            if (sandboxStartedCount !== 1) throw new HarnessProtocolError('v0.004 observed more than one sandbox.created event.')
            if (pendingSandboxCalls.size !== 1) throw new HarnessProtocolError('v0.004 sandbox.created was not correlated to the single pending sandbox exec call.')
          } else if (event.type === 'sandbox.exec.returned') {
            const call = pendingSandboxCalls.get(event.callId)
            if (!call) {
              if (completedCallIds.has(event.callId)) throw new HarnessProtocolError(`TrueForge repeated sandbox response for ${event.callId}.`)
              throw new HarnessProtocolError(`TrueForge sandbox response ${event.sourceEventId} has no retained exec call ${event.callId}.`)
            }
            if (sandboxStartedCount !== 1) throw new HarnessProtocolError('v0.004 sandbox exec returned without sandbox.created evidence.')
            if (call.threadId !== event.threadId) throw new HarnessProtocolError(`TrueForge sandbox call/response thread mismatch for ${event.callId}.`)
            pendingSandboxCalls.delete(event.callId)
            completedCallIds.add(event.callId)
            sandboxExecResponseCount += 1
          } else if (event.type === 'turn.completed') {
            if (pendingMcpCalls.size > 0 || pendingSandboxCalls.size > 0) {
              throw new HarnessProtocolError('TrueForge turn.done arrived with unresolved MCP or sandbox tool calls.')
            }
            terminalEventCount += 1
          }

          this.emit(request.sessionId, event)
        }
      }

      if (terminalEventCount !== 1) throw new HarnessProtocolError('TrueForge stream ended before one terminal turn.done event was observed.')
      if (retryPressureCallCount !== 1) throw new HarnessProtocolError(`v0.004 requires exactly one get_retry_pressure call; observed ${retryPressureCallCount}.`)
      if (!retryPressureObserved || correlatedMcpResponseCount === 0) throw new HarnessProtocolError('v0.004 ended without correlated owned MCP observation evidence.')
      if (sandboxStartedCount !== 1) throw new HarnessProtocolError(`v0.004 requires exactly one sandbox.created event; observed ${sandboxStartedCount}.`)
      if (sandboxExecCallCount !== 1 || sandboxExecResponseCount !== 1) {
        throw new HarnessProtocolError(`v0.004 requires exactly one correlated sandbox exec; observed calls=${sandboxExecCallCount} responses=${sandboxExecResponseCount}.`)
      }

      this.state = 'ready'
    } catch (error) {
      this.state = 'failed'
      this.errorSequence += 1
      this.emit(request.sessionId, {
        type: 'error',
        sessionId: request.sessionId,
        message: errorMessage(error),
        source: 'rook-adapter',
        sourceEventId: `rook-v004-adapter-error-${this.errorSequence}`,
        observedAt: this.now(),
      })
      throw error
    }
  }

  subscribe(sessionId: string, onEvent: HarnessSubscriber): () => void {
    let listeners = this.subscribers.get(sessionId)
    if (!listeners) {
      listeners = new Set()
      this.subscribers.set(sessionId, listeners)
    }
    listeners.add(onEvent)
    return () => {
      const current = this.subscribers.get(sessionId)
      current?.delete(onEvent)
      if (current?.size === 0) this.subscribers.delete(sessionId)
    }
  }

  private emit(sessionId: string, event: HarnessEvent): void {
    this.subscribers.get(sessionId)?.forEach((subscriber) => subscriber(event))
  }
}
