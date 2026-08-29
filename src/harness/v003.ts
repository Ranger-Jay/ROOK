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
  HarnessProtocolError,
  normalizeTrueForgeEvent,
  type LocalTrueForgeTransportConfig,
  type TrueForgeSessionSeed,
  type TrueForgeStreamItem,
  type TrueForgeTransport,
} from './trueforge'

export const ROOK_V003_MCP_SERVER_NAME = 'rook-inventory-retry-storm'

export const ROOK_V003_READ_ONLY_TOOL_NAMES = Object.freeze([
  'get_service_health',
  'get_retry_pressure',
  'get_deployment_history',
  'get_dependency_topology',
] as const)

export const ROOK_V003_MCP_ATTACHMENT = Object.freeze({
  name: ROOK_V003_MCP_SERVER_NAME,
  enableTools: Object.freeze(['@read-only'] as const),
  preload: true,
})

export const ROOK_V003_RUNTIME_GUARDRAILS = Object.freeze({
  iterationLimit: 12,
  sandboxEnabled: false,
  dynamicSubAgentsEnabled: false,
  askUserQuestionsEnabled: false,
  generativeUiEnabled: false,
})

export interface V003TrueForgeHarnessAdapterConfig {
  modelName: string
}

/**
 * v0.003 owns a dedicated transport so the released v0.002 model-only transport
 * stays intact. The inline agent is pinned to one configured MCP server and the
 * positive @read-only selector; every unrelated default capability is disabled.
 */
export class V003SdkTrueForgeTransport implements TrueForgeTransport {
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
            iterationLimit: ROOK_V003_RUNTIME_GUARDRAILS.iterationLimit,
            sandbox: { enabled: ROOK_V003_RUNTIME_GUARDRAILS.sandboxEnabled },
            dynamicSubAgents: { enabled: ROOK_V003_RUNTIME_GUARDRAILS.dynamicSubAgentsEnabled },
            askUserQuestions: { enabled: ROOK_V003_RUNTIME_GUARDRAILS.askUserQuestionsEnabled },
            generativeUi: { enabled: ROOK_V003_RUNTIME_GUARDRAILS.generativeUiEnabled },
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
        if (!base) {
          throw new HarnessProtocolError(
            `TrueForge model.message.delta ${event.id} arrived without its base model.message.`,
          )
        }
        mergeEventDelta(base, event)
        if (base.finishReason != null) {
          yield { event: base, sequence }
          pendingModelMessages.delete(event.id)
        }
        continue
      }

      if (event.type === 'model.message') {
        if (pendingModelMessages.has(event.id)) {
          throw new HarnessProtocolError(`TrueForge repeated model.message base ${event.id}.`)
        }
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
      throw new HarnessProtocolError(
        `TrueForge stream ended with ${pendingModelMessages.size} unsettled model.message event(s).`,
      )
    }
  }
}

const errorMessage = (error: unknown): string => error instanceof Error ? error.message : 'Unknown TrueForge transport error.'

type HarnessSubscriber = (event: HarnessEvent) => void
type UnknownRecord = Record<string, unknown>
type McpToolCalledEvent = Extract<HarnessEvent, { type: 'mcp.tool.called' }>

const allowedReadOnlyToolNames = new Set<string>(ROOK_V003_READ_ONLY_TOOL_NAMES)
const allowedV003FinishReasons = new Set(['stop', 'length', 'content_filter', 'tool_calls'])

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

const readOptionalArray = (record: UnknownRecord, description: string, ...keys: string[]): unknown[] | undefined => {
  for (const key of keys) {
    if (!hasOwn(record, key)) continue
    const value = record[key]
    if (!Array.isArray(value)) throw new HarnessProtocolError(`TrueForge ${description} is not an array.`)
    return value
  }
  return undefined
}

const v003EvidenceFor = (
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

const normalizeV003ModelMessage = (
  raw: UnknownRecord,
  sessionId: string,
  sequence: string | undefined,
  observedAt: string,
): HarnessEvent[] => {
  const toolCalls = readOptionalArray(raw, 'model.message toolCalls', 'toolCalls', 'tool_calls')
  if (!toolCalls || toolCalls.length === 0) return []

  const evidence = v003EvidenceFor(raw, sequence, observedAt, true)
  const threadId = requireString(raw, 'model.message thread id', 'threadId', 'thread_id')

  return toolCalls.map((candidate, index) => {
    if (!isRecord(candidate)) {
      throw new HarnessProtocolError(`TrueForge model.message tool call ${index} is not an object.`)
    }

    const callId = requireString(candidate, `tool call ${index} id`, 'id')
    const callType = requireString(candidate, `tool call ${index} type`, 'type')
    if (callType !== 'function') {
      throw new HarnessProtocolError(`v0.003 observed unsupported tool call type ${callType} for ${callId}.`)
    }

    const functionCall = readRecord(candidate, 'function')
    if (!functionCall) throw new HarnessProtocolError(`TrueForge tool call ${callId} is missing function metadata.`)
    const name = requireString(functionCall, `tool call ${callId} function name`, 'name')
    const args = requireRawString(functionCall, `tool call ${callId} serialized arguments`, 'arguments')

    const toolInfo = readRecord(candidate, 'toolInfo', 'tool_info')
    if (!toolInfo) throw new HarnessProtocolError(`TrueForge tool call ${callId} is missing toolInfo provenance.`)
    const toolInfoType = requireString(toolInfo, `tool call ${callId} toolInfo type`, 'type')
    if (toolInfoType !== 'mcp') {
      throw new HarnessProtocolError(`v0.003 observed non-MCP tool call ${callId} (${toolInfoType}).`)
    }

    const serverId = requireString(toolInfo, `tool call ${callId} MCP server id`, 'serverId', 'server_id')
    const serverName = requireString(toolInfo, `tool call ${callId} MCP server name`, 'serverName', 'server_name')
    const toolInfoName = requireString(toolInfo, `tool call ${callId} MCP tool name`, 'name')

    if (serverName !== ROOK_V003_MCP_SERVER_NAME) {
      throw new HarnessProtocolError(`v0.003 observed tool call ${callId} from unexpected MCP server ${serverName}.`)
    }
    if (toolInfoName !== name) {
      throw new HarnessProtocolError(`v0.003 tool call ${callId} carried conflicting tool names ${name} and ${toolInfoName}.`)
    }
    if (!allowedReadOnlyToolNames.has(name)) {
      throw new HarnessProtocolError(`v0.003 observed tool ${name} outside the owned read-only inventory.`)
    }

    return {
      ...evidence,
      threadId,
      type: 'mcp.tool.called' as const,
      sessionId,
      callId,
      name,
      arguments: args,
      serverId,
      serverName,
    }
  })
}

const normalizeV003ModelDelta = (
  raw: UnknownRecord,
  sessionId: string,
  sequence: string | undefined,
  observedAt: string,
): HarnessEvent[] => {
  const finishReason = readString(raw, 'finishReason', 'finish_reason')
  if (finishReason && !allowedV003FinishReasons.has(finishReason)) {
    throw new HarnessProtocolError(`v0.003 observed unsupported model finish reason ${finishReason}.`)
  }

  const toolCallDeltas = readOptionalArray(raw, 'model.message.delta toolCalls', 'toolCalls', 'tool_calls')
  const contentBlocks = readOptionalArray(raw, 'model.message.delta content blocks', 'contentBlocks', 'content_blocks')
  const content = readRawString(raw, 'content')

  if (content !== undefined && content.length > 0) {
    return [{
      ...v003EvidenceFor(raw, sequence, observedAt),
      type: 'agent.message.delta',
      sessionId,
      text: content,
    }]
  }

  if (
    finishReason
    || toolCallDeltas
    || contentBlocks
    || readRawString(raw, 'reasoningContent', 'reasoning_content') !== undefined
    || readRawString(raw, 'refusal') !== undefined
  ) {
    return []
  }

  throw new HarnessProtocolError('TrueForge model.message.delta contained no retainable v0.003 content or metadata.')
}

const normalizeV003ToolResponse = (
  raw: UnknownRecord,
  sessionId: string,
  sequence: string | undefined,
  observedAt: string,
): HarnessEvent[] => [{
  ...v003EvidenceFor(raw, sequence, observedAt, true),
  threadId: requireString(raw, 'tool.response thread id', 'threadId', 'thread_id'),
  type: 'mcp.tool.returned',
  sessionId,
  callId: requireString(raw, 'tool.response tool call id', 'toolCallId', 'tool_call_id'),
  content: requireRawString(raw, 'tool.response content', 'content'),
}]

/**
 * v0.003 retains settled model.message tool calls instead of reconstructing
 * fragmented tool-call deltas. Tool arguments and tool responses remain raw
 * serialized strings; ROOK does not invent parsed semantics at this boundary.
 */
export function normalizeV003TrueForgeEvent(
  rawEvent: unknown,
  sessionId: string,
  sequence?: string,
  observedAt = new Date().toISOString(),
): HarnessEvent[] {
  if (!isRecord(rawEvent)) throw new HarnessProtocolError('TrueForge stream yielded a non-object event.')
  const type = requireString(rawEvent, 'event type', 'type')

  switch (type) {
    case 'model.message':
      return normalizeV003ModelMessage(rawEvent, sessionId, sequence, observedAt)
    case 'model.message.delta':
      return normalizeV003ModelDelta(rawEvent, sessionId, sequence, observedAt)
    case 'tool.response':
      return normalizeV003ToolResponse(rawEvent, sessionId, sequence, observedAt)
    case 'tool.response_required':
      throw new HarnessProtocolError('v0.003 does not permit user-supplied tool responses.')
    default:
      return normalizeTrueForgeEvent(rawEvent, sessionId, sequence, observedAt)
  }
}

export const buildV003ReadOnlyInstructions = (request: IncidentSessionRequest): string => [
  'You are the ROOK v0.003 read-only incident investigation agent.',
  `Your only external evidence source is the configured MCP server ${ROOK_V003_MCP_SERVER_NAME}.`,
  'That source is an owned, fictional, non-production demo system. Never present its observations as production telemetry.',
  'Use only MCP tools exposed by the @read-only selector. Never request or imply mutation authority.',
  'Sandbox, dynamic subagents, ask-user-question tools, Generative UI, skills, and mutation are outside this milestone.',
  'Treat MCP tool output as observed evidence. Treat causal explanations as inferred until the retained evidence chain supports them.',
  'Do not present a proposal as approved, an execution as verified, or a verification result as policy.',
  `Incident: ${request.incidentId} — ${request.title}.`,
  `Objective: ${request.objective}`,
].join('\n')

const forbiddenV003EventTypes = new Set<HarnessEvent['type']>([
  'tool.returned',
  'sandbox.started',
  'subagent.started',
  'subagent.completed',
  'approval.requested',
  'mcp.authorization.required',
])

const assertV003CapabilityBoundary = (event: HarnessEvent): void => {
  if (forbiddenV003EventTypes.has(event.type)) {
    throw new HarnessProtocolError(
      `v0.003 read-only investigation observed forbidden capability event ${event.type} (${event.sourceEventId}).`,
    )
  }

  if (event.type === 'turn.completed') {
    if (event.requiredActionCount !== 0) {
      throw new HarnessProtocolError(
        `v0.003 read-only turn observed ${event.requiredActionCount} required action(s) at ${event.sourceEventId}.`,
      )
    }
    if (event.status !== 'done') {
      throw new HarnessProtocolError(`v0.003 investigation ended with non-success terminal status ${event.status}.`)
    }
  }
}

export class V003TrueForgeHarnessAdapter implements RookHarnessAdapter {
  private state: HarnessConnectionState = 'disconnected'
  private readonly subscribers = new Map<string, Set<HarnessSubscriber>>()
  private errorSequence = 0

  constructor(
    private readonly config: V003TrueForgeHarnessAdapterConfig,
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
        instructions: buildV003ReadOnlyInstructions(request),
      })
      const observedAt = this.now()
      this.state = 'ready'
      return {
        incidentId: request.incidentId,
        sessionId: session.id,
        observation: {
          source: 'trueforge-session-response',
          observedAt,
        },
      }
    } catch (error) {
      this.state = 'failed'
      throw error
    }
  }

  async runTurn(request: TurnRequest): Promise<void> {
    this.state = 'connecting'
    let terminalEventCount = 0
    let correlatedMcpResponseCount = 0
    let retryPressureCallCount = 0
    const pendingMcpCalls = new Map<string, McpToolCalledEvent>()
    const completedMcpCallIds = new Set<string>()

    try {
      for await (const item of this.transport.streamTurn(request.sessionId, request.instruction)) {
        const events = normalizeV003TrueForgeEvent(item.event, request.sessionId, item.sequence, this.now())
        for (const event of events) {
          if (terminalEventCount > 0) {
            throw new HarnessProtocolError(`TrueForge stream emitted ${event.type} after terminal turn.done evidence.`)
          }

          assertV003CapabilityBoundary(event)

          if (event.type === 'mcp.tool.called') {
            if (pendingMcpCalls.has(event.callId) || completedMcpCallIds.has(event.callId)) {
              throw new HarnessProtocolError(`TrueForge stream repeated MCP tool call id ${event.callId}.`)
            }
            if (event.name === 'get_retry_pressure') retryPressureCallCount += 1
            pendingMcpCalls.set(event.callId, event)
          } else if (event.type === 'mcp.tool.returned') {
            const call = pendingMcpCalls.get(event.callId)
            if (!call) {
              if (completedMcpCallIds.has(event.callId)) {
                throw new HarnessProtocolError(`TrueForge stream repeated MCP tool response for ${event.callId}.`)
              }
              throw new HarnessProtocolError(`TrueForge tool.response ${event.sourceEventId} has no retained tool call ${event.callId}.`)
            }
            if (call.threadId !== event.threadId) {
              throw new HarnessProtocolError(`TrueForge MCP call/response thread mismatch for ${event.callId}.`)
            }
            pendingMcpCalls.delete(event.callId)
            completedMcpCallIds.add(event.callId)
            correlatedMcpResponseCount += 1
          } else if (event.type === 'turn.completed') {
            if (pendingMcpCalls.size > 0) {
              throw new HarnessProtocolError(
                `TrueForge turn.done arrived with ${pendingMcpCalls.size} MCP tool call(s) lacking tool.response evidence.`,
              )
            }
            terminalEventCount += 1
          }

          this.emit(request.sessionId, event)
        }
      }

      if (terminalEventCount !== 1) {
        throw new HarnessProtocolError('TrueForge stream ended before one terminal turn.done event was observed.')
      }
      if (pendingMcpCalls.size !== 0) {
        throw new HarnessProtocolError('TrueForge stream ended with uncorrelated MCP tool calls.')
      }
      if (correlatedMcpResponseCount === 0) {
        throw new HarnessProtocolError('v0.003 investigation ended without any correlated MCP tool evidence.')
      }
      if (retryPressureCallCount !== 1) {
        throw new HarnessProtocolError(
          `v0.003 proof requires exactly one get_retry_pressure call; observed ${retryPressureCallCount}.`,
        )
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
        sourceEventId: `rook-v003-adapter-error-${this.errorSequence}`,
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
