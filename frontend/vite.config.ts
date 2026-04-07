import { defineConfig, loadEnv } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import react from '@vitejs/plugin-react';
// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '')
  
  const serverUrl = env.VITE_SERVER_URL || 'http://localhost:8000'
  const openpechaUrl =env.VITE_OPENPECHA_URL || ""
  const bdrcServerUrl = env.VITE_BDRC_BACKEND_URL || 'http://localhost:8000'
  
  return {
    plugins: [react({
      babel: {
        plugins: ['babel-plugin-react-compiler'],
      },
    }), tailwindcss()],
    server: {
      port: 3000,
      allowedHosts: true,
      proxy: {
        '/api': {
          target: serverUrl,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api/, ''),
          configure: (proxy) => {
            proxy.on('error', (err) => {
              console.warn('proxy error', err);
            });
            proxy.on('proxyReq', (_proxyReq, req) => {
            });
            proxy.on('proxyRes', (proxyRes, req) => {
            });
          },
        },
        '/bdrc/api': {
          target: bdrcServerUrl,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/bdrc\/api/, ''),
        },
        '/openpecha/api':{
          target: openpechaUrl,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/openpecha\/api/, ''),
        }
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@app': path.resolve(__dirname, './src/app/index.ts'),
      },
    },
  }
})
