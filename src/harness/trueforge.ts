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

export interface TrueForgeTransport {
  createSession(agentName: string): Promise<{ id: string }>
  streamTurn(sessionId: string, instruction: string): AsyncIterable<TrueForgeStreamItem>
}

export interface LocalTrueForgeTransportConfig {
  baseUrl: string
  timeoutInSeconds?: number
}

export interface TrueForgeHarnessAdapterConfig {
  agentName: string
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
  const value = record.threadId ?? record.thread_id
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

/**
 * Translate only event facts that TrueForge explicitly emitted. Unknown event types
 * are ignored rather than guessed. Malformed known events fail closed.
 */
export function normalizeTrueForgeEvent(
  rawEvent: unknown,
  sessionId: string,
  sequence?: string,
  observedAt = new Date().toISOString(),
): HarnessEvent[] {
  if (!isRecord(rawEvent)) throw new HarnessProtocolError('TrueForge stream yielded a non-object event.')

  const type = requireString(rawEvent, 'event type', 'type')
  const evidence = evidenceFor(rawEvent, sequence, observedAt)

  switch (type) {
    case 'turn.created':
      return [{
        ...evidence,
        type: 'turn.started',
        sessionId,
        turnId: requireString(rawEvent, 'turn id', 'turnId', 'turn_id'),
      }]

    case 'model.message.delta': {
      const text = readString(rawEvent, 'content')
      return text ? [{ ...evidence, type: 'agent.message.delta', sessionId, text }] : []
    }

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
      const approvals = readArray(rawEvent, 'toolCalls', 'tool_calls').flatMap((candidate) => {
        if (!isRecord(candidate)) return []
        const approvalId = readString(candidate, 'id')
        const sourceMessageId = readString(candidate, 'sourceEventId', 'source_event_id')
        if (!approvalId || !sourceMessageId) return []
        return [{ ...evidence, type: 'approval.requested' as const, sessionId, approvalId, sourceMessageId }]
      })
      if (approvals.length === 0) throw new HarnessProtocolError('TrueForge approval event contained no valid tool-call references.')
      return approvals
    }

    case 'mcp.auth_required': {
      const servers = readArray(rawEvent, 'mcpServers', 'mcp_servers').flatMap((candidate) => {
        if (!isRecord(candidate)) return []
        const name = readString(candidate, 'name')
        const authUrl = readString(candidate, 'authUrl', 'auth_url')
        return name && authUrl ? [{ name, authUrl }] : []
      })
      if (servers.length === 0) throw new HarnessProtocolError('TrueForge MCP auth event contained no valid authorization targets.')
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

  return parsed.toString().replace(/\/$/, '')
}

/** Official SDK transport. No token is accepted in v0.002; hosted/OIDC belongs behind a server-side boundary later. */
export class SdkTrueForgeTransport implements TrueForgeTransport {
  private readonly client: TrueForge

  constructor(config: LocalTrueForgeTransportConfig) {
    this.client = new TrueForge({
      baseUrl: assertLocalTrueForgeUrl(config.baseUrl),
      timeoutInSeconds: config.timeoutInSeconds ?? 600,
    })
  }

  async createSession(agentName: string): Promise<{ id: string }> {
    const { data } = await this.client.sessions.create({ agent: { name: agentName } })
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

export class TrueForgeHarnessAdapter implements RookHarnessAdapter {
  private state: HarnessConnectionState = 'disconnected'
  private readonly subscribers = new Map<string, Set<HarnessSubscriber>>()
  private errorSequence = 0

  constructor(
    private readonly config: TrueForgeHarnessAdapterConfig,
    private readonly transport: TrueForgeTransport,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {
    if (!config.agentName.trim()) throw new Error('TrueForge agentName is required.')
  }

  get connectionState(): HarnessConnectionState {
    return this.state
  }

  async createIncidentSession(request: IncidentSessionRequest): Promise<IncidentSession> {
    this.state = 'connecting'
    try {
      const session = await this.transport.createSession(this.config.agentName)
      this.state = 'ready'
      this.emit(session.id, {
        type: 'session.created',
        incidentId: request.incidentId,
        sessionId: session.id,
        source: 'trueforge',
        sourceEventId: session.id,
        observedAt: this.now(),
      })
      return { incidentId: request.incidentId, sessionId: session.id }
    } catch (error) {
      this.state = 'failed'
      throw error
    }
  }

  async runTurn(request: TurnRequest): Promise<void> {
    this.state = 'connecting'
    try {
      for await (const item of this.transport.streamTurn(request.sessionId, request.instruction)) {
        this.state = 'ready'
        const events = normalizeTrueForgeEvent(item.event, request.sessionId, item.sequence, this.now())
        events.forEach((event) => this.emit(request.sessionId, event))
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
