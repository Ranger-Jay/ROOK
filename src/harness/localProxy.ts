export const TRUEFORGE_BROWSER_PROXY_BASE = '/__rook_trueforge'

export function assertLocalTrueForgeUrl(baseUrl: string): string {
  let parsed: URL
  try {
    parsed = new URL(baseUrl)
  } catch {
    throw new Error('VITE_TRUEFORGE_URL must be a valid URL.')
  }

  const hostname = parsed.hostname.toLowerCase()
  if (parsed.protocol !== 'http:' || (hostname !== 'localhost' && hostname !== '127.0.0.1')) {
    throw new Error('v0.002 permits only the official local no-login TrueForge boundary on http://localhost or http://127.0.0.1.')
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('VITE_TRUEFORGE_URL must be a credential-free local origin with no userinfo, query, or fragment.')
  }
  if (parsed.pathname !== '/' && parsed.pathname !== '') {
    throw new Error('VITE_TRUEFORGE_URL must contain only the local TrueForge origin, not an endpoint path.')
  }

  return parsed.origin
}

/**
 * Browser code talks to TrueForge through ROOK's same-origin proxy. Direct local
 * origins remain accepted for non-browser transports and focused transport tests.
 */
export function assertTrueForgeSdkBaseUrl(baseUrl: string): string {
  const normalized = baseUrl.trim()
  if (normalized === TRUEFORGE_BROWSER_PROXY_BASE) return normalized
  return assertLocalTrueForgeUrl(normalized)
}

/**
 * Vite configuration must remain startable when runtime configuration is absent or
 * invalid. The React runtime will surface the precise fail-closed configuration error.
 */
export function resolveLocalTrueForgeProxyTarget(baseUrl: string | undefined): string | undefined {
  const normalized = baseUrl?.trim() ?? ''
  if (!normalized) return undefined

  try {
    return assertLocalTrueForgeUrl(normalized)
  } catch {
    return undefined
  }
}

export function rewriteTrueForgeProxyPath(path: string): string {
  if (path === TRUEFORGE_BROWSER_PROXY_BASE) return '/'
  if (!path.startsWith(`${TRUEFORGE_BROWSER_PROXY_BASE}/`)) {
    throw new Error(`Refusing to proxy a path outside ${TRUEFORGE_BROWSER_PROXY_BASE}.`)
  }
  return path.slice(TRUEFORGE_BROWSER_PROXY_BASE.length)
}
