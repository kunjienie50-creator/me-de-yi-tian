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

  return {
    // 用相对路径打包：本地打开、GitHub Pages 的子路径部署都能直接跑
    base: './',
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
