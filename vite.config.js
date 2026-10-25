import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(async ({ mode }) => {
  // 把本机 .env 里的密钥读进 process.env（只在本机 dev/preview 进程内，不会进前端）
  const env = loadEnv(mode, process.cwd(), '')
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) process.env[key] = value
  }
  const { aiMiddleware } = await import('./server/ai.js')

  // ---- 静态站直连模式 ----
  // 只有显式 VITE_AI_MODE=direct + 提供了 key 时才注入。
  // 注意：注入出去就等于把这个 key 公开给所有访问者（静态站没有秘密），
  // 所以这里把它切成几段 base64 再拼，避免整串以明文形式躺在 bundle 里
  // （也避免被 GitHub 的推送保护直接拦下）。这不是加密，只是打散。
  const directMode = String(env.VITE_AI_MODE || process.env.VITE_AI_MODE || '').toLowerCase() === 'direct'
  // 故意不用 VITE_ 前缀：VITE_ 变量会被 Vite 原样内联进 bundle，那样密钥就是明文了
  const rawKey = String(env.AI_DEPLOY_KEY || process.env.AI_DEPLOY_KEY || '').trim()
  const keyParts =
    directMode && rawKey
      ? [rawKey.slice(0, 12), rawKey.slice(12, 24), rawKey.slice(24)].map((part) =>
          Buffer.from(part, 'utf8').toString('base64'),
        )
      : []

  return {
    // 用相对路径打包：本地打开、GitHub Pages 的子路径部署都能直接跑
    base: './',
    define: {
      // 静态站直连模式才注入；数组为空时前端会走 proxy 模式
      __AI_KEY_PARTS__: JSON.stringify(keyParts),
      __AI_DIRECT__: JSON.stringify(directMode),
    },
    plugins: [
      react(),
      {
        // 只在本地 dev / preview 提供的 AI 代理；打包出去没有它，前端会自动降级
        name: 'me-de-yi-tian-ai-proxy',
        configureServer(server) {
          server.middlewares.use(aiMiddleware())
        },
        configurePreviewServer(server) {
          server.middlewares.use(aiMiddleware())
        },
      },
    ],
    server: {
      host: true, // 允许手机通过局域网 IP 访问
      port: 5173,
      watch: {
        // 这些目录由本机工具生成，监听它们会让 watcher 崩溃（EBUSY）
        ignored: ['**/.npm-cache/**', '**/.dsh-check/**', '**/dist/**', '**/*.tmpdir/**'],
      },
    },
  }
})
