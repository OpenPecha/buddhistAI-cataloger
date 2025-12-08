import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '')
  
  const serverUrl = env.VITE_SERVER_URL || 'http://localhost:8000'
  
  return {
    plugins: [react(), tailwindcss()],
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
              console.warn('Sending Request to the Target:', req.method, req.url);
            });
            proxy.on('proxyRes', (proxyRes, req) => {
              console.warn('Received Response from the Target:', proxyRes.statusCode, req.url);
            });
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  }
})
