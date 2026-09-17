import shalev, { typeAwareRules } from 'eslint-config-shalev';

export default [
    ...shalev,

    { ignores: ['backend/**', '**/dist/**', '**/node_modules/**'] },

    // ── Import resolver (project-relative → consumer-side); single workspace package: frontend ──
    {
        settings: {
            'import/resolver': {
                typescript: { alwaysTryTypes: true, project: ['frontend/tsconfig.json', 'tsconfig.base.json'] },
                node: true,
            },
        },
    },

    // ── Type-aware rules — scoped to source; projectService resolves the nearest tsconfig per file ──
    {
        files: ['frontend/src/**/*.ts', 'frontend/src/**/*.tsx'],
        languageOptions: {
            parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
        },
        rules: typeAwareRules,
    },

    // ── Boundary files that must speak null: the axios seam normalises JSON null, the composition
    //    root reads the DOM ──
    {
        files: ['**/api/http-client.utils.ts', '**/api/http-client.utils.test.ts', '**/main.tsx'],
        rules: { 'no-restricted-syntax': 'off' },
    },

    // ── Wrapped third-party imports — ban the raw import, exempt the wrapper ──
    {
        rules: {
            'no-restricted-imports': [
                'error',
                { paths: [{ name: 'axios', message: 'axios is wrapped — import httpClient from ~/api/http-client instead.' }] },
            ],
        },
    },
    { files: ['**/api/http-client.ts'], rules: { 'no-restricted-imports': 'off' } },
];
