import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import {
  TRUEFORGE_BROWSER_PROXY_BASE,
  resolveLocalTrueForgeProxyTarget,
  rewriteTrueForgeProxyPath,
} from './src/harness/localProxy'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const trueForgeTarget = resolveLocalTrueForgeProxyTarget(env.VITE_TRUEFORGE_URL)
  const trueForgeProxy = trueForgeTarget
    ? {
        [TRUEFORGE_BROWSER_PROXY_BASE]: {
          target: trueForgeTarget,
          changeOrigin: true,
          rewrite: rewriteTrueForgeProxyPath,
        },
      }
    : undefined

  return {
    plugins: [react()],
    ...(trueForgeProxy ? {
      server: { proxy: trueForgeProxy },
      preview: { proxy: trueForgeProxy },
    } : {}),
  }
})
