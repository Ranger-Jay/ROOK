import { describe, expect, it } from 'vitest'
import { UnconfiguredHarnessAdapter } from './adapter'
import { createHarnessAdapter, resolveHarnessRuntimeConfiguration } from './runtime'
import { V003TrueForgeHarnessAdapter } from './v003'

describe('resolveHarnessRuntimeConfiguration', () => {
  it('stays explicitly unconfigured when no live values are present', () => {
    expect(resolveHarnessRuntimeConfiguration({})).toEqual({
      mode: 'unconfigured',
      reason: 'Local TrueForge URL and model are not configured.',
    })
  })

  it('requires both the local origin and non-secret model identifier', () => {
    expect(resolveHarnessRuntimeConfiguration({ VITE_TRUEFORGE_URL: 'http://127.0.0.1:8790' })).toMatchObject({
      mode: 'unconfigured',
      reason: 'VITE_TRUEFORGE_MODEL is not configured.',
    })
    expect(resolveHarnessRuntimeConfiguration({ VITE_TRUEFORGE_MODEL: 'provider/model' })).toMatchObject({
      mode: 'unconfigured',
      reason: 'VITE_TRUEFORGE_URL is not configured.',
    })
  })

  it('normalizes an allowed local configuration', () => {
    expect(resolveHarnessRuntimeConfiguration({
      VITE_TRUEFORGE_URL: ' http://localhost:8790/ ',
      VITE_TRUEFORGE_MODEL: ' provider/model ',
    })).toEqual({
      mode: 'configured',
      baseUrl: 'http://localhost:8790',
      modelName: 'provider/model',
    })
  })

  it('turns invalid or credential-bearing browser configuration into an explicit non-live state', () => {
    expect(resolveHarnessRuntimeConfiguration({
      VITE_TRUEFORGE_URL: 'http://user:secret@localhost:8790',
      VITE_TRUEFORGE_MODEL: 'provider/model',
    })).toMatchObject({ mode: 'unconfigured', reason: expect.stringMatching(/credential-free/i) })

    expect(resolveHarnessRuntimeConfiguration({
      VITE_TRUEFORGE_URL: 'https://hosted.trueforge.example',
      VITE_TRUEFORGE_MODEL: 'provider/model',
    })).toMatchObject({ mode: 'unconfigured', reason: expect.stringMatching(/local no-login/i) })
  })

  it('rejects control characters in the model identifier', () => {
    expect(resolveHarnessRuntimeConfiguration({
      VITE_TRUEFORGE_URL: 'http://localhost:8790',
      VITE_TRUEFORGE_MODEL: 'provider/model\nsecret-looking-line',
    })).toMatchObject({ mode: 'unconfigured', reason: expect.stringMatching(/model identifier/i) })
  })
})

describe('createHarnessAdapter', () => {
  it('returns the explicit fail-closed adapter when configuration is absent', () => {
    expect(createHarnessAdapter({ mode: 'unconfigured', reason: 'missing' })).toBeInstanceOf(UnconfiguredHarnessAdapter)
  })

  it('constructs the v0.003 governed live adapter only from a validated local configuration', () => {
    expect(createHarnessAdapter({
      mode: 'configured',
      baseUrl: 'http://127.0.0.1:8790',
      modelName: 'provider/model',
    })).toBeInstanceOf(V003TrueForgeHarnessAdapter)
  })
})
