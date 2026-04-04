import { defineConfig } from 'vite';
import { resolve } from 'path';
import { devApiMiddleware } from './dev-api-middleware';

export default defineConfig({
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  server: {
    port: 5173,
  },
  plugins: [devApiMiddleware()],
  build: { target: 'esnext' },
});
