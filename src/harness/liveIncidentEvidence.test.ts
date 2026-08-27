import { describe, expect, it } from 'vitest'
import type { HarnessEvent } from './adapter'
import {
  correlateObservedMcpEvidence,
  projectObservedRetryPressure,
  selectLatestObservedRetryPressure,
} from './liveIncidentEvidence'

const callEvent = (overrides: Partial<Extract<HarnessEvent, { type: 'mcp.tool.called' }>> = {}): Extract<HarnessEvent, { type: 'mcp.tool.called' }> => ({
  type: 'mcp.tool.called',
  sessionId: 'sess_01',
  callId: 'call_01',
  name: 'get_retry_pressure',
  arguments: '{}',
  serverId: 'mcp_01',
  serverName: 'rook-inventory-retry-storm',
  source: 'trueforge',
  sourceEventId: 'evt_call',
  sourceTimestamp: '2026-08-27T05:29:58.000Z',
  observedAt: '2026-08-27T05:30:00.000Z',
  sequence: '2',
  threadId: 'main',
  ...overrides,
})

const validPayload = () => ({
  source: {
    system: 'rook-owned-demo-source',
    scenarioId: 'inventory-retry-storm-v1',
    classification: 'owned-demo-non-production',
    kind: 'retry-pressure',
    sourceTimestamp: '2026-08-27T05:29:59.000Z',
    observationWindow: {
      start: '2026-08-27T05:24:59.000Z',
      end: '2026-08-27T05:29:59.000Z',
    },
  },
  data: {
    attemptsPerMinute: 4800,
    baselineAttemptsPerMinute: 900,
    retryMultiplier: 5.3,
    sharedQueueDepth: 7200,
    sharedQueueSaturationPct: 91,
    pressureSource: 'inventory-retry-queue',
  },
})

const responseEvent = (overrides: Partial<Extract<HarnessEvent, { type: 'mcp.tool.returned' }>> = {}): Extract<HarnessEvent, { type: 'mcp.tool.returned' }> => ({
  type: 'mcp.tool.returned',
  sessionId: 'sess_01',
  callId: 'call_01',
  content: JSON.stringify(validPayload()),
  source: 'trueforge',
  sourceEventId: 'evt_response',
  sourceTimestamp: '2026-08-27T05:29:59.500Z',
  observedAt: '2026-08-27T05:30:00.000Z',
  sequence: '3',
  threadId: 'main',
  ...overrides,
})

describe('v0.003 live incident evidence projection', () => {
  it('pairs only matching MCP calls and responses on the same thread', () => {
    const events: HarnessEvent[] = [
      callEvent(),
      responseEvent({ threadId: 'other', sourceEventId: 'evt_wrong_thread' }),
      responseEvent(),
    ]

    expect(correlateObservedMcpEvidence(events)).toEqual([expect.objectContaining({
      callId: 'call_01',
      name: 'get_retry_pressure',
      callSourceEventId: 'evt_call',
      responseSourceEventId: 'evt_response',
    })])
  })

  it('projects a retry-pressure claim only from the classified owned demo envelope', () => {
    const [correlated] = correlateObservedMcpEvidence([callEvent(), responseEvent()])
    expect(projectObservedRetryPressure(correlated)).toEqual({
      evidenceState: 'observed',
      classification: 'owned-demo-non-production',
      sourceSystem: 'rook-owned-demo-source',
      scenarioId: 'inventory-retry-storm-v1',
      sourceTimestamp: '2026-08-27T05:29:59.000Z',
      observationWindow: {
        start: '2026-08-27T05:24:59.000Z',
        end: '2026-08-27T05:29:59.000Z',
      },
      attemptsPerMinute: 4800,
      baselineAttemptsPerMinute: 900,
      retryMultiplier: 5.3,
      sharedQueueDepth: 7200,
      sharedQueueSaturationPct: 91,
      pressureSource: 'inventory-retry-queue',
      callId: 'call_01',
      callSourceEventId: 'evt_call',
      responseSourceEventId: 'evt_response',
    })
  })

  it('refuses malformed JSON, wrong server, missing demo classification, wrong scenario, and incomplete metrics', () => {
    const [base] = correlateObservedMcpEvidence([callEvent(), responseEvent()])

    expect(projectObservedRetryPressure({ ...base, responseContent: '{not json' })).toBeNull()
    expect(projectObservedRetryPressure({ ...base, serverName: 'other-server' })).toBeNull()

    const noClassification = validPayload()
    delete (noClassification.source as { classification?: string }).classification
    expect(projectObservedRetryPressure({ ...base, responseContent: JSON.stringify(noClassification) })).toBeNull()

    const wrongScenario = validPayload()
    wrongScenario.source.scenarioId = 'different-scenario'
    expect(projectObservedRetryPressure({ ...base, responseContent: JSON.stringify(wrongScenario) })).toBeNull()

    const incomplete = validPayload()
    delete (incomplete.data as { retryMultiplier?: number }).retryMultiplier
    expect(projectObservedRetryPressure({ ...base, responseContent: JSON.stringify(incomplete) })).toBeNull()
  })

  it('selects the latest projection that actually passes the public-truth gate', () => {
    const invalid = responseEvent({
      sourceEventId: 'evt_invalid',
      content: JSON.stringify({ source: { classification: 'fixture' }, data: {} }),
    })
    const secondCall = callEvent({ callId: 'call_02', sourceEventId: 'evt_call_02' })
    const secondResponse = responseEvent({ callId: 'call_02', sourceEventId: 'evt_response_02' })

    const projected = selectLatestObservedRetryPressure([
      callEvent(),
      invalid,
      secondCall,
      secondResponse,
    ])

    expect(projected).toMatchObject({
      callId: 'call_02',
      callSourceEventId: 'evt_call_02',
      responseSourceEventId: 'evt_response_02',
      classification: 'owned-demo-non-production',
    })
  })
})
