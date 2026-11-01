import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14'],
    cssTarget: ['chrome87', 'firefox78', 'safari14', 'edge88'],
  },
  preview: {
    host: true,
  },
  server: {
    host: true,
  },
})
