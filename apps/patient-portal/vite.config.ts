import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Port 5200 keeps the patient app clear of the admin (5180) and doctor (5190) dev servers.
export default defineConfig({
  plugins: [react()],
  server: { port: 5200, strictPort: true },
})
