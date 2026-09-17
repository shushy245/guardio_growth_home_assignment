import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The proxy forwards /api to the FastAPI backend in dev, so the browser sees one origin.
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '~': path.resolve(import.meta.dirname, 'src'),
        },
    },
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://localhost:8000',
                changeOrigin: true,
            },
        },
    },
});
