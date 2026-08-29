import type { HarnessEvent } from './adapter'
import {
  ROOK_V004_REPRODUCTION_INPUT,
  ROOK_V004_SANDBOX_COMMAND,
  ROOK_V004_SANDBOX_INTENT,
} from './v004'

type SandboxExecCalledEvent = Extract<HarnessEvent, { type: 'sandbox.exec.called' }>
type SandboxStartedEvent = Extract<HarnessEvent, { type: 'sandbox.started' }>
type UnknownRecord = Record<string, unknown>

export interface CorrelatedSandboxReproductionEvidence {
  callId: string
  arguments: string
  responseContent: string
  sandboxId: string
  callSourceEventId: string
  sandboxSourceEventId: string
  responseSourceEventId: string
  callSourceTimestamp?: string
  sandboxSourceTimestamp?: string
  responseSourceTimestamp?: string
}

export interface ReproducedRetryPressure {
  evidenceState: 'reproduced'
  kind: 'rook-v004-reproduction'
  retryMultiplier: 5.3
  attemptsPerMinute: 4800
  baselineAttemptsPerMinute: 900
  queueDepth: 7200
  queueSaturationPct: 91
  sandboxId: string
  callId: string
  callSourceEventId: string
  sandboxSourceEventId: string
  responseSourceEventId: string
}

const isRecord = (value: unknown): value is UnknownRecord => typeof value === 'object' && value !== null && !Array.isArray(value)
const exactKeys = (record: UnknownRecord, expected: readonly string[]): boolean => {
  const actual = Object.keys(record).sort()
  const wanted = [...expected].sort()
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index])
}

const parseExactExecArguments = (text: string): boolean => {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return false
  }
  return isRecord(parsed)
    && exactKeys(parsed, ['intent', 'command'])
    && parsed.intent === ROOK_V004_SANDBOX_INTENT
    && parsed.command === ROOK_V004_SANDBOX_COMMAND
}

export function correlateSandboxReproductionEvidence(
  events: readonly HarnessEvent[],
): CorrelatedSandboxReproductionEvidence[] {
  const calls = new Map<string, SandboxExecCalledEvent>()
  const sandboxByCall = new Map<string, SandboxStartedEvent>()
  const pairs: CorrelatedSandboxReproductionEvidence[] = []

  for (const event of events) {
    if (event.type === 'sandbox.exec.called') {
      calls.set(event.callId, event)
      continue
    }

    if (event.type === 'sandbox.started') {
      const pending = [...calls.entries()].filter(([callId]) => !sandboxByCall.has(callId))
      if (pending.length !== 1) continue
      const [callId] = pending[0]!
      sandboxByCall.set(callId, event)
      continue
    }

    if (event.type !== 'sandbox.exec.returned') continue

    const call = calls.get(event.callId)
    const sandbox = sandboxByCall.get(event.callId)
    if (!call || !sandbox || call.threadId !== event.threadId) continue

    pairs.push({
      callId: call.callId,
      arguments: call.arguments,
      responseContent: event.content,
      sandboxId: sandbox.sandboxId,
      callSourceEventId: call.sourceEventId,
      sandboxSourceEventId: sandbox.sourceEventId,
      responseSourceEventId: event.sourceEventId,
      callSourceTimestamp: call.sourceTimestamp,
      sandboxSourceTimestamp: sandbox.sourceTimestamp,
      responseSourceTimestamp: event.sourceTimestamp,
    })

    calls.delete(event.callId)
    sandboxByCall.delete(event.callId)
  }

  return pairs
}

export function projectReproducedRetryPressure(
  evidence: CorrelatedSandboxReproductionEvidence,
): ReproducedRetryPressure | null {
  if (!parseExactExecArguments(evidence.arguments)) return null
  if (!evidence.sandboxId.trim()) return null

  let providerResult: unknown
  try {
    providerResult = JSON.parse(evidence.responseContent)
  } catch {
    return null
  }
  if (!isRecord(providerResult) || !exactKeys(providerResult, ['success', 'response'])) return null
  if (providerResult.success !== true || !isRecord(providerResult.response)) return null
  if (!exactKeys(providerResult.response, ['exitCode', 'result'])) return null
  if (providerResult.response.exitCode !== 0 || typeof providerResult.response.result !== 'string') return null

  let reproduction: unknown
  try {
    reproduction = JSON.parse(providerResult.response.result.trim())
  } catch {
    return null
  }
  if (!isRecord(reproduction)) return null
  if (!exactKeys(reproduction, [
    'kind',
    'retryMultiplier',
    'attemptsPerMinute',
    'baselineAttemptsPerMinute',
    'queueDepth',
    'queueSaturationPct',
  ])) return null

  if (
    reproduction.kind !== 'rook-v004-reproduction'
    || reproduction.retryMultiplier !== ROOK_V004_REPRODUCTION_INPUT.retryMultiplier
    || reproduction.attemptsPerMinute !== ROOK_V004_REPRODUCTION_INPUT.attemptsPerMinute
    || reproduction.baselineAttemptsPerMinute !== ROOK_V004_REPRODUCTION_INPUT.baselineAttemptsPerMinute
    || reproduction.queueDepth !== ROOK_V004_REPRODUCTION_INPUT.queueDepth
    || reproduction.queueSaturationPct !== ROOK_V004_REPRODUCTION_INPUT.queueSaturationPct
  ) return null

  return {
    evidenceState: 'reproduced',
    kind: 'rook-v004-reproduction',
    retryMultiplier: ROOK_V004_REPRODUCTION_INPUT.retryMultiplier,
    attemptsPerMinute: ROOK_V004_REPRODUCTION_INPUT.attemptsPerMinute,
    baselineAttemptsPerMinute: ROOK_V004_REPRODUCTION_INPUT.baselineAttemptsPerMinute,
    queueDepth: ROOK_V004_REPRODUCTION_INPUT.queueDepth,
    queueSaturationPct: ROOK_V004_REPRODUCTION_INPUT.queueSaturationPct,
    sandboxId: evidence.sandboxId,
    callId: evidence.callId,
    callSourceEventId: evidence.callSourceEventId,
    sandboxSourceEventId: evidence.sandboxSourceEventId,
    responseSourceEventId: evidence.responseSourceEventId,
  }
}

export function selectLatestReproducedRetryPressure(events: readonly HarnessEvent[]): ReproducedRetryPressure | null {
  const correlated = correlateSandboxReproductionEvidence(events)
  for (let index = correlated.length - 1; index >= 0; index -= 1) {
    const projected = projectReproducedRetryPressure(correlated[index]!)
    if (projected) return projected
  }
  return null
}
