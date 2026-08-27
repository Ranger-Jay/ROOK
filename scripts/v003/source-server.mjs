import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import {
  INVENTORY_RETRY_STORM_SERVICES,
  createInventoryRetryStormDemoSource,
} from './incident-source.mjs'

const DEFAULT_PORT = 8792
const LOOPBACK_HOST = '127.0.0.1'

const parsePort = (value, fallback) => {
  if (value == null || value === '') return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1024 || parsed > 65535) {
    throw new Error(`Invalid ROOK demo source port: ${String(value)}`)
  }
  return parsed
}

const writeJson = (res, status, body) => {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
  })
  res.end(payload)
}

const hostAllowed = (hostHeader, port) => {
  const allowed = new Set([`${LOOPBACK_HOST}:${port}`, `localhost:${port}`])
  return typeof hostHeader === 'string' && allowed.has(hostHeader.toLowerCase())
}

export function createOwnedDemoSourceHttpServer({
  port = DEFAULT_PORT,
  source = createInventoryRetryStormDemoSource(),
} = {}) {
  return createServer((req, res) => {
    if (!hostAllowed(req.headers.host, port)) {
      writeJson(res, 403, { error: 'Host header refused by loopback-only ROOK demo source.' })
      return
    }

    if (req.method !== 'GET') {
      writeJson(res, 405, { error: 'Owned demo source is read-only; only GET is accepted.' })
      return
    }

    const url = new URL(req.url ?? '/', `http://${LOOPBACK_HOST}:${port}`)

    try {
      if (url.pathname === '/healthz') {
        writeJson(res, 200, {
          status: 'ok',
          boundary: 'rook-owned-demo-source',
          classification: 'owned-demo-non-production',
          services: INVENTORY_RETRY_STORM_SERVICES,
        })
        return
      }

      if (url.pathname === '/v1/service-health') {
        writeJson(res, 200, source.getServiceHealth(url.searchParams.get('service') ?? 'inventory-api'))
        return
      }

      if (url.pathname === '/v1/retry-pressure') {
        writeJson(res, 200, source.getRetryPressure())
        return
      }

      if (url.pathname === '/v1/deployment-history') {
        writeJson(res, 200, source.getDeploymentHistory())
        return
      }

      if (url.pathname === '/v1/dependency-topology') {
        writeJson(res, 200, source.getDependencyTopology())
        return
      }

      writeJson(res, 404, { error: 'Unknown ROOK owned demo source endpoint.' })
    } catch (error) {
      writeJson(res, 400, { error: error instanceof Error ? error.message : 'Owned demo source request failed.' })
    }
  })
}

export async function startOwnedDemoSourceServer({
  port = parsePort(process.env.ROOK_DEMO_SOURCE_PORT, DEFAULT_PORT),
  source,
} = {}) {
  const server = createOwnedDemoSourceHttpServer({ port, source })
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen)
    server.listen(port, LOOPBACK_HOST, () => resolveListen())
  })
  return { server, port, url: `http://${LOOPBACK_HOST}:${port}` }
}

const isDirectExecution = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])

if (isDirectExecution) {
  const started = await startOwnedDemoSourceServer()
  console.error(`[rook:v0.003] owned demo source listening at ${started.url}`)
}
