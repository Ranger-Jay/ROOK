import { describe, expect, it } from 'vitest'
import { assertV003ProofStackHealth, startV003ProofStack } from './proof-stack.mjs'

const SOURCE_PORT = 18792
const MCP_PORT = 18791

describe('ROOK v0.003 proof stack', () => {
  it('starts both loopback boundaries, verifies truth/tool health, and shuts down cleanly', async () => {
    const stack = await startV003ProofStack({
      sourcePort: SOURCE_PORT,
      mcpPort: MCP_PORT,
    })

    try {
      expect(stack.source.url).toBe(`http://127.0.0.1:${SOURCE_PORT}`)
      expect(stack.mcp.url).toBe(`http://127.0.0.1:${MCP_PORT}/mcp`)
      expect(stack.source.server.listening).toBe(true)
      expect(stack.mcp.server.listening).toBe(true)

      const health = await assertV003ProofStackHealth(stack)
      expect(health.source).toMatchObject({
        status: 'ok',
        boundary: 'rook-owned-demo-source',
        classification: 'owned-demo-non-production',
      })
      expect(health.mcp).toEqual({
        status: 'ok',
        boundary: 'rook-owned-read-only-mcp',
        tools: [
          'get_service_health',
          'get_retry_pressure',
          'get_deployment_history',
          'get_dependency_topology',
        ],
      })
      expect(health.retryPressureSource).toMatchObject({
        system: 'rook-owned-demo-source',
        scenarioId: 'inventory-retry-storm-v1',
        classification: 'owned-demo-non-production',
        kind: 'retry-pressure',
      })
    } finally {
      await stack.close()
    }

    expect(stack.source.server.listening).toBe(false)
    expect(stack.mcp.server.listening).toBe(false)
  })
})
