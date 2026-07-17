import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Todas las peticiones pasan por Kong (API Gateway) en el puerto 8000.
// El proxy evita problemas de CORS: el navegador solo habla con el origen del front.
const KONG_URL = process.env.VITE_KONG_URL || 'http://localhost:8000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: KONG_URL, changeOrigin: true },
      // /gw/tickets -> kong /tickets (evita choque con las rutas del SPA)
      '/gw': {
        target: KONG_URL,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/gw/, ''),
      },
    },
  },
});
