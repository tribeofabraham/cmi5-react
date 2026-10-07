import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  // Relative asset paths: it's served at learn.tribeofabraham.com/cmi5/, and works from any folder
  base: './',
})
