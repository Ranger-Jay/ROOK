import TrueForgeProof from './harness/TrueForgeProof'

const nav = ['Overview', 'Incidents', 'Topology', 'Agents', 'Sandboxes', 'Approvals', 'Audit trail']

const metrics = [
  { label: 'Retry rate', value: '8.6×', detail: 'baseline 1.0×', tone: 'critical' },
  { label: 'Queue depth', value: '42.8k', detail: '+612%', tone: 'warning' },
  { label: 'Checkout p95', value: '4.82s', detail: 'target < 1.2s', tone: 'critical' },
  { label: 'Error rate', value: '12.4%', detail: 'target < 1%', tone: 'critical' },
] as const

const agents = [
  { initial: 'S', name: 'Sentinel', task: 'Telemetry and log evidence', status: 'Evidence found', tone: 'cyan' },
  { initial: 'T', name: 'Tracer', task: 'Dependency propagation', status: 'Complete', tone: 'cyan' },
  { initial: 'F', name: 'Forensic', task: 'Recent-change analysis', status: 'Investigating', tone: 'violet' },
  { initial: 'G', name: 'Forge', task: 'Sandbox reproduction', status: 'Queued', tone: 'muted' },
] as const

const stages = ['Detect', 'Investigate', 'Delegate', 'Sandbox', 'Propose', 'Approve', 'Execute', 'Verify', 'Audit']

function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <g fill="var(--rook-cyan)">
        <path d="M12 8H28V16H21L16 21V28H8V12L12 8Z" />
        <path d="M36 8H52L56 12V28H48V21L43 16H36V8Z" />
        <path d="M56 36V52L52 56H36V48H43L48 43V36H56Z" />
        <path d="M28 56H12L8 52V36H16V43L21 48H28V56Z" />
      </g>
      <path d="M28 23H36L41 28V36L36 41H28L23 36V28L28 23Z" fill="var(--rook-violet)" />
    </svg>
  )
}

function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-row">
          <BrandMark />
          <div>
            <strong>ROOK</strong>
            <span>Incident command</span>
          </div>
        </div>

        <nav aria-label="ROOK navigation">
          <span className="nav-label">Command</span>
          {nav.map((item, index) => (
            <button className={index === 1 ? 'nav-item active' : 'nav-item'} type="button" key={item}>
              <span>{item}</span>
              {index === 1 && <i aria-hidden="true" />}
            </button>
          ))}
        </nav>

        <div className="sidebar-spacer" />
        <div className="sidebar-status">
          <span>TRUEFORGE · v0.003</span>
          <strong>Governed read-only MCP boundary</strong>
          <small>Live owned-demo observations are promoted only from correlated MCP evidence. All other incident fields remain fixture data.</small>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div>
            <span className="crumb">Incidents / INC-2048</span>
          </div>
          <div className="topbar-state">
            <span className="fixture-pill">FIXTURE INCIDENT DATA · v0.003-dev</span>
            <span className="operator">JAY · ADMIN</span>
          </div>
        </header>

        <div className="content">
          <section className="incident-heading">
            <div>
              <span className="eyebrow">Fixture workspace · explicit live-evidence inserts</span>
              <h1>Inventory Retry Storm</h1>
              <p>This owned scenario remains fixture data except where ROOK explicitly marks an observation as evidence-backed from the running non-production demo source through TrueForge and read-only MCP.</p>
            </div>
            <div className="elapsed">
              <span>Fixture incident time</span>
              <strong>00:18:42</strong>
            </div>
          </section>

          <TrueForgeProof />

          <section className="fault-card" aria-label="Fixture active fault summary">
            <div className="fault-title">
              <span className="status-dot" />
              <strong>SEV-1 · Fixture fault source: inventory-reservation</strong>
              <span className="confidence">FIXTURE CONFIDENCE · 91%</span>
            </div>
            <p>Fixture evidence models aggressive retry behavior creating queue and cache pressure, increasing checkout latency and failures.</p>
            <div className="metric-grid">
              {metrics.map((metric) => (
                <article className={`metric metric-${metric.tone}`} key={metric.label}>
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                  <small>{metric.detail}</small>
                </article>
              ))}
            </div>
          </section>

          <section className="command-grid">
            <article className="panel topology-panel">
              <header><span>Blast-radius topology</span><small>FIXTURE · 5 services · 4 paths</small></header>
              <div className="topology" role="img" aria-label="Fixture dependency graph from inventory-reservation through queue and cache pressure to checkout">
                <span className="edge edge-a" /><span className="edge edge-b" /><span className="edge edge-c" />
                <div className="node node-source"><b>IR</b><small>inventory</small></div>
                <div className="node node-warning"><b>Q</b><small>queue</small></div>
                <div className="node node-warning node-cache"><b>C</b><small>cache</small></div>
                <div className="node node-critical"><b>CO</b><small>checkout</small></div>
                <div className="node node-healthy"><b>P</b><small>payment</small></div>
              </div>
              <div className="legend"><span><i className="source" /> source</span><span><i className="warn" /> saturated</span><span><i className="crit" /> degraded</span><span><i className="healthy" /> healthy</span></div>
            </article>

            <article className="panel agents-panel">
              <header><span>Delegated investigators</span><small>FIXTURE · future workflow</small></header>
              <div className="agent-list">
                {agents.map((agent) => (
                  <div className="agent" key={agent.name}>
                    <span className={`agent-icon tone-${agent.tone}`}>{agent.initial}</span>
                    <div><strong>{agent.name}</strong><small>{agent.task}</small></div>
                    <span className={`agent-status tone-${agent.tone}`}>{agent.status}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="panel sandbox-panel">
              <header><span>Sandbox boundary</span><small>DESIGN · v0.004</small></header>
              <div className="sandbox-box">
                <span>TRUEFORGE SANDBOX</span>
                <strong>Not enabled in v0.003</strong>
                <p>Agent-written diagnostics remain a future milestone.</p>
              </div>
              <div className="production-lock">
                <span>PRODUCTION · LOCKED</span>
                <strong>Human authorization required</strong>
                <small>No mutation path is enabled in this milestone.</small>
              </div>
            </article>
          </section>

          <section className="panel progression-panel">
            <header><span>Incident progression</span><small>FIXTURE · current investigate</small></header>
            <ol className="progression">
              {stages.map((stage, index) => (
                <li className={index === 0 ? 'done' : index === 1 ? 'current' : index === 5 ? 'authority' : ''} key={stage}>
                  <span>{index + 1}</span><small>{stage}</small>
                </li>
              ))}
            </ol>
          </section>

          <section className="safety-note">
            <div className="safety-rule"><span>SAFETY LAW</span><strong>Observed ≠ inferred.</strong></div>
            <p>ROOK may investigate this owned demo through positively classified read-only MCP tools. It cannot use sandbox, subagents, approvals, or mutation authority in v0.003, and a causal conclusion remains inferred unless its retained evidence chain is shown.</p>
          </section>
        </div>
      </main>
    </div>
  )
}

export default App
