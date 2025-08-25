// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'fs';
import path from 'path';

export default defineConfig(({ command }) => {
  const isDev = command === 'serve';

  // Try to load certs; if missing, run plain HTTP
  let httpsCfg: any = undefined;
  if (isDev) {
    try {
      const key = fs.readFileSync(path.resolve(__dirname, 'certs/localhost-key.pem'));
      const cert = fs.readFileSync(path.resolve(__dirname, 'certs/localhost.pem'));
      httpsCfg = { key, cert };
    } catch {
      // no certs -> stick to HTTP; also disable HMR wss
      httpsCfg = undefined;
    }
  }

  return {
    plugins: [tailwindcss(), react()],
    optimizeDeps: {
      exclude: ['lucide-react'], // ⬅️ don’t prebundle aggregator
    },
    server: {
      port: 5173,
      https: httpsCfg,     // if undefined → HTTP
      // If you keep HTTP, don't force HMR to wss
      // hmr: httpsCfg ? { protocol: 'wss', host: 'localhost', port: 5173 } : undefined,
      // Proxy API + CSRF through Vite so cookies are same-origin in dev
      proxy: {
        '/api': {
          target: 'http://localhost:5004',
          changeOrigin: true,
        },
        '/csrf': {
          target: 'http://localhost:5004',
          changeOrigin: true,
        },
      },
    },
  };
});
