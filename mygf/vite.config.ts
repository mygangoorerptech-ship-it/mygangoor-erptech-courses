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
    target: 'https://eca-53sj.onrender.com',
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
          proxyRes: import('node:http').IncomingMessage
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
    plugins: [
      tailwindcss(), 
      react(),
      // {
      //   name: 'serve-html-pages',
      //   configureServer(server) {
      //     if (!htmlPagesExists) return;
          
      //     // Serve HTML files from html-pages folder
      //     server.middlewares.use((req, res, next) => {
      //       // Serve /home route
      //       if (req.url === '/home' || req.url === '/home/') {
      //         const homeFile = path.join(htmlPagesDir, 'home.html');
      //         if (fs.existsSync(homeFile)) {
      //           res.setHeader('Content-Type', 'text/html');
      //           res.end(fs.readFileSync(homeFile, 'utf-8'));
      //           return;
      //         }
      //       }
            
      //       // Serve /login.html route
      //       if (req.url === '/login.html' || req.url === '/login.html/') {
      //         const loginFile = path.join(htmlPagesDir, 'login.html');
      //         if (fs.existsSync(loginFile)) {
      //           res.setHeader('Content-Type', 'text/html');
      //           res.end(fs.readFileSync(loginFile, 'utf-8'));
      //           return;
      //         }
      //       }

      //       // Canonicalize login URL in dev: /login → /login.html (preserve querystring)
      //       if (req.url && (req.url === '/login' || req.url.startsWith('/login?') || req.url === '/login/')) {
      //         res.statusCode = 302;
      //         res.setHeader('Location', req.url.replace(/^\/login\/?/, '/login.html'));
      //         res.end();
      //         return;
      //       }
            
      //       // Serve other HTML files from html-pages
      //       if (req.url && req.url.endsWith('.html') && !req.url.startsWith('/static/')) {
      //         const htmlFile = path.join(htmlPagesDir, req.url);
      //         if (fs.existsSync(htmlFile) && htmlFile.startsWith(htmlPagesDir)) {
      //           res.setHeader('Content-Type', 'text/html');
      //           res.end(fs.readFileSync(htmlFile, 'utf-8'));
      //           return;
      //         }
      //       }
            
      //       // Serve assets from html-pages/assets (both /html-assets and /static/assets)
      //       // IMPORTANT: Strip querystrings (e.g. ionicons.ttf?v=2.0.0) so fonts/icons load correctly.
      //       if (req.url && (req.url.startsWith('/html-assets/') || req.url.startsWith('/static/assets/'))) {
      //         const url = new URL(req.url, 'http://localhost');
      //         const assetPath = url.pathname.replace('/html-assets/', '').replace('/static/assets/', '');
      //         const assetFile = path.join(htmlPagesDir, 'assets', assetPath);
      //         if (fs.existsSync(assetFile) && assetFile.startsWith(path.join(htmlPagesDir, 'assets'))) {
      //           // Determine content type
      //           const ext = path.extname(assetFile).toLowerCase();
      //           const contentTypes: Record<string, string> = {
      //             '.css': 'text/css',
      //             '.js': 'application/javascript',
      //             '.jpg': 'image/jpeg',
      //             '.jpeg': 'image/jpeg',
      //             '.png': 'image/png',
      //             '.gif': 'image/gif',
      //             '.svg': 'image/svg+xml',
      //             '.woff': 'font/woff',
      //             '.woff2': 'font/woff2',
      //             '.ttf': 'font/ttf',
      //             '.eot': 'application/vnd.ms-fontobject',
      //           };
      //           res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream');
      //           res.end(fs.readFileSync(assetFile));
      //           return;
      //         }
      //       }
            
      //       // Serve other static files from html-pages root (like notification-bell-standalone.js)
      //       if (req.url && req.url.startsWith('/static/') && !req.url.startsWith('/static/assets/')) {
      //         const url = new URL(req.url, 'http://localhost');
      //         const filePath = url.pathname.replace('/static/', '');
      //         const staticFile = path.join(htmlPagesDir, filePath);
      //         // Only serve non-HTML files from root to avoid conflicts
      //         if (fs.existsSync(staticFile) && staticFile.startsWith(htmlPagesDir) && !staticFile.endsWith('.html')) {
      //           const ext = path.extname(staticFile).toLowerCase();
      //           const contentTypes: Record<string, string> = {
      //             '.js': 'application/javascript',
      //             '.json': 'application/json',
      //           };
      //           res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream');
      //           res.end(fs.readFileSync(staticFile));
      //           return;
      //         }
      //       }
            
      //       next();
      //     });
      //   }
      // }
    ],
    server: {
      port: 5173,
      strictPort: true, // Fail if port is already in use instead of trying another
      https: httpsCfg,
      proxy: {
        '/api': proxyCommon,
        '/csrf': proxyCommon,
      },
    },
    publicDir: 'public',
  };
});
