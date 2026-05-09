import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

// Inject required security headers for CheerpX SharedArrayBuffer
const crossOriginIsolation = () => ({
  name: 'configure-server',
  configureServer(server: any) {
    server.middlewares.use((_req: any, res: any, next: any) => {
      res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
      res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
      next();
    });
  }
});

// Proxy for downloading external binaries like github releases
const fetchProxy = () => ({
  name: 'fetch-proxy',
  configureServer(server: any) {
    server.middlewares.use(async (req: any, res: any, next: any) => {
      if (!req.url.startsWith('/dev-proxy') && !req.url.startsWith('/api/v1/proxy')) {
        return next();
      }
      
      const urlStr = new URL(req.url, 'http://localhost').searchParams.get('url');
      if (!urlStr) {
        res.statusCode = 400;
        res.end('Missing url');
        return;
      }
      try {
        const fetchRes = await fetch(urlStr, { redirect: 'follow' });
        if (!fetchRes.ok) throw new Error(`Upstream returned ${fetchRes.status}`);
        const arrayBuffer = await fetchRes.arrayBuffer();
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(Buffer.from(arrayBuffer));
      } catch (err: any) {
        console.error('Fetch proxy error:', err);
        res.statusCode = 500;
        res.end('Proxy error: ' + err.message);
      }
    });
  }
});

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss(), crossOriginIsolation(), fetchProxy()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      global: 'globalThis',
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      port: 3001,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8080',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, '')
        },
        // ADD THIS: Route all asset requests to the C++ backend
        '/uploads': {
          target: 'http://127.0.0.1:8080',
          changeOrigin: true
        },
        '/v86-assets': {
          target: 'https://copy.sh',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/v86-assets/, '')
        },
        '/i-copy-sh': {
          target: 'https://i.copy.sh',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/i-copy-sh/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('Referer', 'https://copy.sh/v86/');
              proxyReq.setHeader('Origin', 'https://copy.sh');
            });
          }
        }
      }
    },
    // --- ADD THESE BLOCKS ---
    build: {
      target: 'esnext'
    },
    worker: {
      format: 'es'
    },
    optimizeDeps: {
      esbuildOptions: {
        target: 'esnext'
      }
    }
    // ------------------------
  };
});