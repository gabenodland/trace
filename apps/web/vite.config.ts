import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Deduplicate React in monorepo - ensure single React instance
    // Point to root node_modules (hoisted by npm workspaces)
    alias: {
      'react': path.resolve(__dirname, '../../node_modules/react'),
      'react-dom': path.resolve(__dirname, '../../node_modules/react-dom'),
      '@tanstack/react-query': path.resolve(__dirname, '../../node_modules/@tanstack/react-query'),
    },
  },
})
