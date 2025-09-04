// vite.config.ts
import { defineConfig, type ProxyOptions } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'fs';
import path from 'path';

type ExtendedProxyOptions = ProxyOptions & {
  xfwd?: boolean;
  cookieDomainRewrite?: string | Record<string, string>;
  cookiePathRewrite?: string | Record<string, string>;
  headers?: Record<string, string>;
  secure?: boolean;
};

export default defineConfig(({ command }) => {
  const isDev = command === 'serve';

  let httpsCfg: { key: Buffer; cert: Buffer } | undefined;
  if (isDev) {
    try {
      const key = fs.readFileSync(path.resolve(__dirname, 'certs/localhost-key.pem'));
      const cert = fs.readFileSync(path.resolve(__dirname, 'certs/localhost.pem'));
      httpsCfg = { key, cert };
    } catch {
      httpsCfg = undefined; // fallback to HTTP if certs missing
    }
  }

  const forwardedProto = httpsCfg ? 'https' : 'http';

  const proxyCommon: ExtendedProxyOptions = {
    target: 'http://localhost:5002',
    changeOrigin: true,
    secure: false,
    xfwd: true,
    headers: { 'X-Forwarded-Proto': forwardedProto },
    cookieDomainRewrite: 'localhost',
    cookiePathRewrite: '/',
    configure(proxy /*: import('http-proxy').Server */) {
      // When FE runs on HTTPS, ensure BE cookies remain usable cross-site in dev
      if (forwardedProto !== 'https') return;

      proxy.on(
        'proxyRes',
        (
          proxyRes: import('node:http').IncomingMessage,
          _req: import('node:http').IncomingMessage,
          _res: import('node:http').ServerResponse
        ) => {
          const setCookie = proxyRes.headers['set-cookie'];
          if (Array.isArray(setCookie)) {
            proxyRes.headers['set-cookie'] = setCookie.map((c) =>
              c
                .replace(/; *SameSite=Lax/gi, '; SameSite=None')
                .replace(/; *SameSite=Strict/gi, '; SameSite=None')
            );
          }
        }
      );
    },
  };

  return {
    plugins: [tailwindcss(), react()],
    server: {
      port: 5173,
      https: httpsCfg,
      proxy: {
        '/api': proxyCommon,
        '/csrf': proxyCommon,
      },
    },
    // build options can go here as needed
  };
});
