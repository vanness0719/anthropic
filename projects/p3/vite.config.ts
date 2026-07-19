import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5174,
    // 开发时把 /api 代理到本地后端(npm run dev:all 会同时起前后端)
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
