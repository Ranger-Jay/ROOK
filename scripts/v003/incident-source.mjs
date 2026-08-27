const SOURCE_SYSTEM = 'rook-owned-demo-source'
const SCENARIO_ID = 'inventory-retry-storm-v1'

const scenarioState = Object.freeze({
  services: Object.freeze({
    'inventory-api': Object.freeze({
      service: 'inventory-api',
      status: 'degraded',
      errorRatePct: 8.7,
      p95LatencyMs: 940,
      saturationPct: 82,
    }),
    'checkout-api': Object.freeze({
      service: 'checkout-api',
      status: 'healthy',
      errorRatePct: 0.3,
      p95LatencyMs: 180,
      saturationPct: 41,
    }),
    'fulfillment-worker': Object.freeze({
      service: 'fulfillment-worker',
      status: 'degraded',
      errorRatePct: 3.2,
      p95LatencyMs: 710,
      saturationPct: 76,
    }),
  }),
  retryPressure: Object.freeze({
    attemptsPerMinute: 4800,
    baselineAttemptsPerMinute: 900,
    retryMultiplier: 5.3,
    sharedQueueDepth: 7200,
    sharedQueueSaturationPct: 91,
    pressureSource: 'inventory-retry-queue',
  }),
  deployments: Object.freeze([
    Object.freeze({
      service: 'inventory-api',
      version: 'inventory-api@2026.08.26.2',
      changeId: 'deploy-842',
      deployedAt: '2026-08-26T02:21:00.000Z',
      changes: Object.freeze({
        'retry.maxAttempts': 5,
        'retry.baseDelayMs': 50,
        'retry.jitter': false,
      }),
    }),
    Object.freeze({
      service: 'inventory-api',
      version: 'inventory-api@2026.08.26.1',
      changeId: 'deploy-839',
      deployedAt: '2026-08-25T19:10:00.000Z',
      changes: Object.freeze({
        'retry.maxAttempts': 3,
        'retry.baseDelayMs': 250,
        'retry.jitter': true,
      }),
    }),
  ]),
  topology: Object.freeze({
    nodes: Object.freeze([
      Object.freeze({ id: 'inventory-api', kind: 'service' }),
      Object.freeze({ id: 'checkout-api', kind: 'service' }),
      Object.freeze({ id: 'fulfillment-worker', kind: 'worker' }),
      Object.freeze({ id: 'inventory-retry-queue', kind: 'queue' }),
      Object.freeze({ id: 'inventory-cache', kind: 'cache' }),
    ]),
    edges: Object.freeze([
      Object.freeze({ from: 'inventory-api', to: 'inventory-retry-queue', relation: 'publishes-retries' }),
      Object.freeze({ from: 'fulfillment-worker', to: 'inventory-retry-queue', relation: 'consumes' }),
      Object.freeze({ from: 'inventory-api', to: 'inventory-cache', relation: 'reads-writes' }),
      Object.freeze({ from: 'checkout-api', to: 'inventory-cache', relation: 'reads' }),
    ]),
  }),
})

const clone = (value) => structuredClone(value)

const observationWindowFor = (sourceTimestamp) => {
  const endMs = Date.parse(sourceTimestamp)
  if (!Number.isFinite(endMs)) throw new Error('Owned demo source clock returned an invalid timestamp.')
  return {
    start: new Date(endMs - 5 * 60 * 1000).toISOString(),
    end: new Date(endMs).toISOString(),
  }
}

const envelope = (kind, data, clock) => {
  const sourceTimestamp = clock()
  return {
    source: {
      system: SOURCE_SYSTEM,
      scenarioId: SCENARIO_ID,
      kind,
      sourceTimestamp,
      observationWindow: observationWindowFor(sourceTimestamp),
    },
    data: clone(data),
  }
}

export const INVENTORY_RETRY_STORM_SOURCE = Object.freeze({
  system: SOURCE_SYSTEM,
  scenarioId: SCENARIO_ID,
})

export const INVENTORY_RETRY_STORM_SERVICES = Object.freeze(Object.keys(scenarioState.services))

export function createInventoryRetryStormSource({ clock = () => new Date().toISOString() } = {}) {
  return Object.freeze({
    getServiceHealth(service = 'inventory-api') {
      const health = scenarioState.services[service]
      if (!health) throw new Error(`Unknown owned demo service: ${service}`)
      return envelope('service-health', health, clock)
    },

    getRetryPressure() {
      return envelope('retry-pressure', scenarioState.retryPressure, clock)
    },

    getDeploymentHistory() {
      return envelope('deployment-history', scenarioState.deployments, clock)
    },

    getDependencyTopology() {
      return envelope('dependency-topology', scenarioState.topology, clock)
    },

    snapshotForVerification() {
      return clone(scenarioState)
    },
  })
}
