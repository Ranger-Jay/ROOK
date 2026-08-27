import { TrueForge } from '@truefoundry/trueforge-sdk'
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

export const ROOK_V003_MCP_ATTACHMENT = Object.freeze({
  name: ROOK_V003_MCP_SERVER_NAME,
  enableTools: Object.freeze(['@read-only'] as const),
  preload: false,
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

const forbiddenPreCorrelationEventTypes = new Set<HarnessEvent['type']>([
  'sandbox.started',
  'subagent.started',
  'subagent.completed',
  'approval.requested',
  'mcp.authorization.required',
])

const assertV003PreCorrelationBoundary = (event: HarnessEvent): void => {
  if (event.type === 'tool.returned') {
    throw new HarnessProtocolError(
      `v0.003 MCP tool response ${event.sourceEventId} arrived before call/response correlation support is enabled.`,
    )
  }

  if (forbiddenPreCorrelationEventTypes.has(event.type)) {
    throw new HarnessProtocolError(
      `v0.003 read-only investigation observed forbidden capability event ${event.type} (${event.sourceEventId}).`,
    )
  }

  if (event.type === 'turn.completed' && event.requiredActionCount !== 0) {
    throw new HarnessProtocolError(
      `v0.003 read-only turn observed ${event.requiredActionCount} required action(s) at ${event.sourceEventId}.`,
    )
  }
}

/**
 * Attachment-stage adapter. Tool execution is intentionally fail-closed until
 * the following v0.003 slice can retain and correlate model tool calls with
 * tool.response evidence. This prevents an uncorrelated response from becoming
 * public truth merely because the MCP server is already attached.
 */
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

    try {
      for await (const item of this.transport.streamTurn(request.sessionId, request.instruction)) {
        const events = normalizeTrueForgeEvent(item.event, request.sessionId, item.sequence, this.now())
        for (const event of events) {
          assertV003PreCorrelationBoundary(event)
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
