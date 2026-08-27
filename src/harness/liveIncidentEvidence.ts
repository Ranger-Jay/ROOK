import type { HarnessEvent } from './adapter'

type McpToolCalledEvent = Extract<HarnessEvent, { type: 'mcp.tool.called' }>
type McpToolReturnedEvent = Extract<HarnessEvent, { type: 'mcp.tool.returned' }>
type UnknownRecord = Record<string, unknown>

export interface CorrelatedMcpEvidence {
  callId: string
  name: string
  serverId: string
  serverName: string
  arguments: string
  responseContent: string
  callSourceEventId: string
  responseSourceEventId: string
  callSourceTimestamp?: string
  responseSourceTimestamp?: string
}

export interface ObservedRetryPressure {
  evidenceState: 'observed'
  classification: 'owned-demo-non-production'
  sourceSystem: 'rook-owned-demo-source'
  scenarioId: 'inventory-retry-storm-v1'
  sourceTimestamp: string
  observationWindow: {
    start: string
    end: string
  }
  attemptsPerMinute: number
  baselineAttemptsPerMinute: number
  retryMultiplier: number
  sharedQueueDepth: number
  sharedQueueSaturationPct: number
  pressureSource: string
  callId: string
  callSourceEventId: string
  responseSourceEventId: string
}

const isRecord = (value: unknown): value is UnknownRecord => typeof value === 'object' && value !== null && !Array.isArray(value)
const finiteNumber = (record: UnknownRecord, key: string): number | undefined => {
  const value = record[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}
const nonBlankString = (record: UnknownRecord, key: string): string | undefined => {
  const value = record[key]
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined
}

export function correlateObservedMcpEvidence(events: readonly HarnessEvent[]): CorrelatedMcpEvidence[] {
  const calls = new Map<string, McpToolCalledEvent>()
  const pairs: CorrelatedMcpEvidence[] = []

  for (const event of events) {
    if (event.type === 'mcp.tool.called') {
      calls.set(event.callId, event)
      continue
    }
    if (event.type !== 'mcp.tool.returned') continue

    const call = calls.get(event.callId)
    if (!call || call.threadId !== event.threadId) continue

    pairs.push({
      callId: call.callId,
      name: call.name,
      serverId: call.serverId,
      serverName: call.serverName,
      arguments: call.arguments,
      responseContent: event.content,
      callSourceEventId: call.sourceEventId,
      responseSourceEventId: event.sourceEventId,
      callSourceTimestamp: call.sourceTimestamp,
      responseSourceTimestamp: event.sourceTimestamp,
    })
    calls.delete(event.callId)
  }

  return pairs
}

export function projectObservedRetryPressure(evidence: CorrelatedMcpEvidence): ObservedRetryPressure | null {
  if (evidence.name !== 'get_retry_pressure' || evidence.serverName !== 'rook-inventory-retry-storm') return null

  let payload: unknown
  try {
    payload = JSON.parse(evidence.responseContent)
  } catch {
    return null
  }
  if (!isRecord(payload)) return null

  const source = payload.source
  const data = payload.data
  if (!isRecord(source) || !isRecord(data)) return null
  if (
    source.system !== 'rook-owned-demo-source'
    || source.scenarioId !== 'inventory-retry-storm-v1'
    || source.classification !== 'owned-demo-non-production'
    || source.kind !== 'retry-pressure'
  ) return null

  const sourceTimestamp = nonBlankString(source, 'sourceTimestamp')
  const observationWindow = source.observationWindow
  if (!sourceTimestamp || !isRecord(observationWindow)) return null
  const start = nonBlankString(observationWindow, 'start')
  const end = nonBlankString(observationWindow, 'end')
  if (!start || !end) return null

  const attemptsPerMinute = finiteNumber(data, 'attemptsPerMinute')
  const baselineAttemptsPerMinute = finiteNumber(data, 'baselineAttemptsPerMinute')
  const retryMultiplier = finiteNumber(data, 'retryMultiplier')
  const sharedQueueDepth = finiteNumber(data, 'sharedQueueDepth')
  const sharedQueueSaturationPct = finiteNumber(data, 'sharedQueueSaturationPct')
  const pressureSource = nonBlankString(data, 'pressureSource')
  if (
    attemptsPerMinute === undefined
    || baselineAttemptsPerMinute === undefined
    || retryMultiplier === undefined
    || sharedQueueDepth === undefined
    || sharedQueueSaturationPct === undefined
    || !pressureSource
  ) return null

  return {
    evidenceState: 'observed',
    classification: 'owned-demo-non-production',
    sourceSystem: 'rook-owned-demo-source',
    scenarioId: 'inventory-retry-storm-v1',
    sourceTimestamp,
    observationWindow: { start, end },
    attemptsPerMinute,
    baselineAttemptsPerMinute,
    retryMultiplier,
    sharedQueueDepth,
    sharedQueueSaturationPct,
    pressureSource,
    callId: evidence.callId,
    callSourceEventId: evidence.callSourceEventId,
    responseSourceEventId: evidence.responseSourceEventId,
  }
}

export function selectLatestObservedRetryPressure(events: readonly HarnessEvent[]): ObservedRetryPressure | null {
  const correlated = correlateObservedMcpEvidence(events)
  for (let index = correlated.length - 1; index >= 0; index -= 1) {
    const projected = projectObservedRetryPressure(correlated[index])
    if (projected) return projected
  }
  return null
}
