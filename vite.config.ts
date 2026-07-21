import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // Electron needs relative paths for file:// protocol; GitHub Pages needs subpath
  base: mode === 'electron' ? './' : '/lite_MD_editor/',
  server: {
    port: 5173,
    open: true,
  },
}));
