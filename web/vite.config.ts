import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Em desenvolvimento, as chamadas /api vão para a API local (python api.py).
    proxy: {
      '/api': 'http://127.0.0.1:5000'
    }
  }
})
