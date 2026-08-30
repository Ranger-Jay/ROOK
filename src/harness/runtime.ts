import type { RookHarnessAdapter } from './adapter'
import { UnconfiguredHarnessAdapter } from './adapter'
import {
  TRUEFORGE_BROWSER_PROXY_BASE,
  assertLocalTrueForgeUrl,
} from './localProxy'
import {
  V004SdkTrueForgeTransport,
  V004TrueForgeHarnessAdapter,
} from './v004'
import type {
  TrueForgeSessionSeed,
  TrueForgeStreamItem,
  TrueForgeTransport,
} from './trueforge'

export interface HarnessEnvironment {
  VITE_TRUEFORGE_URL?: string
  VITE_TRUEFORGE_MODEL?: string
}

export type HarnessRuntimeConfiguration =
  | {
      mode: 'configured'
      baseUrl: string
      modelName: string
    }
  | {
      mode: 'unconfigured'
      reason: string
    }

const clean = (value: string | undefined): string => value?.trim() ?? ''

const validateModelName = (modelName: string): string => {
  if (modelName.length > 256 || /[\u0000-\u001f\u007f]/.test(modelName)) {
    throw new Error('VITE_TRUEFORGE_MODEL must be a non-secret model identifier without control characters.')
  }
  return modelName
}

export const reinforceV004ProofInstruction = (instruction: string): string => [
  'COMPLETE BOTH REQUIRED TOOL CALLS BEFORE ENDING THIS TURN.',
  'After the get_retry_pressure tool response, DO NOT STOP, summarize, or answer with prose.',
  'The required TrueForge sandbox exec tool is already preloaded and directly callable as exec.',
  'Do NOT call list_tools, get_tool_info, get_tool_output_schema, or call_tool. Those deferred discovery helpers are not part of this proof.',
  'After get_retry_pressure returns, your NEXT tool call MUST be exec using the exact intent and command arguments specified below.',
  'Do not end the turn until the sandbox exec response has returned.',
  instruction,
].join('\n')

class V004PromptReinforcedTransport implements TrueForgeTransport {
  constructor(private readonly inner: TrueForgeTransport) {}

  createSession(seed: TrueForgeSessionSeed): Promise<{ id: string }> {
    return this.inner.createSession({
      ...seed,
      instructions: reinforceV004ProofInstruction(seed.instructions),
    })
  }

  streamTurn(sessionId: string, instruction: string): AsyncIterable<TrueForgeStreamItem> {
    return this.inner.streamTurn(sessionId, reinforceV004ProofInstruction(instruction))
  }
}

export function resolveHarnessRuntimeConfiguration(env: HarnessEnvironment): HarnessRuntimeConfiguration {
  const rawUrl = clean(env.VITE_TRUEFORGE_URL)
  const rawModelName = clean(env.VITE_TRUEFORGE_MODEL)

  if (!rawUrl && !rawModelName) {
    return { mode: 'unconfigured', reason: 'Local TrueForge URL and model are not configured.' }
  }
  if (!rawUrl) {
    return { mode: 'unconfigured', reason: 'VITE_TRUEFORGE_URL is not configured.' }
  }
  if (!rawModelName) {
    return { mode: 'unconfigured', reason: 'VITE_TRUEFORGE_MODEL is not configured.' }
  }

  try {
    return {
      mode: 'configured',
      baseUrl: assertLocalTrueForgeUrl(rawUrl),
      modelName: validateModelName(rawModelName),
    }
  } catch (error) {
    return {
      mode: 'unconfigured',
      reason: error instanceof Error ? error.message : 'TrueForge configuration is invalid.',
    }
  }
}

export function createHarnessAdapter(configuration: HarnessRuntimeConfiguration): RookHarnessAdapter {
  if (configuration.mode === 'unconfigured') {
    return new UnconfiguredHarnessAdapter(configuration.reason)
  }

  const transport = new V004PromptReinforcedTransport(
    new V004SdkTrueForgeTransport({ baseUrl: TRUEFORGE_BROWSER_PROXY_BASE }),
  )

  return new V004TrueForgeHarnessAdapter(
    { modelName: configuration.modelName },
    transport,
  )
}
