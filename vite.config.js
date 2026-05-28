import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [vue(), cloudflare()],
  server: {
    proxy: {
      '/api/coze': {
        target: 'https://ffkhfyzdmv.coze.site',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/coze/, ''),
      },
    },
  },
})