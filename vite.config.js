import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',
  publicDir: 'public',
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3086',
        changeOrigin: true,
      },
      '/gallery': {
        target: 'http://localhost:3086',
        changeOrigin: true,
      },
    },
  },
});
