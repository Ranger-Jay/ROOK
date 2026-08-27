import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { startOwnedReadOnlyMcpServer, ROOK_V003_MCP_TOOL_SPECS } from './mcp-server.mjs'
import { startOwnedDemoSourceServer } from './source-server.mjs'

const DEFAULT_SOURCE_PORT = 8792
const DEFAULT_MCP_PORT = 8791

const closeHttpServer = async (server) => {
  if (!server?.listening) return
  await new Promise((resolveClose, rejectClose) => {
    server.close((error) => error ? rejectClose(error) : resolveClose())
  })
}

const fetchJson = async (url, description, fetchImpl = globalThis.fetch) => {
  if (typeof fetchImpl !== 'function') throw new Error('A fetch implementation is required for ROOK proof-stack health checks.')
  const response = await fetchImpl(url, {
    method: 'GET',
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(3000),
  })
  if (!response.ok) throw new Error(`${description} returned HTTP ${response.status}.`)
  return response.json()
}

export async function assertV003ProofStackHealth(stack, { fetchImpl = globalThis.fetch } = {}) {
  const sourceHealth = await fetchJson(`${stack.source.url}/healthz`, 'ROOK owned demo source health check', fetchImpl)
  if (
    sourceHealth?.status !== 'ok'
    || sourceHealth?.boundary !== 'rook-owned-demo-source'
    || sourceHealth?.classification !== 'owned-demo-non-production'
  ) {
    throw new Error('ROOK owned demo source health response failed the v0.003 truth boundary.')
  }

  const mcpHealthUrl = new URL('/healthz', stack.mcp.url).toString()
  const mcpHealth = await fetchJson(mcpHealthUrl, 'ROOK read-only MCP health check', fetchImpl)
  const expectedTools = ROOK_V003_MCP_TOOL_SPECS.map(({ name }) => name)
  if (
    mcpHealth?.status !== 'ok'
    || mcpHealth?.boundary !== 'rook-owned-read-only-mcp'
    || !Array.isArray(mcpHealth?.tools)
    || mcpHealth.tools.length !== expectedTools.length
    || expectedTools.some((name, index) => mcpHealth.tools[index] !== name)
  ) {
    throw new Error('ROOK read-only MCP health response failed the v0.003 tool-boundary contract.')
  }

  const retryEvidence = await fetchJson(`${stack.source.url}/v1/retry-pressure`, 'ROOK retry-pressure source probe', fetchImpl)
  if (
    retryEvidence?.source?.system !== 'rook-owned-demo-source'
    || retryEvidence?.source?.scenarioId !== 'inventory-retry-storm-v1'
    || retryEvidence?.source?.classification !== 'owned-demo-non-production'
    || retryEvidence?.source?.kind !== 'retry-pressure'
  ) {
    throw new Error('ROOK retry-pressure source probe failed the v0.003 owned-demo evidence contract.')
  }

  return {
    source: sourceHealth,
    mcp: mcpHealth,
    retryPressureSource: retryEvidence.source,
  }
}

export async function startV003ProofStack({
  sourcePort = DEFAULT_SOURCE_PORT,
  mcpPort = DEFAULT_MCP_PORT,
  fetchImpl = globalThis.fetch,
} = {}) {
  const source = await startOwnedDemoSourceServer({ port: sourcePort })
  let mcp

  try {
    mcp = await startOwnedReadOnlyMcpServer({
      port: mcpPort,
      sourceBaseUrl: source.url,
    })
    const stack = {
      source,
      mcp,
      close: async () => {
        await closeHttpServer(mcp.server)
        await closeHttpServer(source.server)
      },
    }
    await assertV003ProofStackHealth(stack, { fetchImpl })
    return stack
  } catch (error) {
    await closeHttpServer(mcp?.server).catch(() => undefined)
    await closeHttpServer(source.server).catch(() => undefined)
    throw error
  }
}

const isDirectExecution = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])

if (isDirectExecution) {
  const stack = await startV003ProofStack()
  console.error('[rook:v0.003] proof stack ready')
  console.error(`[rook:v0.003] owned demo source: ${stack.source.url}`)
  console.error(`[rook:v0.003] read-only MCP: ${stack.mcp.url}`)
  console.error('[rook:v0.003] health/truth checks: passed')
  console.error('[rook:v0.003] keep this terminal open during the authentic TrueForge capture; press Ctrl+C to stop')

  let shuttingDown = false
  const shutdown = async (signal) => {
    if (shuttingDown) return
    shuttingDown = true
    console.error(`[rook:v0.003] ${signal} received; stopping proof stack`)
    try {
      await stack.close()
      process.exitCode = 0
    } catch (error) {
      console.error('[rook:v0.003] proof-stack shutdown failed:', error)
      process.exitCode = 1
    }
  }

  process.once('SIGINT', () => void shutdown('SIGINT'))
  process.once('SIGTERM', () => void shutdown('SIGTERM'))
}
