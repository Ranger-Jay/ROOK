export type HarnessConnectionState = 'disconnected' | 'connecting' | 'ready' | 'failed'

export type HarnessEvent =
  | { type: 'session.created'; sessionId: string }
  | { type: 'agent.message'; sessionId: string; text: string }
  | { type: 'tool.started'; sessionId: string; toolName: string; callId: string }
  | { type: 'tool.completed'; sessionId: string; toolName: string; callId: string; ok: boolean }
  | { type: 'sandbox.started'; sessionId: string; sandboxId: string }
  | { type: 'sandbox.completed'; sessionId: string; sandboxId: string; ok: boolean }
  | { type: 'subagent.started'; sessionId: string; role: string; taskId: string }
  | { type: 'subagent.completed'; sessionId: string; role: string; taskId: string; ok: boolean }
  | { type: 'approval.requested'; sessionId: string; approvalId: string; summary: string }
  | { type: 'approval.resolved'; sessionId: string; approvalId: string; approved: boolean }
  | { type: 'error'; sessionId?: string; message: string }

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

  /**
   * Maps one ROOK incident to one durable TrueForge session.
   */
  createIncidentSession(request: IncidentSessionRequest): Promise<IncidentSession>

  /**
   * Starts/continues the TrueForge agent loop for an existing incident session.
   */
  runTurn(request: TurnRequest): Promise<void>

  /**
   * Emits normalized events that the command surface can render without depending
   * on generated SDK wire types. The v0.002 adapter owns SDK-to-domain translation.
   */
  subscribe(sessionId: string, onEvent: (event: HarnessEvent) => void): () => void
}

/**
 * v0.001 never fabricates a live harness connection. This adapter exists so the UI
 * can fail explicitly until v0.002 wires @truefoundry/trueforge-sdk.
 */
export class UnconfiguredHarnessAdapter implements RookHarnessAdapter {
  readonly connectionState = 'disconnected' as const

  async createIncidentSession(): Promise<never> {
    throw new Error('TrueForge harness is not configured. Live integration begins in v0.002.')
  }

  async runTurn(): Promise<never> {
    throw new Error('TrueForge harness is not configured. Live integration begins in v0.002.')
  }

  subscribe(): () => void {
    return () => undefined
  }
}
