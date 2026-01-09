import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import { copyFileSync, mkdirSync, existsSync } from 'fs'

// Copy preload script before build
function copyPreload() {
  return {
    name: 'copy-preload',
    buildStart() {
      if (!existsSync('dist-electron')) {
        mkdirSync('dist-electron', { recursive: true })
      }
      copyFileSync('electron/preload.cjs', 'dist-electron/preload.cjs')
    }
  }
}

export default defineConfig({
  plugins: [
    react(),
    copyPreload(),
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron', 'pdfkit', 'svg-to-pdfkit']
            }
          }
        }
      }
    ]),
    renderer()
  ],
  build: {
    outDir: 'dist'
  }
})
