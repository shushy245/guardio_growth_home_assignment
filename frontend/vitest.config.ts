import path from 'path';
import { defineConfig } from 'vitest/config';

// clearMocks + setupFiles are load-bearing: tests never call cleanup() or reset mocks themselves.
export default defineConfig({
    resolve: {
        alias: {
            '~': path.resolve(import.meta.dirname, 'src'),
        },
    },
    test: {
        environment: 'jsdom',
        setupFiles: ['./src/testkit/setup.ts'],
        clearMocks: true,
        css: { modules: { classNameStrategy: 'non-scoped' } },
    },
});
