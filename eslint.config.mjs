import shalev, { pureFunctionTestSyntaxSelectors, typeAwareRules } from 'eslint-config-shalev';

// The shared config keeps its `no-restricted-syntax` selectors private, so the boundary
// exemptions below read them back out of it rather than re-pasting a list that would go stale.
// A shape that no longer matches throws here, at config load, instead of quietly lint-passing.
const SYNTAX_RULE = 'no-restricted-syntax';

const syntaxSelectorsOf = (describe, matches) => {
    const config = shalev.filter((entry) => hasSyntaxRule(entry) && matches(entry)).at(-1);
    if (config === undefined) throw new Error(`eslint.config: no shared config object holds the ${describe} selectors`);

    return config.rules[SYNTAX_RULE].slice(1);
};

const hasSyntaxRule = (entry) => entry.rules !== undefined && Array.isArray(entry.rules[SYNTAX_RULE]);

const coversGlob = (glob) => (entry) => entry.files !== undefined && entry.files.includes(glob);

const BASE_SYNTAX_SELECTORS = syntaxSelectorsOf('base', coversGlob('**/*.ts'));
const COMPONENT_SYNTAX_SELECTORS = syntaxSelectorsOf('component', coversGlob('**/*.tsx'));
const PURE_TEST_SYNTAX_SELECTORS = syntaxSelectorsOf('pure-function test', coversGlob('**/*.utils.test.ts'));

// The one selector a boundary file earns an exemption from: it is the file that turns the
// outside world's `null` into our `undefined`, and it cannot do that without naming it.
const NULL_LITERAL_SELECTOR = 'Literal[value=null]';

const withoutNullLiteral = (selectors) => selectors.filter((selector) => selector.selector !== NULL_LITERAL_SELECTOR);

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
    //    Composed, not switched off: every selector the rule carries stays on and only the
    //    raw-`expect` ban is dropped, which is the whole of the exemption. `off` would also have
    //    retired the inline-factory and raw-testid selectors in these files, silently.
    {
        files: ['frontend/src/models/**/*.test.ts'],
        rules: { 'no-restricted-syntax': ['error', ...pureFunctionTestSyntaxSelectors] },
    },

    // ── Boundary files that must speak null: the axios seam normalises JSON null, and the
    //    composition root reads the DOM ──
    //    Composed, never `off`. ESLint replaces a rule value wholesale when a later config
    //    object re-declares it, so `off` here retired the raw-testid, backticked-JSX-text,
    //    inline-lambda, boolean-param and optional-chaining selectors in `main.tsx` — which
    //    renders JSX — to buy one `null` exemption (BF66). Each entry below keeps the list the
    //    shared config would have applied to that file class and drops the one selector the
    //    boundary earns, read back out of the package so a selector added there is not silently
    //    missing here.
    {
        files: ['**/api/http-client.utils.ts'],
        rules: { 'no-restricted-syntax': ['error', ...withoutNullLiteral(BASE_SYNTAX_SELECTORS)] },
    },
    {
        files: ['**/main.tsx'],
        rules: { 'no-restricted-syntax': ['error', ...withoutNullLiteral(COMPONENT_SYNTAX_SELECTORS)] },
    },
    {
        files: ['**/api/http-client.utils.test.ts'],
        rules: { 'no-restricted-syntax': ['error', ...withoutNullLiteral(PURE_TEST_SYNTAX_SELECTORS)] },
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
    // The console wrapper. `no-console`'s own instruction is "use the structured logger"; this is
    // that logger, and it is the only file allowed to reach the console to be it.
    { files: ['**/logging/logger.ts'], rules: { 'no-console': 'off' } },

    // Two wrapper files, one exemption each (lint-index: "one entry + one override exemption per
    // wrapper file"): the production seam, and the test-side fake transport that must speak
    // axios's adapter contract to stand in for the network.
    { files: ['**/api/http-client.ts', '**/testkit/fake-http.ts'], rules: { 'no-restricted-imports': 'off' } },
];
