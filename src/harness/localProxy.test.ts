import { describe, expect, it } from 'vitest'
import {
  TRUEFORGE_BROWSER_PROXY_BASE,
  assertLocalTrueForgeUrl,
  assertTrueForgeSdkBaseUrl,
  resolveLocalTrueForgeProxyTarget,
  rewriteTrueForgeProxyPath,
} from './localProxy'
import { SdkTrueForgeTransport } from './trueforge'

describe('local TrueForge browser proxy boundary', () => {
  it('keeps the configured target limited to a credential-free loopback origin', () => {
    expect(assertLocalTrueForgeUrl('http://localhost:8790/')).toBe('http://localhost:8790')
    expect(assertLocalTrueForgeUrl('http://127.0.0.1:8790')).toBe('http://127.0.0.1:8790')

    expect(() => assertLocalTrueForgeUrl('http://user:secret@localhost:8790')).toThrow(/credential-free/i)
    expect(() => assertLocalTrueForgeUrl('http://localhost:8790?token=secret')).toThrow(/credential-free/i)
    expect(() => assertLocalTrueForgeUrl('http://192.168.1.10:8790')).toThrow(/local no-login/i)
    expect(() => assertLocalTrueForgeUrl('https://localhost:8790')).toThrow(/local no-login/i)
  })

  it('uses only the dedicated same-origin proxy base for browser SDK traffic', () => {
    expect(assertTrueForgeSdkBaseUrl(TRUEFORGE_BROWSER_PROXY_BASE)).toBe('/__rook_trueforge')
    expect(assertTrueForgeSdkBaseUrl('http://127.0.0.1:8790')).toBe('http://127.0.0.1:8790')

    expect(() => assertTrueForgeSdkBaseUrl('/api/v1')).toThrow(/valid URL/i)
    expect(() => assertTrueForgeSdkBaseUrl('/__other_proxy')).toThrow(/valid URL/i)
    expect(() => assertTrueForgeSdkBaseUrl('https://hosted.trueforge.example')).toThrow(/local no-login/i)
  })

  it('constructs the official SDK transport against the same-origin proxy without requiring a cross-origin URL', () => {
    expect(() => new SdkTrueForgeTransport({ baseUrl: TRUEFORGE_BROWSER_PROXY_BASE })).not.toThrow()
  })

  it('enables the Vite proxy only for a valid local target', () => {
    expect(resolveLocalTrueForgeProxyTarget(undefined)).toBeUndefined()
    expect(resolveLocalTrueForgeProxyTarget('')).toBeUndefined()
    expect(resolveLocalTrueForgeProxyTarget(' http://localhost:8790/ ')).toBe('http://localhost:8790')
    expect(resolveLocalTrueForgeProxyTarget('https://hosted.trueforge.example')).toBeUndefined()
    expect(resolveLocalTrueForgeProxyTarget('http://user:secret@localhost:8790')).toBeUndefined()
  })

  it('strips only the ROOK proxy prefix and refuses unrelated paths', () => {
    expect(rewriteTrueForgeProxyPath('/__rook_trueforge')).toBe('/')
    expect(rewriteTrueForgeProxyPath('/__rook_trueforge/api/v1/sessions')).toBe('/api/v1/sessions')
    expect(rewriteTrueForgeProxyPath('/__rook_trueforge/api/v1/sessions/sess_01/turns?stream=true'))
      .toBe('/api/v1/sessions/sess_01/turns?stream=true')

    expect(() => rewriteTrueForgeProxyPath('/api/v1/sessions')).toThrow(/refusing to proxy/i)
    expect(() => rewriteTrueForgeProxyPath('/__rook_trueforge-evil/api/v1')).toThrow(/refusing to proxy/i)
  })
})
