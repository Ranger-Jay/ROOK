export type HarnessConnectionState = 'disconnected' | 'connecting' | 'ready' | 'failed'

export interface HarnessEventEvidence {
  source: 'trueforge' | 'rook-adapter'
  sourceEventId: string
  sourceTimestamp?: string
  observedAt: string
  sequence?: string
  threadId?: string | null
}

export type HarnessEvent = HarnessEventEvidence & (
  | { type: 'session.created'; incidentId: string; sessionId: string }
  | { type: 'turn.started'; sessionId: string; turnId: string }
  | { type: 'agent.message.delta'; sessionId: string; text: string }
  | { type: 'tool.returned'; sessionId: string; callId: string }
  | { type: 'sandbox.started'; sessionId: string; sandboxId: string }
  | { type: 'subagent.started'; sessionId: string; role: string; taskId: string }
  | { type: 'subagent.completed'; sessionId: string; role: string; taskId: string; outcome: 'done' | 'error' }
  | { type: 'approval.requested'; sessionId: string; approvalId: string; sourceMessageId: string }
  | { type: 'mcp.authorization.required'; sessionId: string; servers: readonly { name: string; authUrl: string }[] }
  | { type: 'turn.completed'; sessionId: string; status: 'done' | 'cancelled' | 'error'; requiredActionCount: number }
  | { type: 'error'; sessionId?: string; message: string }
)

export interface IncidentSessionRequest {
  incidentId: string
  title: string
  objective: string
  metadata?: Readonly<Record<string, string>>
}

export interface IncidentSession {
  incidentId: string
  sessionId: string
}

export interface TurnRequest {
  sessionId: string
  instruction: string
}

export interface RookHarnessAdapter {
  readonly connectionState: HarnessConnectionState

  /** Maps one ROOK incident to one durable TrueForge session. */
  createIncidentSession(request: IncidentSessionRequest): Promise<IncidentSession>

  /** Starts/continues the TrueForge agent loop for an existing incident session. */
  runTurn(request: TurnRequest): Promise<void>

  /** Emits normalized evidence without leaking generated SDK wire types into the UI. */
  subscribe(sessionId: string, onEvent: (event: HarnessEvent) => void): () => void
}

/**
 * Used whenever the required live configuration is absent or disallowed. ROOK
 * fails explicitly instead of silently falling back while presenting a live claim.
 */
export class UnconfiguredHarnessAdapter implements RookHarnessAdapter {
  readonly connectionState = 'disconnected' as const

  constructor(private readonly reason = 'TrueForge harness is not configured.') {}

  async createIncidentSession(): Promise<never> {
    throw new Error(`${this.reason} No live TrueForge session was created.`)
  }

  async runTurn(): Promise<never> {
    throw new Error(`${this.reason} No live TrueForge turn was started.`)
  }

  subscribe(): () => void {
    return () => undefined
  }
}
