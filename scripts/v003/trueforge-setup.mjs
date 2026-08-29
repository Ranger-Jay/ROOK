import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { TrueForge } from '@truefoundry/trueforge-sdk'

const DEFAULT_TRUEFORGE_URL = 'http://localhost:8790'
const ROOK_MCP_URL = 'http://127.0.0.1:8791/mcp'

export const ROOK_V003_TRUEFORGE_MCP_MANIFEST = Object.freeze({
  type: 'remote',
  name: 'rook-inventory-retry-storm',
  url: ROOK_MCP_URL,
  description: 'ROOK owned non-production read-only Inventory Retry Storm evidence source',
})

const EXACT_MANIFEST_KEYS = Object.freeze(Object.keys(ROOK_V003_TRUEFORGE_MCP_MANIFEST).sort())

export function assertLocalTrueForgeUrl(candidate = DEFAULT_TRUEFORGE_URL) {
  let parsed
  try {
    parsed = new URL(candidate)
  } catch {
    throw new Error('ROOK v0.003 TrueForge URL must be a valid local HTTP origin.')
  }

  if (
    parsed.protocol !== 'http:'
    || !['127.0.0.1', 'localhost'].includes(parsed.hostname)
    || parsed.port !== '8790'
    || parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash
    || (parsed.pathname !== '/' && parsed.pathname !== '')
  ) {
    throw new Error('ROOK v0.003 TrueForge URL must be credential-free HTTP on localhost/127.0.0.1 port 8790.')
  }

  return parsed.origin
}

const hasExactManifestKeys = (manifest) => {
  const keys = Object.keys(manifest).sort()
  return keys.length === EXACT_MANIFEST_KEYS.length
    && keys.every((key, index) => key === EXACT_MANIFEST_KEYS[index])
}

const assertConfiguredConnector = (configured) => {
  if (!configured || typeof configured !== 'object') {
    throw new Error('TrueForge returned no configured ROOK MCP connector.')
  }

  const manifest = configured.manifest
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error('TrueForge ROOK MCP connector omitted its manifest.')
  }

  if (
    !hasExactManifestKeys(manifest)
    || configured.name !== ROOK_V003_TRUEFORGE_MCP_MANIFEST.name
    || manifest.type !== ROOK_V003_TRUEFORGE_MCP_MANIFEST.type
    || manifest.name !== ROOK_V003_TRUEFORGE_MCP_MANIFEST.name
    || manifest.url !== ROOK_V003_TRUEFORGE_MCP_MANIFEST.url
    || manifest.description !== ROOK_V003_TRUEFORGE_MCP_MANIFEST.description
    || configured.authStatus?.status !== 'not_required'
  ) {
    throw new Error(
      'Existing TrueForge connector named rook-inventory-retry-storm does not exactly match the v0.003 no-auth local contract; refusing to overwrite it.',
    )
  }
}

export async function ensureV003TrueForgeConnector({
  baseUrl = process.env.ROOK_TRUEFORGE_URL ?? DEFAULT_TRUEFORGE_URL,
  client,
} = {}) {
  const localBaseUrl = assertLocalTrueForgeUrl(baseUrl)
  const trueForge = client ?? new TrueForge({
    baseUrl: localBaseUrl,
    timeoutInSeconds: 15,
  })

  const listed = await trueForge.settings.mcpServers.list()
  if (!Array.isArray(listed?.data)) throw new Error('TrueForge returned an invalid configured MCP server list.')

  const matches = listed.data.filter((entry) => entry?.name === ROOK_V003_TRUEFORGE_MCP_MANIFEST.name)
  if (matches.length > 1) {
    throw new Error('TrueForge returned duplicate configured entries for the ROOK v0.003 MCP connector.')
  }

  let configured = matches[0]
  let disposition = 'reused'

  if (!configured) {
    const created = await trueForge.settings.mcpServers.create({
      manifest: { ...ROOK_V003_TRUEFORGE_MCP_MANIFEST },
    })
    configured = created?.data
    disposition = 'created'
  }

  assertConfiguredConnector(configured)

  return {
    disposition,
    trueForgeUrl: localBaseUrl,
    connector: ROOK_V003_TRUEFORGE_MCP_MANIFEST.name,
    mcpUrl: ROOK_V003_TRUEFORGE_MCP_MANIFEST.url,
  }
}

const isDirectExecution = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])

if (isDirectExecution) {
  try {
    const result = await ensureV003TrueForgeConnector()
    console.error(`[rook:v0.003] TrueForge connector ${result.disposition}: ${result.connector}`)
    console.error(`[rook:v0.003] TrueForge: ${result.trueForgeUrl}`)
    console.error(`[rook:v0.003] MCP URL: ${result.mcpUrl}`)
    console.error('[rook:v0.003] connector manifest/no-auth preflight passed')
    console.error('[rook:v0.003] tool inventory is verified by demo:stack and the authentic TrueForge turn; TrueForge 0.1.3 does not expose a connector-tools settings route')
  } catch (error) {
    console.error('[rook:v0.003] TrueForge connector preflight failed:', error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
