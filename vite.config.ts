import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Relative base so the build works from any sub-path (GitHub Pages project site).
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
  },
})
