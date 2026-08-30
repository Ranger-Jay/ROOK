import { useMemo, useState } from 'react'
import type { HarnessEvent, IncidentSession } from './adapter'
import { selectLatestObservedRetryPressure } from './liveIncidentEvidence'
import { createHarnessAdapter, resolveHarnessRuntimeConfiguration } from './runtime'
import { selectLatestReproducedRetryPressure } from './sandboxReproductionEvidence'
import './trueforge-proof.css'
import './v004-proof.css'

export type ProofStatus = 'unconfigured' | 'idle' | 'connecting' | 'reproduced' | 'failed'

const incident = {
  incidentId: 'INC-2048',
  title: 'Inventory Retry Storm',
  objective: 'Observe retry pressure from the owned non-production demo source, then reproduce the arithmetic in an isolated TrueForge sandbox without incident mutation.',
} as const

export const V004_PROOF_INSTRUCTION = 'Run the split-authority v0.004 observation and bounded sandbox reproduction proof.'

const statusCopy: Record<ProofStatus, { label: string; detail: string }> = {
  unconfigured: {
    label: 'V0.004 CLIENT NOT CONFIGURED',
    detail: 'The local TrueForge origin/model are unavailable. No live observation or sandbox reproduction claim can be promoted.',
  },
  idle: {
    label: 'V0.004 CLIENT READY',
    detail: 'ROOK will use separate least-authority TrueForge sessions: read-only MCP observation first, then — only after that evidence passes — a sandbox-only reproduction session.',
  },
  connecting: {
    label: 'RUNNING SPLIT-AUTHORITY PROOF',
    detail: 'Waiting for one OBSERVED read-only MCP turn, the evidence gate, then one separate sandbox-only TrueForge turn with sandbox.created → exact exec → matching response.',
  },
  reproduced: {
    label: 'OBSERVED + REPRODUCED EVIDENCE',
    detail: 'ROOK retained the owned-demo observation and a separate bounded TrueForge sandbox reproduction. The observer could not execute; the reproducer could not access the incident source.',
  },
  failed: {
    label: 'V0.004 EVIDENCE GATE FAILED',
    detail: 'The retained chain did not satisfy the split-authority observation-plus-reproduction contract. ROOK is not promoting this attempt as reproduced evidence.',
  },
}

const eventDetail = (event: HarnessEvent): string => {
  switch (event.type) {
    case 'turn.started':
      return `session ${event.sessionId} · turn ${event.turnId}`
    case 'agent.message.delta':
      return event.text
    case 'mcp.tool.called':
      return `${event.serverName} · ${event.name} · call ${event.callId}`
    case 'mcp.tool.returned':
      return `correlated MCP response · call ${event.callId}`
    case 'turn.completed':
      return `session ${event.sessionId} · terminal ${event.status} · required actions ${event.requiredActionCount}`
    case 'error':
      return event.message
    case 'tool.returned':
      return `unexpected tool call ${event.callId}`
    case 'sandbox.started':
      return `sandbox created · ${event.sandboxId}`
    case 'sandbox.exec.called':
      return `bounded sandbox exec · call ${event.callId}`
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

export const shouldPromoteReproducedEvidence = (status: ProofStatus): boolean => status === 'reproduced'

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
          instruction: V004_PROOF_INSTRUCTION,
        })
      } finally {
        unsubscribe()
      }

      const terminals = turnEvents.filter((event) => event.type === 'turn.completed')
      if (terminals.length !== 2) {
        throw new Error(`Split-authority proof requires exactly two successful TrueForge terminal turns; observed ${terminals.length}.`)
      }
      const turnSessionIds = new Set(
        turnEvents
          .filter((event): event is Extract<HarnessEvent, { type: 'turn.started' }> => event.type === 'turn.started')
          .map((event) => event.sessionId),
      )
      if (turnSessionIds.size !== 2) {
        throw new Error(`Split-authority proof requires two distinct TrueForge session IDs; observed ${turnSessionIds.size}.`)
      }
      if (!selectLatestObservedRetryPressure(turnEvents)) {
        throw new Error('No evidence-backed retry-pressure OBSERVED claim passed the owned-demo projection gate.')
      }
      if (!selectLatestReproducedRetryPressure(turnEvents)) {
        throw new Error('No evidence-backed REPRODUCED sandbox claim passed the v0.004 projection gate.')
      }

      setStatus('reproduced')
    } catch (cause) {
      setStatus('failed')
      setError(cause instanceof Error ? cause.message : 'TrueForge v0.004 sandbox reproduction failed.')
    }
  }

  const copy = statusCopy[status]
  const recentEvents = events.slice(-14)
  const retryPressure = selectLatestObservedRetryPressure(events)
  const reproduction = shouldPromoteReproducedEvidence(status)
    ? selectLatestReproducedRetryPressure(events)
    : null
  const reproductionSessionId = events.find((event) => event.type === 'sandbox.exec.called')?.sessionId
    ?? events
      .filter((event): event is Extract<HarnessEvent, { type: 'turn.started' }> => event.type === 'turn.started')
      .map((event) => event.sessionId)
      .find((sessionId) => sessionId !== session?.sessionId)

  return (
    <section className={`harness-proof proof-${status}`} aria-labelledby="trueforge-proof-title">
      <header className="harness-proof-header">
        <div>
          <span className="harness-kicker">TRUEFORGE · v0.004 observed + sandbox reproduction evidence</span>
          <h2 id="trueforge-proof-title">Governed observation → reproduction boundary</h2>
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
              <div><dt>Observe</dt><dd>read-only MCP session · rook-inventory-retry-storm · sandbox off</dd></div>
              <div><dt>Reproduce</dt><dd>sandbox-only TrueForge session · no MCP · file downloads disabled</dd></div>
              <div><dt>Authority</dt><dd>split authority · validate before handoff · no incident mutation</dd></div>
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
              ? 'Running split-authority proof…'
              : status === 'reproduced'
                ? 'Run a new bounded reproduction'
                : 'Run bounded sandbox reproduction'}
          </button>

          {error && <p className="harness-error" role="alert">{error}</p>}
        </div>

        <div className="harness-evidence" aria-live="polite">
          <div className="harness-evidence-heading">
            <span>Evidence chain · OBSERVED → REPRODUCED</span>
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

          {reproduction && (
            <article className="sandbox-reproduction" aria-label="Reproduced retry pressure in TrueForge sandbox">
              <div className="sandbox-reproduction-title">
                <span>REPRODUCED · TRUEFORGE SANDBOX</span>
                <strong>Retry-pressure arithmetic</strong>
              </div>
              <div className="sandbox-reproduction-metrics">
                <div><span>Retry multiplier</span><strong>{reproduction.retryMultiplier.toFixed(1)}×</strong></div>
                <div><span>Attempts / min</span><strong>{formatInteger(reproduction.attemptsPerMinute)}</strong></div>
                <div><span>Queue depth</span><strong>{formatInteger(reproduction.queueDepth)}</strong></div>
                <div><span>Queue saturation</span><strong>{reproduction.queueSaturationPct}%</strong></div>
              </div>
              <p>
                Sandbox <code>{reproduction.sandboxId}</code> returned the exact deterministic reproduction payload.
                This is <strong>not</strong> applied remediation and <strong>not</strong> verified recovery.
              </p>
              <small>
                call {reproduction.callId} · call event {reproduction.callSourceEventId} · sandbox event {reproduction.sandboxSourceEventId} · response event {reproduction.responseSourceEventId}
              </small>
            </article>
          )}

          {session ? (
            <>
              <div className="session-observation">
                <span>OBSERVATION SESSION RESPONSE</span>
                <strong>{session.sessionId}</strong>
                <small>{session.observation.source} · read-only MCP · sandbox disabled · observed {session.observation.observedAt}</small>
              </div>
              {reproductionSessionId && (
                <div className="session-observation">
                  <span>REPRODUCTION SESSION</span>
                  <strong>{reproductionSessionId}</strong>
                  <small>created only after the OBSERVED gate · sandbox enabled · no MCP connector</small>
                </div>
              )}
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
              <span>NO LIVE V0.004 EVIDENCE RETAINED</span>
              <p>The incident workspace remains fixture-only until a matching read-only MCP observation and bounded TrueForge sandbox reproduction are both retained.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
