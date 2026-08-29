import { useMemo, useState } from 'react'
import type { HarnessEvent, IncidentSession } from './adapter'
import { selectLatestObservedRetryPressure } from './liveIncidentEvidence'
import { createHarnessAdapter, resolveHarnessRuntimeConfiguration } from './runtime'
import './trueforge-proof.css'

type ProofStatus = 'unconfigured' | 'idle' | 'connecting' | 'observed' | 'failed'

const incident = {
  incidentId: 'INC-2048',
  title: 'Inventory Retry Storm',
  objective: 'Observe retry pressure from the owned non-production demo source through the governed read-only MCP boundary.',
} as const

export const V003_PROOF_INSTRUCTION = [
  'Investigate the owned Inventory Retry Storm demo using read-only MCP evidence.',
  'You must call get_retry_pressure exactly once before answering.',
  'Use only the returned observation as evidence and label any causal explanation as inferred.',
  'Do not request mutation, approval, sandbox, subagent, user-question, or other external capability.',
].join(' ')

const statusCopy: Record<ProofStatus, { label: string; detail: string }> = {
  unconfigured: {
    label: 'READ-ONLY MCP NOT CONFIGURED',
    detail: 'Local TrueForge evidence is unavailable. The surrounding incident workspace remains fixture-only.',
  },
  idle: {
    label: 'MCP INVESTIGATION READY',
    detail: 'Local configuration is valid. No read-only MCP incident evidence has been observed yet.',
  },
  connecting: {
    label: 'OBSERVING READ-ONLY MCP',
    detail: 'Waiting for a real TrueForge session, correlated MCP call/response evidence, and one successful terminal turn.',
  },
  observed: {
    label: 'LIVE READ-ONLY MCP EVIDENCE',
    detail: 'ROOK observed a real TrueForge turn and correlated read-only MCP evidence from the running owned non-production demo source. This is demo evidence, not production telemetry.',
  },
  failed: {
    label: 'MCP INVESTIGATION FAILED',
    detail: 'The evidence chain did not satisfy the v0.003 gate. ROOK is not promoting this attempt to an observed incident claim.',
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
      return `correlated MCP response · call ${event.callId}`
    case 'turn.completed':
      return `terminal ${event.status} · required actions ${event.requiredActionCount}`
    case 'error':
      return event.message
    case 'tool.returned':
      return `unexpected tool call ${event.callId}`
    case 'sandbox.started':
      return `unexpected sandbox ${event.sandboxId}`
    case 'sandbox.exec.called':
      return `sandbox exec · call ${event.callId}`
    case 'sandbox.exec.returned':
      return `correlated sandbox response · call ${event.callId}`
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

const formatInteger = (value: number): string => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)

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
          instruction: V003_PROOF_INSTRUCTION,
        })
      } finally {
        unsubscribe()
      }

      const terminal = [...turnEvents].reverse().find((event) => event.type === 'turn.completed')
      if (!terminal || terminal.type !== 'turn.completed') {
        throw new Error('No terminal TrueForge turn evidence was observed.')
      }
      if (!selectLatestObservedRetryPressure(turnEvents)) {
        throw new Error('No evidence-backed retry-pressure observation passed the owned demo projection gate.')
      }

      setStatus('observed')
    } catch (cause) {
      setStatus('failed')
      setError(cause instanceof Error ? cause.message : 'TrueForge MCP investigation failed.')
    }
  }

  const copy = statusCopy[status]
  const recentEvents = events.slice(-10)
  const retryPressure = selectLatestObservedRetryPressure(events)

  return (
    <section className={`harness-proof proof-${status}`} aria-labelledby="trueforge-proof-title">
      <header className="harness-proof-header">
        <div>
          <span className="harness-kicker">TRUEFORGE · v0.003 read-only incident evidence</span>
          <h2 id="trueforge-proof-title">Governed MCP investigation boundary</h2>
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
              <div><dt>MCP</dt><dd>rook-inventory-retry-storm · @read-only</dd></div>
              <div><dt>Authority</dt><dd>read-only MCP · no sandbox · no subagents · no mutation</dd></div>
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
            {status === 'connecting'
              ? 'Investigating through MCP…'
              : status === 'observed'
                ? 'Run a new read-only investigation'
                : 'Run read-only investigation'}
          </button>

          {error && <p className="harness-error" role="alert">{error}</p>}
        </div>

        <div className="harness-evidence" aria-live="polite">
          <div className="harness-evidence-heading">
            <span>Observed evidence chain</span>
            <small>{session ? `${events.length} retained event${events.length === 1 ? '' : 's'}` : 'no live session yet'}</small>
          </div>

          {retryPressure && (
            <article className="live-observation" aria-label="Observed read-only retry pressure">
              <div className="live-observation-title">
                <span>OBSERVED · OWNED DEMO MCP</span>
                <strong>Retry pressure</strong>
              </div>
              <div className="live-observation-metrics">
                <div><span>Retry multiplier</span><strong>{retryPressure.retryMultiplier.toFixed(1)}×</strong></div>
                <div><span>Attempts / min</span><strong>{formatInteger(retryPressure.attemptsPerMinute)}</strong></div>
                <div><span>Queue depth</span><strong>{formatInteger(retryPressure.sharedQueueDepth)}</strong></div>
                <div><span>Queue saturation</span><strong>{retryPressure.sharedQueueSaturationPct}%</strong></div>
              </div>
              <p>
                Source <code>{retryPressure.pressureSource}</code> · observed at source {retryPressure.sourceTimestamp}.
                Classification: <strong>owned-demo-non-production</strong>.
              </p>
              <small>
                call {retryPressure.callId} · call event {retryPressure.callSourceEventId} · response event {retryPressure.responseSourceEventId}
              </small>
            </article>
          )}

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
              <span>NO LIVE MCP EVIDENCE OBSERVED</span>
              <p>The surrounding Inventory Retry Storm workspace remains fixture data until a matching read-only MCP observation is retained and projected here.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
