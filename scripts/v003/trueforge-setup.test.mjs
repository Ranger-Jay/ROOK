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

const fakeClient = ({ listed = [], created = exactConfigured() } = {}) => {
  const calls = { create: [] }

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
        },
      },
    },
  }
}

describe('ROOK v0.003 TrueForge connector setup', () => {
  it('creates the exact no-auth local connector only when it is absent', async () => {
    const { client, calls } = fakeClient()

    const result = await ensureV003TrueForgeConnector({ client })

    expect(result).toMatchObject({
      disposition: 'created',
      trueForgeUrl: 'http://localhost:8790',
      connector: ROOK_V003_TRUEFORGE_MCP_MANIFEST.name,
      mcpUrl: 'http://127.0.0.1:8791/mcp',
    })
    expect(calls.create).toEqual([{
      manifest: { ...ROOK_V003_TRUEFORGE_MCP_MANIFEST },
    }])
  })

  it('reuses an exact existing connector without mutating TrueForge settings', async () => {
    const { client, calls } = fakeClient({ listed: [exactConfigured()] })

    const result = await ensureV003TrueForgeConnector({ client })

    expect(result.disposition).toBe('reused')
    expect(calls.create).toEqual([])
  })

  it('does not depend on the unavailable TrueForge 0.1.3 connector-tools settings route', async () => {
    const { client } = fakeClient({ listed: [exactConfigured()] })

    await expect(ensureV003TrueForgeConnector({ client })).resolves.toMatchObject({
      disposition: 'reused',
      connector: ROOK_V003_TRUEFORGE_MCP_MANIFEST.name,
    })
  })

  it('fails closed instead of overwriting a mismatched existing connector', async () => {
    const mismatched = exactConfigured()
    mismatched.manifest.url = 'http://127.0.0.1:9999/mcp'
    const { client, calls } = fakeClient({ listed: [mismatched] })

    await expect(ensureV003TrueForgeConnector({ client })).rejects.toThrow(/refusing to overwrite/i)
    expect(calls.create).toEqual([])
  })

  it('rejects an otherwise-valid connector manifest with any extra field', async () => {
    const expanded = exactConfigured()
    expanded.manifest.transportOptions = { experimental: true }
    const { client, calls } = fakeClient({ listed: [expanded] })

    await expect(ensureV003TrueForgeConnector({ client })).rejects.toThrow(/does not exactly match/i)
    expect(calls.create).toEqual([])
  })

  it('refuses non-loopback, credential-bearing, wrong-port, and path-bearing TrueForge URLs', () => {
    expect(assertLocalTrueForgeUrl()).toBe('http://localhost:8790')
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
