import { useMemo, useState } from 'react'
import type { HarnessEvent, IncidentSession } from './adapter'
import { createHarnessAdapter, resolveHarnessRuntimeConfiguration } from './runtime'
import './trueforge-proof.css'

type ProofStatus = 'unconfigured' | 'idle' | 'connecting' | 'observed' | 'failed'

const incident = {
  incidentId: 'INC-2048',
  title: 'Inventory Retry Storm',
  objective: 'Verify the live TrueForge session and streamed-turn boundary without external tools or mutation authority.',
} as const

const proofInstruction = [
  'Confirm this text-only TrueForge session by returning a short acknowledgement.',
  'Do not claim access to telemetry, MCP tools, sandboxes, production state, topology, or incident evidence.',
  'This turn verifies only the session and event-stream boundary.',
].join(' ')

const statusCopy: Record<ProofStatus, { label: string; detail: string }> = {
  unconfigured: {
    label: 'HARNESS NOT CONFIGURED',
    detail: 'Local TrueForge evidence is unavailable. Incident data remains fixture-only.',
  },
  idle: {
    label: 'HARNESS READY TO OBSERVE',
    detail: 'Local configuration is valid. No live TrueForge session has been observed yet.',
  },
  connecting: {
    label: 'OBSERVING TRUEFORGE',
    detail: 'Waiting for a real session response and one terminal streamed turn event.',
  },
  observed: {
    label: 'LIVE HARNESS OBSERVED',
    detail: 'ROOK observed a real TrueForge session response and terminal turn stream. Incident telemetry below is still fixture data.',
  },
  failed: {
    label: 'HARNESS OBSERVATION FAILED',
    detail: 'The live proof did not complete. ROOK is not promoting this attempt to a live claim.',
  },
}

const eventDetail = (event: HarnessEvent): string => {
  switch (event.type) {
    case 'turn.started':
      return `turn ${event.turnId}`
    case 'agent.message.delta':
      return event.text
    case 'mcp.tool.called':
      return `${event.serverName} · ${event.name} · call ${event.callId}`
    case 'mcp.tool.returned':
      return `MCP response · call ${event.callId}`
    case 'turn.completed':
      return `terminal ${event.status} · required actions ${event.requiredActionCount}`
    case 'error':
      return event.message
    case 'tool.returned':
      return `unexpected tool call ${event.callId}`
    case 'sandbox.started':
      return `unexpected sandbox ${event.sandboxId}`
    case 'subagent.started':
      return `unexpected subagent ${event.role}`
    case 'subagent.completed':
      return `unexpected subagent ${event.role} · ${event.outcome}`
    case 'approval.requested':
      return `unexpected approval ${event.approvalId}`
    case 'mcp.authorization.required':
      return `unexpected MCP authorization · ${event.servers.map((server) => server.name).join(', ')}`
  }
}

export const evidenceEventLabel = (event: HarnessEvent): string =>
  event.type === 'turn.completed' ? 'turn.done' : event.type

export default function TrueForgeProof() {
  const configuration = useMemo(() => resolveHarnessRuntimeConfiguration({
    VITE_TRUEFORGE_URL: import.meta.env.VITE_TRUEFORGE_URL,
    VITE_TRUEFORGE_MODEL: import.meta.env.VITE_TRUEFORGE_MODEL,
  }), [])
  const adapter = useMemo(() => createHarnessAdapter(configuration), [configuration])
  const [status, setStatus] = useState<ProofStatus>(configuration.mode === 'configured' ? 'idle' : 'unconfigured')
  const [session, setSession] = useState<IncidentSession | null>(null)
  const [events, setEvents] = useState<HarnessEvent[]>([])
  const [error, setError] = useState<string | null>(null)

  const verifyConnection = async () => {
    if (configuration.mode !== 'configured' || status === 'connecting') return

    setStatus('connecting')
    setSession(null)
    setEvents([])
    setError(null)

    try {
      const observedSession = await adapter.createIncidentSession(incident)
      setSession(observedSession)

      const turnEvents: HarnessEvent[] = []
      const unsubscribe = adapter.subscribe(observedSession.sessionId, (event) => {
        turnEvents.push(event)
        setEvents([...turnEvents])
      })

      try {
        await adapter.runTurn({
          sessionId: observedSession.sessionId,
          instruction: proofInstruction,
        })
      } finally {
        unsubscribe()
      }

      const terminal = [...turnEvents].reverse().find((event) => event.type === 'turn.completed')
      if (!terminal || terminal.type !== 'turn.completed') {
        throw new Error('No terminal TrueForge turn evidence was observed.')
      }

      setStatus('observed')
    } catch (cause) {
      setStatus('failed')
      setError(cause instanceof Error ? cause.message : 'TrueForge observation failed.')
    }
  }

  const copy = statusCopy[status]
  const recentEvents = events.slice(-8)

  return (
    <section className={`harness-proof proof-${status}`} aria-labelledby="trueforge-proof-title">
      <header className="harness-proof-header">
        <div>
          <span className="harness-kicker">TRUEFORGE · v0.002 connection evidence</span>
          <h2 id="trueforge-proof-title">Live harness boundary</h2>
        </div>
        <span className="harness-proof-state">{copy.label}</span>
      </header>

      <div className="harness-proof-grid">
        <div className="harness-proof-summary">
          <p>{copy.detail}</p>

          {configuration.mode === 'configured' ? (
            <dl className="harness-config">
              <div><dt>Origin</dt><dd>{configuration.baseUrl}</dd></div>
              <div><dt>Model</dt><dd>{configuration.modelName}</dd></div>
              <div><dt>Authority</dt><dd>text-only · no MCP · no sandbox · no mutation</dd></div>
            </dl>
          ) : (
            <div className="harness-config-warning">
              <strong>Configuration observation</strong>
              <span>{configuration.reason}</span>
              <small>Set only the non-secret local origin and model identifier shown in <code>.env.example</code>.</small>
            </div>
          )}

          <button
            className="harness-proof-button"
            type="button"
            disabled={configuration.mode !== 'configured' || status === 'connecting'}
            onClick={() => void verifyConnection()}
          >
            {status === 'connecting' ? 'Observing TrueForge…' : status === 'observed' ? 'Observe a new session' : 'Observe live harness'}
          </button>

          {error && <p className="harness-error" role="alert">{error}</p>}
        </div>

        <div className="harness-evidence" aria-live="polite">
          <div className="harness-evidence-heading">
            <span>Observed evidence</span>
            <small>{session ? `${events.length} streamed event${events.length === 1 ? '' : 's'}` : 'no live session yet'}</small>
          </div>

          {session ? (
            <>
              <div className="session-observation">
                <span>SESSION RESPONSE</span>
                <strong>{session.sessionId}</strong>
                <small>{session.observation.source} · observed {session.observation.observedAt}</small>
              </div>
              <ol className="harness-event-list">
                {recentEvents.map((event, index) => (
                  <li key={`${event.sourceEventId}-${event.sequence ?? index}`}>
                    <div>
                      <strong>{evidenceEventLabel(event)}</strong>
                      <span>{eventDetail(event)}</span>
                    </div>
                    <code>{event.sourceEventId}</code>
                    <small>{event.sourceTimestamp ?? `observed ${event.observedAt}`}{event.sequence ? ` · seq ${event.sequence}` : ''}</small>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <div className="harness-evidence-empty">
              <span>NO LIVE EVIDENCE OBSERVED</span>
              <p>The fixture incident remains visible for product context, but it is not evidence of a TrueForge connection.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
