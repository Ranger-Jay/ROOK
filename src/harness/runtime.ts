import type { RookHarnessAdapter } from './adapter'
import { UnconfiguredHarnessAdapter } from './adapter'
import {
  TRUEFORGE_BROWSER_PROXY_BASE,
  assertLocalTrueForgeUrl,
} from './localProxy'
import {
  V003SdkTrueForgeTransport,
  V003TrueForgeHarnessAdapter,
} from './v003'

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

  return new V003TrueForgeHarnessAdapter(
    { modelName: configuration.modelName },
    new V003SdkTrueForgeTransport({ baseUrl: TRUEFORGE_BROWSER_PROXY_BASE }),
  )
}
