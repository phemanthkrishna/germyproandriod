import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    server: {
      host: '127.0.0.1',
    },
    build: {
      rollupOptions: {},
    },
    define: {
      'import.meta.env.VITE_PORTAL': JSON.stringify(env.VITE_PORTAL || mode),
    },
  }
})
