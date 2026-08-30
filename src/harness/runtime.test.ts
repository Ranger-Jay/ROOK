import { describe, expect, it } from 'vitest'
import { UnconfiguredHarnessAdapter } from './adapter'
import {
  createHarnessAdapter,
  reinforceV004ProofInstruction,
  resolveHarnessRuntimeConfiguration,
} from './runtime'
import { V004TrueForgeHarnessAdapter } from './v004'

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

describe('v0.004 runtime prompt reinforcement', () => {
  it('requires the model to continue directly from the observed MCP response into the bounded sandbox exec', () => {
    const original = 'First call get_retry_pressure exactly once. Then call the TrueForge sandbox exec tool exactly once.'
    const reinforced = reinforceV004ProofInstruction(original)

    expect(reinforced).toContain('COMPLETE BOTH REQUIRED TOOL CALLS')
    expect(reinforced).toContain('DO NOT STOP')
    expect(reinforced).toContain('sandbox exec tool is already preloaded')
    expect(reinforced).toContain('Do NOT call list_tools, get_tool_info, get_tool_output_schema, or call_tool')
    expect(reinforced).toContain('NEXT tool call MUST be exec')
    expect(reinforced).toContain('Do not end the turn until the sandbox exec response has returned.')
    expect(reinforced).toContain(original)
  })
})

describe('createHarnessAdapter', () => {
  it('returns the explicit fail-closed adapter when configuration is absent', () => {
    expect(createHarnessAdapter({ mode: 'unconfigured', reason: 'missing' })).toBeInstanceOf(UnconfiguredHarnessAdapter)
  })

  it('constructs the v0.004 sandbox-reproduction adapter only from a validated local configuration', () => {
    expect(createHarnessAdapter({
      mode: 'configured',
      baseUrl: 'http://127.0.0.1:8790',
      modelName: 'provider/model',
    })).toBeInstanceOf(V004TrueForgeHarnessAdapter)
  })
})
