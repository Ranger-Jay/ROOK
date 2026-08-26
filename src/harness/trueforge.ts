import { TrueForge } from '@truefoundry/trueforge-sdk'
import type {
  HarnessConnectionState,
  HarnessEvent,
  IncidentSession,
  IncidentSessionRequest,
  RookHarnessAdapter,
  TurnRequest,
} from './adapter'

type UnknownRecord = Record<string, unknown>

export interface TrueForgeStreamItem {
  event: unknown
  sequence?: string
}

export interface TrueForgeSessionSeed {
  modelName: string
  instructions: string
}

export interface TrueForgeTransport {
  createSession(seed: TrueForgeSessionSeed): Promise<{ id: string }>
  streamTurn(sessionId: string, instruction: string): AsyncIterable<TrueForgeStreamItem>
}

export interface LocalTrueForgeTransportConfig {
  baseUrl: string
  timeoutInSeconds?: number
}

export interface TrueForgeHarnessAdapterConfig {
  modelName: string
}

export class HarnessProtocolError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'HarnessProtocolError'
  }
}

const isRecord = (value: unknown): value is UnknownRecord => typeof value === 'object' && value !== null && !Array.isArray(value)

const readString = (record: UnknownRecord, ...keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim().length > 0) return value
  }
  return undefined
}

const readArray = (record: UnknownRecord, ...keys: string[]): unknown[] => {
  for (const key of keys) {
    const value = record[key]
    if (Array.isArray(value)) return value
  }
  return []
}

const readRecord = (record: UnknownRecord, ...keys: string[]): UnknownRecord | undefined => {
  for (const key of keys) {
    const value = record[key]
    if (isRecord(value)) return value
  }
  return undefined
}

const readThreadId = (record: UnknownRecord): string | null | undefined => {
  if (Object.prototype.hasOwnProperty.call(record, 'threadId')) {
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

const normalizeTerminalStatus = (value: unknown): 'done' | 'cancelled' | 'error' => {
  if (value === 'done' || value === 'cancelled' || value === 'error') return value
  throw new HarnessProtocolError(`TrueForge turn.done carried unsupported status: ${String(value)}.`)
}

const evidenceFor = (
  raw: UnknownRecord,
  sequence: string | undefined,
  observedAt: string,
) => ({
  source: 'trueforge' as const,
  sourceEventId: requireString(raw, 'event id', 'id'),
  sourceTimestamp: readString(raw, 'createdAt', 'created_at'),
  observedAt,
  sequence,
  threadId: readThreadId(raw),
})

const knownEventTypes = new Set([
  'turn.created',
  'model.message.delta',
  'tool.response',
  'sandbox.created',
  'thread.created',
  'thread.done',
  'tool.approval_required',
  'mcp.auth_required',
  'turn.done',
])

/**
 * Translate only event facts that TrueForge explicitly emitted. Unknown event types
 * are ignored without requiring today's common fields. Malformed known events fail closed.
 */
export function normalizeTrueForgeEvent(
  rawEvent: unknown,
  sessionId: string,
  sequence?: string,
  observedAt = new Date().toISOString(),
): HarnessEvent[] {
  if (!isRecord(rawEvent)) throw new HarnessProtocolError('TrueForge stream yielded a non-object event.')

  const type = requireString(rawEvent, 'event type', 'type')
  if (!knownEventTypes.has(type)) return []

  const evidence = evidenceFor(rawEvent, sequence, observedAt)

  switch (type) {
    case 'turn.created':
      return [{
        ...evidence,
        type: 'turn.started',
        sessionId,
        turnId: requireString(rawEvent, 'turn id', 'turnId', 'turn_id'),
      }]

    case 'model.message.delta':
      return [{
        ...evidence,
        type: 'agent.message.delta',
        sessionId,
        text: requireString(rawEvent, 'model-message delta content', 'content'),
      }]

    case 'tool.response':
      return [{
        ...evidence,
        type: 'tool.returned',
        sessionId,
        callId: requireString(rawEvent, 'tool call id', 'toolCallId', 'tool_call_id'),
      }]

    case 'sandbox.created':
      return [{
        ...evidence,
        type: 'sandbox.started',
        sessionId,
        sandboxId: requireString(rawEvent, 'sandbox id', 'sandboxId', 'sandbox_id'),
      }]

    case 'thread.created': {
      const threadId = requireString(rawEvent, 'subagent thread id', 'threadId', 'thread_id')
      const agentInfo = readRecord(rawEvent, 'agentInfo', 'agent_info')
      const role = readString(rawEvent, 'title') ?? (agentInfo ? readString(agentInfo, 'name') : undefined) ?? threadId
      return [{ ...evidence, threadId, type: 'subagent.started', sessionId, role, taskId: threadId }]
    }

    case 'thread.done': {
      const threadId = requireString(rawEvent, 'subagent thread id', 'threadId', 'thread_id')
      const state = readRecord(rawEvent, 'state')
      if (!state) throw new HarnessProtocolError('TrueForge thread.done is missing state.')
      const status = readString(state, 'status')
      if (status !== 'done' && status !== 'error') {
        throw new HarnessProtocolError(`TrueForge thread.done carried unsupported status: ${String(status)}.`)
      }
      return [{
        ...evidence,
        threadId,
        type: 'subagent.completed',
        sessionId,
        role: readString(rawEvent, 'title') ?? threadId,
        taskId: threadId,
        outcome: status,
      }]
    }

    case 'tool.approval_required': {
      const candidates = readArray(rawEvent, 'toolCalls', 'tool_calls')
      if (candidates.length === 0) {
        throw new HarnessProtocolError('TrueForge approval event contained no tool-call references.')
      }

      return candidates.map((candidate, index) => {
        if (!isRecord(candidate)) {
          throw new HarnessProtocolError(`TrueForge approval entry ${index} is not an object.`)
        }
        return {
          ...evidence,
          type: 'approval.requested' as const,
          sessionId,
          approvalId: requireString(candidate, `approval entry ${index} call id`, 'id'),
          sourceMessageId: requireString(candidate, `approval entry ${index} source event id`, 'sourceEventId', 'source_event_id'),
        }
      })
    }

    case 'mcp.auth_required': {
      const candidates = readArray(rawEvent, 'mcpServers', 'mcp_servers')
      if (candidates.length === 0) {
        throw new HarnessProtocolError('TrueForge MCP auth event contained no authorization targets.')
      }

      const servers = candidates.map((candidate, index) => {
        if (!isRecord(candidate)) {
          throw new HarnessProtocolError(`TrueForge MCP authorization target ${index} is not an object.`)
        }
        return {
          name: requireString(candidate, `MCP authorization target ${index} name`, 'name'),
          authUrl: requireString(candidate, `MCP authorization target ${index} URL`, 'authUrl', 'auth_url'),
        }
      })

      return [{ ...evidence, type: 'mcp.authorization.required', sessionId, servers }]
    }

    case 'turn.done': {
      const state = readRecord(rawEvent, 'state')
      if (!state) throw new HarnessProtocolError('TrueForge turn.done is missing state.')
      return [{
        ...evidence,
        type: 'turn.completed',
        sessionId,
        status: normalizeTerminalStatus(state.status),
        requiredActionCount: readArray(state, 'requiredActions', 'required_actions').length,
      }]
    }

    default:
      return []
  }
}

export function assertLocalTrueForgeUrl(baseUrl: string): string {
  let parsed: URL
  try {
    parsed = new URL(baseUrl)
  } catch {
    throw new Error('VITE_TRUEFORGE_URL must be a valid URL.')
  }

  const hostname = parsed.hostname.toLowerCase()
  if (parsed.protocol !== 'http:' || (hostname !== 'localhost' && hostname !== '127.0.0.1')) {
    throw new Error('v0.002 permits only the official local no-login TrueForge boundary on http://localhost or http://127.0.0.1.')
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('VITE_TRUEFORGE_URL must be a credential-free local origin with no userinfo, query, or fragment.')
  }
  if (parsed.pathname !== '/' && parsed.pathname !== '') {
    throw new Error('VITE_TRUEFORGE_URL must contain only the local TrueForge origin, not an endpoint path.')
  }

  return parsed.origin
}

/**
 * Official SDK transport. v0.002 intentionally creates an inline agent with only
 * a model and instructions: no MCP servers, tools, skills, or sandbox authority.
 * Hosted/OIDC connectivity belongs behind a server-side boundary in a later milestone.
 */
export class SdkTrueForgeTransport implements TrueForgeTransport {
  private readonly client: TrueForge

  constructor(config: LocalTrueForgeTransportConfig) {
    this.client = new TrueForge({
      baseUrl: assertLocalTrueForgeUrl(config.baseUrl),
      timeoutInSeconds: config.timeoutInSeconds ?? 600,
    })
  }

  async createSession(seed: TrueForgeSessionSeed): Promise<{ id: string }> {
    const { data } = await this.client.sessions.create({
      agent: {
        spec: {
          model: { name: seed.modelName },
          instructions: seed.instructions,
        },
      },
    })
    return { id: data.id }
  }

  async *streamTurn(sessionId: string, instruction: string): AsyncIterable<TrueForgeStreamItem> {
    const stream = await this.client.sessions.createTurnStream(sessionId, {
      input: [{ type: 'user.message', content: instruction }],
    })

    for await (const item of stream.withMetadata()) {
      yield {
        event: item.data,
        sequence: item.id == null ? undefined : String(item.id),
      }
    }
  }
}

const errorMessage = (error: unknown): string => error instanceof Error ? error.message : 'Unknown TrueForge transport error.'

type HarnessSubscriber = (event: HarnessEvent) => void

const buildReadOnlyInstructions = (request: IncidentSessionRequest): string => [
  'You are the ROOK v0.002 TrueForge connection-verification agent.',
  'This session is intentionally text-only and has no MCP tools, skills, sandbox, or mutation authority.',
  'Never claim that you observed telemetry, configuration, topology, tool output, or production state unless that evidence is explicitly supplied in the conversation.',
  'Do not present a proposal as approved, an execution as verified, or a verification result as policy.',
  `Incident: ${request.incidentId} — ${request.title}.`,
  `Objective: ${request.objective}`,
].join('\n')

const forbiddenV002EventTypes = new Set<HarnessEvent['type']>([
  'tool.returned',
  'sandbox.started',
  'subagent.started',
  'subagent.completed',
  'approval.requested',
  'mcp.authorization.required',
])

const assertV002CapabilityBoundary = (event: HarnessEvent): void => {
  if (forbiddenV002EventTypes.has(event.type)) {
    throw new HarnessProtocolError(
      `v0.002 text-only session observed unexpected capability event ${event.type} (${event.sourceEventId}).`,
    )
  }
  if (event.type === 'turn.completed' && event.requiredActionCount !== 0) {
    throw new HarnessProtocolError(
      `v0.002 text-only turn observed ${event.requiredActionCount} required action(s) at ${event.sourceEventId}.`,
    )
  }
}

export class TrueForgeHarnessAdapter implements RookHarnessAdapter {
  private state: HarnessConnectionState = 'disconnected'
  private readonly subscribers = new Map<string, Set<HarnessSubscriber>>()
  private errorSequence = 0

  constructor(
    private readonly config: TrueForgeHarnessAdapterConfig,
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
        instructions: buildReadOnlyInstructions(request),
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

    try {
      for await (const item of this.transport.streamTurn(request.sessionId, request.instruction)) {
        const events = normalizeTrueForgeEvent(item.event, request.sessionId, item.sequence, this.now())
        for (const event of events) {
          assertV002CapabilityBoundary(event)
          if (event.type === 'turn.completed') terminalEventCount += 1
          if (terminalEventCount > 1) {
            throw new HarnessProtocolError('TrueForge stream contained more than one terminal turn event.')
          }
          this.emit(request.sessionId, event)
        }
      }

      if (terminalEventCount !== 1) {
        throw new HarnessProtocolError('TrueForge stream ended before one terminal turn.done event was observed.')
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
        sourceEventId: `rook-adapter-error-${this.errorSequence}`,
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
