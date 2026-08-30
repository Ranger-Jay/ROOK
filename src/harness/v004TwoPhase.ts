import type {
  HarnessConnectionState,
  HarnessEvent,
  IncidentSession,
  IncidentSessionRequest,
  RookHarnessAdapter,
  TurnRequest,
} from './adapter'
import { selectLatestObservedRetryPressure } from './liveIncidentEvidence'
import {
  HarnessProtocolError,
  type TrueForgeTransport,
} from './trueforge'
import { ROOK_V003_MCP_SERVER_NAME } from './v003'
import {
  ROOK_V004_REPRODUCTION_INPUT,
  ROOK_V004_SANDBOX_COMMAND,
  ROOK_V004_SANDBOX_INTENT,
  buildV004SandboxInstructions,
  normalizeV004TrueForgeEvent,
  type V004ToolCallKind,
} from './v004'

export interface V004TwoPhaseHarnessAdapterConfig {
  modelName: string
}

type HarnessSubscriber = (event: HarnessEvent) => void
type McpToolCalledEvent = Extract<HarnessEvent, { type: 'mcp.tool.called' }>
type SandboxExecCalledEvent = Extract<HarnessEvent, { type: 'sandbox.exec.called' }>
type Phase = 'observation' | 'reproduction'

export const V004_OBSERVATION_TURN_INSTRUCTION = [
  'PHASE 1 OF 2 — OBSERVATION ONLY.',
  `Call ${ROOK_V003_MCP_SERVER_NAME} tool get_retry_pressure exactly once and wait for its response.`,
  'Do not call exec or any other tool in this turn.',
  'Do NOT call list_tools, get_tool_info, get_tool_output_schema, or call_tool.',
  'After the get_retry_pressure response returns, end this turn without prose.',
].join('\n')

export const V004_REPRODUCTION_TURN_INSTRUCTION = [
  'PHASE 2 OF 2 — SANDBOX REPRODUCTION ONLY.',
  'The prior turn in this same TrueForge session already retained and validated the required get_retry_pressure observation.',
  'Your next and only tool call MUST be the preloaded TrueForge sandbox exec tool.',
  'Do NOT call get_retry_pressure again.',
  'Do NOT call list_tools, get_tool_info, get_tool_output_schema, or call_tool.',
  `The exec intent must be exactly: ${ROOK_V004_SANDBOX_INTENT}`,
  `The exec command must be exactly: ${ROOK_V004_SANDBOX_COMMAND}`,
  `The exec arguments JSON must be exactly: ${JSON.stringify({ intent: ROOK_V004_SANDBOX_INTENT, command: ROOK_V004_SANDBOX_COMMAND })}`,
  'OMIT cwd entirely. OMIT env entirely. Do not supply files, network requests, package installation, or any other command.',
  'Wait for the exec tool response, then end this turn without prose.',
].join('\n')

const forbiddenCapabilityEvents = new Set<HarnessEvent['type']>([
  'tool.returned',
  'subagent.started',
  'subagent.completed',
  'approval.requested',
  'mcp.authorization.required',
])

const assertSuccessfulTerminal = (event: Extract<HarnessEvent, { type: 'turn.completed' }>): void => {
  if (event.requiredActionCount !== 0) {
    throw new HarnessProtocolError(`v0.004 phase terminal observed ${event.requiredActionCount} required action(s) at ${event.sourceEventId}.`)
  }
  if (event.status !== 'done') {
    throw new HarnessProtocolError(`v0.004 phase ended with non-success terminal status ${event.status}.`)
  }
}

const observationMatchesContract = (events: readonly HarnessEvent[]): boolean => {
  const observed = selectLatestObservedRetryPressure(events)
  return observed !== null
    && observed.attemptsPerMinute === ROOK_V004_REPRODUCTION_INPUT.attemptsPerMinute
    && observed.baselineAttemptsPerMinute === ROOK_V004_REPRODUCTION_INPUT.baselineAttemptsPerMinute
    && observed.retryMultiplier === ROOK_V004_REPRODUCTION_INPUT.retryMultiplier
    && observed.sharedQueueDepth === ROOK_V004_REPRODUCTION_INPUT.queueDepth
    && observed.sharedQueueSaturationPct === ROOK_V004_REPRODUCTION_INPUT.queueSaturationPct
}

const errorMessage = (error: unknown): string => error instanceof Error ? error.message : 'Unknown TrueForge transport error.'

export class V004TwoPhaseTrueForgeHarnessAdapter implements RookHarnessAdapter {
  private state: HarnessConnectionState = 'disconnected'
  private readonly subscribers = new Map<string, Set<HarnessSubscriber>>()
  private errorSequence = 0

  constructor(
    private readonly config: V004TwoPhaseHarnessAdapterConfig,
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
    const retained: HarnessEvent[] = []
    const callKinds = new Map<string, V004ToolCallKind>()
    const completedCallIds = new Set<string>()
    const pendingMcpCalls = new Map<string, McpToolCalledEvent>()
    const pendingSandboxCalls = new Map<string, SandboxExecCalledEvent>()

    let retryPressureCallCount = 0
    let retryPressureResponseCount = 0
    let sandboxExecCallCount = 0
    let sandboxCreatedCount = 0
    let sandboxExecResponseCount = 0

    const consumePhase = async (phase: Phase, instruction: string): Promise<void> => {
      let phaseTerminalCount = 0
      let phaseTurnStartedCount = 0

      for await (const item of this.transport.streamTurn(request.sessionId, instruction)) {
        const events = normalizeV004TrueForgeEvent(item.event, request.sessionId, item.sequence, this.now(), callKinds)
        for (const event of events) {
          if (phaseTerminalCount > 0) {
            throw new HarnessProtocolError(`TrueForge ${phase} phase emitted ${event.type} after its terminal turn.done evidence.`)
          }
          if (forbiddenCapabilityEvents.has(event.type)) {
            throw new HarnessProtocolError(`v0.004 observed forbidden capability event ${event.type} (${event.sourceEventId}).`)
          }

          if (event.type === 'turn.started') {
            phaseTurnStartedCount += 1
            if (phaseTurnStartedCount > 1) throw new HarnessProtocolError(`v0.004 ${phase} phase observed more than one turn.created event.`)
          } else if (event.type === 'mcp.tool.called') {
            if (phase !== 'observation') throw new HarnessProtocolError('v0.004 reproduction phase attempted an MCP tool call.')
            if (event.serverName !== ROOK_V003_MCP_SERVER_NAME || event.name !== 'get_retry_pressure') {
              throw new HarnessProtocolError(`v0.004 observation phase permits only ${ROOK_V003_MCP_SERVER_NAME}/get_retry_pressure.`)
            }
            if (callKinds.has(event.callId) || completedCallIds.has(event.callId)) {
              throw new HarnessProtocolError(`TrueForge stream repeated tool call id ${event.callId}.`)
            }
            retryPressureCallCount += 1
            if (retryPressureCallCount > 1) throw new HarnessProtocolError('v0.004 permits exactly one get_retry_pressure call.')
            callKinds.set(event.callId, 'mcp')
            pendingMcpCalls.set(event.callId, event)
          } else if (event.type === 'mcp.tool.returned') {
            if (phase !== 'observation') throw new HarnessProtocolError('v0.004 reproduction phase returned unexpected MCP evidence.')
            const call = pendingMcpCalls.get(event.callId)
            if (!call) throw new HarnessProtocolError(`TrueForge MCP response ${event.sourceEventId} has no retained initiating call ${event.callId}.`)
            if (call.threadId !== event.threadId) throw new HarnessProtocolError(`TrueForge MCP call/response thread mismatch for ${event.callId}.`)
            pendingMcpCalls.delete(event.callId)
            completedCallIds.add(event.callId)
            retryPressureResponseCount += 1
          } else if (event.type === 'sandbox.exec.called') {
            if (phase !== 'reproduction') throw new HarnessProtocolError('v0.004 observation phase attempted sandbox execution.')
            if (callKinds.has(event.callId) || completedCallIds.has(event.callId)) {
              throw new HarnessProtocolError(`TrueForge stream repeated tool call id ${event.callId}.`)
            }
            sandboxExecCallCount += 1
            if (sandboxExecCallCount > 1) throw new HarnessProtocolError('v0.004 permits exactly one sandbox exec call.')
            callKinds.set(event.callId, 'sandbox')
            pendingSandboxCalls.set(event.callId, event)
          } else if (event.type === 'sandbox.started') {
            if (phase !== 'reproduction') throw new HarnessProtocolError('v0.004 observation phase created an unexpected sandbox.')
            sandboxCreatedCount += 1
            if (sandboxCreatedCount > 1) throw new HarnessProtocolError('v0.004 observed more than one sandbox.created event.')
            if (pendingSandboxCalls.size !== 1) {
              throw new HarnessProtocolError('v0.004 sandbox.created was not correlated to the single pending sandbox exec call.')
            }
          } else if (event.type === 'sandbox.exec.returned') {
            if (phase !== 'reproduction') throw new HarnessProtocolError('v0.004 observation phase returned unexpected sandbox evidence.')
            const call = pendingSandboxCalls.get(event.callId)
            if (!call) throw new HarnessProtocolError(`TrueForge sandbox response ${event.sourceEventId} has no retained exec call ${event.callId}.`)
            if (sandboxCreatedCount !== 1) throw new HarnessProtocolError('v0.004 sandbox exec returned without sandbox.created evidence.')
            if (call.threadId !== event.threadId) throw new HarnessProtocolError(`TrueForge sandbox call/response thread mismatch for ${event.callId}.`)
            pendingSandboxCalls.delete(event.callId)
            completedCallIds.add(event.callId)
            sandboxExecResponseCount += 1
          } else if (event.type === 'turn.completed') {
            assertSuccessfulTerminal(event)
            if (pendingMcpCalls.size > 0 || pendingSandboxCalls.size > 0) {
              throw new HarnessProtocolError(`v0.004 ${phase} phase turn.done arrived with unresolved tool calls.`)
            }
            phaseTerminalCount += 1
          }

          retained.push(event)
          this.emit(request.sessionId, event)
        }
      }

      if (phaseTurnStartedCount !== 1) throw new HarnessProtocolError(`v0.004 ${phase} phase did not retain exactly one turn.created event.`)
      if (phaseTerminalCount !== 1) throw new HarnessProtocolError(`v0.004 ${phase} phase did not retain exactly one successful turn.done event.`)
    }

    try {
      await consumePhase('observation', V004_OBSERVATION_TURN_INSTRUCTION)

      if (retryPressureCallCount !== 1 || retryPressureResponseCount !== 1 || pendingMcpCalls.size !== 0) {
        throw new HarnessProtocolError(`v0.004 observation phase requires one correlated get_retry_pressure call/response; observed calls=${retryPressureCallCount} responses=${retryPressureResponseCount}.`)
      }
      if (!observationMatchesContract(retained)) {
        throw new HarnessProtocolError('v0.004 observation phase did not retain the exact owned-demo retry-pressure contract; sandbox phase was not started.')
      }

      await consumePhase('reproduction', V004_REPRODUCTION_TURN_INSTRUCTION)

      if (sandboxExecCallCount !== 1 || sandboxCreatedCount !== 1 || sandboxExecResponseCount !== 1 || pendingSandboxCalls.size !== 0) {
        throw new HarnessProtocolError(
          `v0.004 reproduction phase requires one correlated exec/sandbox.created/response chain; observed calls=${sandboxExecCallCount} sandboxes=${sandboxCreatedCount} responses=${sandboxExecResponseCount}.`,
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
        sourceEventId: `rook-v004-two-phase-error-${this.errorSequence}`,
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
