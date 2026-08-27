import { describe, expect, it } from 'vitest'
import {
  INVENTORY_RETRY_STORM_DEMO_SOURCE,
  createInventoryRetryStormDemoSource,
} from './incident-source.mjs'
import {
  ROOK_V003_MCP_TOOL_SPECS,
  ROOK_V003_READ_ONLY_ANNOTATIONS,
} from './mcp-server.mjs'

const FIXED_TIME = '2026-08-27T04:00:00.000Z'

describe('ROOK v0.003 owned read-only MCP boundary', () => {
  it('positively classifies every exposed tool as read-only and non-destructive', () => {
    expect(ROOK_V003_MCP_TOOL_SPECS.map(({ name }) => name)).toEqual([
      'get_service_health',
      'get_retry_pressure',
      'get_deployment_history',
      'get_dependency_topology',
    ])

    for (const spec of ROOK_V003_MCP_TOOL_SPECS) {
      expect(spec.annotations).toBe(ROOK_V003_READ_ONLY_ANNOTATIONS)
      expect(spec.annotations).toEqual({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      })
      expect(Object.isFrozen(spec.annotations)).toBe(true)
    }
  })

  it('serves all evidence reads without mutating the owned scenario state', () => {
    const source = createInventoryRetryStormDemoSource({ clock: () => FIXED_TIME })
    const before = source.snapshotForVerification()

    const observations = [
      source.getServiceHealth('inventory-api'),
      source.getServiceHealth('checkout-api'),
      source.getRetryPressure(),
      source.getDeploymentHistory(),
      source.getDependencyTopology(),
    ]

    expect(source.snapshotForVerification()).toEqual(before)

    for (const observation of observations) {
      expect(observation.source.system).toBe(INVENTORY_RETRY_STORM_DEMO_SOURCE.system)
      expect(observation.source.scenarioId).toBe(INVENTORY_RETRY_STORM_DEMO_SOURCE.scenarioId)
      expect(observation.source.sourceTimestamp).toBe(FIXED_TIME)
      expect(observation.source.observationWindow).toEqual({
        start: '2026-08-27T03:55:00.000Z',
        end: FIXED_TIME,
      })
    }
  })

  it('returns detached evidence copies so callers cannot mutate future observations', () => {
    const source = createInventoryRetryStormDemoSource({ clock: () => FIXED_TIME })
    const first = source.getServiceHealth('inventory-api')
    first.data.status = 'tampered-by-caller'
    first.data.errorRatePct = 0

    const second = source.getServiceHealth('inventory-api')
    expect(second.data.status).toBe('degraded')
    expect(second.data.errorRatePct).toBe(8.7)
  })
})
