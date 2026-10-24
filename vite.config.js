import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // 用相对路径打包：本地打开、GitHub Pages 的子路径部署都能直接跑
  base: './',
  plugins: [react()],
  server: {
    host: true, // 允许手机通过局域网 IP 访问
    port: 5173,
    watch: {
      // 这些目录由本机工具生成，监听它们会让 watcher 崩溃（EBUSY）
      ignored: ['**/.npm-cache/**', '**/.dsh-check/**', '**/dist/**', '**/*.tmpdir/**'],
    },
  },
})
