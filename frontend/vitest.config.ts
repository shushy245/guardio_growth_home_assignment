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
        // Pinned west of Greenwich on purpose. A date bug where a UTC-parsed calendar day slips
        // to the previous day is invisible in UTC and in any zone ahead of it — which is every
        // machine this is developed and built on. Pinning it makes those tests bite everywhere.
        env: { TZ: 'America/New_York' },
    },
});
