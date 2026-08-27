import { describe, expect, it } from 'vitest'
import {
  ROOK_V003_TRUEFORGE_MCP_MANIFEST,
  assertLocalTrueForgeUrl,
  ensureV003TrueForgeConnector,
} from './trueforge-setup.mjs'

const exactConfigured = () => ({
  name: ROOK_V003_TRUEFORGE_MCP_MANIFEST.name,
  manifest: { ...ROOK_V003_TRUEFORGE_MCP_MANIFEST },
  authStatus: { status: 'not_required' },
})

const exactTools = () => [
  'get_service_health',
  'get_retry_pressure',
  'get_deployment_history',
  'get_dependency_topology',
].map((name) => ({
  name,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
}))

const fakeClient = ({ listed = [], created = exactConfigured(), tools = exactTools() } = {}) => {
  const calls = {
    create: [],
    listTools: [],
  }

  return {
    calls,
    client: {
      settings: {
        mcpServers: {
          list: async () => ({ data: listed }),
          create: async (request) => {
            calls.create.push(request)
            return { data: created }
          },
          listTools: async (name) => {
            calls.listTools.push(name)
            return { data: tools }
          },
        },
      },
    },
  }
}

describe('ROOK v0.003 TrueForge connector setup', () => {
  it('creates the exact no-auth local connector only when it is absent', async () => {
    const { client, calls } = fakeClient()

    const result = await ensureV003TrueForgeConnector({ client })

    expect(result.disposition).toBe('created')
    expect(calls.create).toEqual([{
      manifest: { ...ROOK_V003_TRUEFORGE_MCP_MANIFEST },
    }])
    expect(calls.listTools).toEqual([ROOK_V003_TRUEFORGE_MCP_MANIFEST.name])
    expect(result.tools).toEqual([
      'get_service_health',
      'get_retry_pressure',
      'get_deployment_history',
      'get_dependency_topology',
    ])
  })

  it('reuses an exact existing connector without mutating TrueForge settings', async () => {
    const { client, calls } = fakeClient({ listed: [exactConfigured()] })

    const result = await ensureV003TrueForgeConnector({ client })

    expect(result.disposition).toBe('reused')
    expect(calls.create).toEqual([])
    expect(calls.listTools).toEqual([ROOK_V003_TRUEFORGE_MCP_MANIFEST.name])
  })

  it('fails closed instead of overwriting a mismatched existing connector', async () => {
    const mismatched = exactConfigured()
    mismatched.manifest.url = 'http://127.0.0.1:9999/mcp'
    const { client, calls } = fakeClient({ listed: [mismatched] })

    await expect(ensureV003TrueForgeConnector({ client })).rejects.toThrow(/refusing to overwrite/i)
    expect(calls.create).toEqual([])
    expect(calls.listTools).toEqual([])
  })

  it('fails closed when TrueForge does not retain the positive read-only tool annotations', async () => {
    const tools = exactTools()
    tools[1].annotations.readOnlyHint = false
    const { client } = fakeClient({ listed: [exactConfigured()], tools })

    await expect(ensureV003TrueForgeConnector({ client })).rejects.toThrow(/positive read-only annotation contract/i)
  })

  it('refuses non-loopback, credential-bearing, wrong-port, and path-bearing TrueForge URLs', () => {
    expect(assertLocalTrueForgeUrl('http://localhost:8790')).toBe('http://localhost:8790')
    expect(assertLocalTrueForgeUrl('http://127.0.0.1:8790')).toBe('http://127.0.0.1:8790')

    for (const candidate of [
      'https://127.0.0.1:8790',
      'http://example.com:8790',
      'http://127.0.0.1:8791',
      'http://user:pass@127.0.0.1:8790',
      'http://127.0.0.1:8790/api',
      'http://127.0.0.1:8790/?x=1',
    ]) {
      expect(() => assertLocalTrueForgeUrl(candidate)).toThrow(/credential-free HTTP/i)
    }
  })
})
