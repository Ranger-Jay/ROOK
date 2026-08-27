import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import * as z from 'zod/v4'

const DEFAULT_MCP_PORT = 8791
const DEFAULT_SOURCE_URL = 'http://127.0.0.1:8792'
const LOOPBACK_HOST = '127.0.0.1'

export const ROOK_V003_READ_ONLY_ANNOTATIONS = Object.freeze({
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
})

const noInput = z.object({})

export const ROOK_V003_MCP_TOOL_SPECS = Object.freeze([
  Object.freeze({
    name: 'get_service_health',
    description: 'Observe owned demo service health, error rate, p95 latency, saturation, source timestamp, and observation window.',
    kind: 'service-health',
    inputSchema: z.object({
      service: z.enum(['inventory-api', 'checkout-api', 'fulfillment-worker']).default('inventory-api'),
    }),
    sourcePath: ({ service }) => `/v1/service-health?service=${encodeURIComponent(service)}`,
    annotations: ROOK_V003_READ_ONLY_ANNOTATIONS,
  }),
  Object.freeze({
    name: 'get_retry_pressure',
    description: 'Observe owned demo retry attempts, queue depth, saturation, and source timing without changing state.',
    kind: 'retry-pressure',
    inputSchema: noInput,
    sourcePath: () => '/v1/retry-pressure',
    annotations: ROOK_V003_READ_ONLY_ANNOTATIONS,
  }),
  Object.freeze({
    name: 'get_deployment_history',
    description: 'Observe recent owned demo deployment and retry/backoff configuration evidence without changing state.',
    kind: 'deployment-history',
    inputSchema: noInput,
    sourcePath: () => '/v1/deployment-history',
    annotations: ROOK_V003_READ_ONLY_ANNOTATIONS,
  }),
  Object.freeze({
    name: 'get_dependency_topology',
    description: 'Observe owned demo service, queue, cache, and dependency edges used for blast-radius inference.',
    kind: 'dependency-topology',
    inputSchema: noInput,
    sourcePath: () => '/v1/dependency-topology',
    annotations: ROOK_V003_READ_ONLY_ANNOTATIONS,
  }),
])

const parsePort = (value, fallback) => {
  if (value == null || value === '') return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1024 || parsed > 65535) {
    throw new Error(`Invalid ROOK MCP port: ${String(value)}`)
  }
  return parsed
}

export function assertOwnedDemoSourceUrl(candidate) {
  let parsed
  try {
    parsed = new URL(candidate)
  } catch {
    throw new Error('ROOK_DEMO_SOURCE_URL must be a valid loopback HTTP origin.')
  }

  if (parsed.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(parsed.hostname)) {
    throw new Error('ROOK_DEMO_SOURCE_URL must use HTTP on localhost or 127.0.0.1.')
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash || (parsed.pathname !== '/' && parsed.pathname !== '')) {
    throw new Error('ROOK_DEMO_SOURCE_URL must be a credential-free loopback origin without path, query, or fragment.')
  }

  return parsed.origin
}

const assertEvidenceEnvelope = (payload, expectedKind) => {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new Error(`Owned demo source returned non-object evidence for ${expectedKind}.`)
  }
  const source = payload.source
  if (typeof source !== 'object' || source === null || Array.isArray(source)) {
    throw new Error(`Owned demo source omitted provenance for ${expectedKind}.`)
  }
  if (source.system !== 'rook-owned-demo-source' || source.scenarioId !== 'inventory-retry-storm-v1' || source.kind !== expectedKind) {
    throw new Error(`Owned demo source provenance mismatch for ${expectedKind}.`)
  }
  if (typeof source.sourceTimestamp !== 'string' || !source.sourceTimestamp.trim()) {
    throw new Error(`Owned demo source omitted sourceTimestamp for ${expectedKind}.`)
  }
  if (typeof source.observationWindow !== 'object' || source.observationWindow === null) {
    throw new Error(`Owned demo source omitted observationWindow for ${expectedKind}.`)
  }
  if (!Object.prototype.hasOwnProperty.call(payload, 'data')) {
    throw new Error(`Owned demo source omitted data for ${expectedKind}.`)
  }
  return payload
}

export function createOwnedDemoEvidenceReader({
  sourceBaseUrl = DEFAULT_SOURCE_URL,
  fetchImpl = globalThis.fetch,
} = {}) {
  const origin = assertOwnedDemoSourceUrl(sourceBaseUrl)
  if (typeof fetchImpl !== 'function') throw new Error('A fetch implementation is required for the owned demo source boundary.')

  return async (path, expectedKind) => {
    const response = await fetchImpl(new URL(path, `${origin}/`), {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(3000),
    })
    if (!response.ok) {
      throw new Error(`Owned demo source returned HTTP ${response.status} for ${expectedKind}.`)
    }
    return assertEvidenceEnvelope(await response.json(), expectedKind)
  }
}

const toolResultFor = (evidence) => ({
  content: [{ type: 'text', text: JSON.stringify(evidence) }],
  structuredContent: evidence,
})

export function buildOwnedReadOnlyMcpServer({ sourceBaseUrl = DEFAULT_SOURCE_URL, fetchImpl = globalThis.fetch } = {}) {
  const readEvidence = createOwnedDemoEvidenceReader({ sourceBaseUrl, fetchImpl })
  const server = new McpServer({ name: 'rook-inventory-retry-storm', version: '0.3.0' })

  for (const spec of ROOK_V003_MCP_TOOL_SPECS) {
    server.registerTool(
      spec.name,
      {
        description: spec.description,
        inputSchema: spec.inputSchema,
        annotations: spec.annotations,
      },
      async (args) => toolResultFor(await readEvidence(spec.sourcePath(args), spec.kind)),
    )
  }

  return server
}

const methodNotAllowed = (res) => {
  res.status(405).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Method not allowed on stateless ROOK MCP endpoint.' },
    id: null,
  })
}

export function createOwnedReadOnlyMcpApp({ sourceBaseUrl = DEFAULT_SOURCE_URL, fetchImpl = globalThis.fetch } = {}) {
  const app = createMcpExpressApp({ host: LOOPBACK_HOST })

  app.get('/healthz', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      boundary: 'rook-owned-read-only-mcp',
      tools: ROOK_V003_MCP_TOOL_SPECS.map(({ name }) => name),
    })
  })

  app.post('/mcp', async (req, res) => {
    const server = buildOwnedReadOnlyMcpServer({ sourceBaseUrl, fetchImpl })
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })

    try {
      await server.connect(transport)
      await transport.handleRequest(req, res, req.body)
    } catch (error) {
      console.error('[rook:v0.003] MCP request failed:', error)
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal ROOK MCP server error.' },
          id: null,
        })
      }
    } finally {
      await transport.close().catch(() => undefined)
      await server.close().catch(() => undefined)
    }
  })

  app.get('/mcp', (_req, res) => methodNotAllowed(res))
  app.delete('/mcp', (_req, res) => methodNotAllowed(res))

  return app
}

export async function startOwnedReadOnlyMcpServer({
  port = parsePort(process.env.ROOK_MCP_PORT, DEFAULT_MCP_PORT),
  sourceBaseUrl = process.env.ROOK_DEMO_SOURCE_URL ?? DEFAULT_SOURCE_URL,
} = {}) {
  const app = createOwnedReadOnlyMcpApp({ sourceBaseUrl })
  const httpServer = await new Promise((resolveListen, rejectListen) => {
    const listening = app.listen(port, LOOPBACK_HOST)
    listening.once('error', rejectListen)
    listening.once('listening', () => resolveListen(listening))
  })
  return { server: httpServer, port, url: `http://${LOOPBACK_HOST}:${port}/mcp` }
}

const isDirectExecution = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])

if (isDirectExecution) {
  const started = await startOwnedReadOnlyMcpServer()
  console.error(`[rook:v0.003] read-only MCP server listening at ${started.url}`)
}
