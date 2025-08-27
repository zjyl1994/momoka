import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/i': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true
      },
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true
      },
      '/admin-api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          ui: ['antd'],
        }
      }
    }
  },
})
