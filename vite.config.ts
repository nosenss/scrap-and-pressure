import { defineConfig } from 'vite'

export default defineConfig({
  // Relative paths so the HTML5 build works on itch.io subdirectories
  base: './',
  server: { port: 5173, open: true },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
})
