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

    // ── Consumer-declared structurally-pure glob (testing-conventions.md → pure-function
    //    exemption, adr-0004). The frontend model layer is pure by construction: `model.ts` is
    //    types only, `translator.ts` maps wire → model, `selectors.ts` reads properties. There is
    //    no DOM, no async and no interaction for a driver to absorb, so these assert bare. This
    //    widens the exemption's reach, not the rule — the rule itself stays on everywhere else. ──
    {
        files: ['frontend/src/models/**/*.test.ts'],
        rules: { 'no-restricted-syntax': 'off' },
    },

    // ── Boundary files that must speak null: the axios seam normalises JSON null, the composition
    //    root reads the DOM, the storage wrapper reads localStorage (getItem returns null) ──
    {
        files: [
            '**/api/http-client.utils.ts',
            '**/api/http-client.utils.test.ts',
            '**/main.tsx',
            '**/storage/visitor-id.ts',
        ],
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
    // Two wrapper files, one exemption each (lint-index: "one entry + one override exemption per
    // wrapper file"): the production seam, and the test-side fake transport that must speak
    // axios's adapter contract to stand in for the network.
    { files: ['**/api/http-client.ts', '**/testkit/fake-http.ts'], rules: { 'no-restricted-imports': 'off' } },
];
