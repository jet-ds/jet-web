import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import eslintPluginAstro from 'eslint-plugin-astro';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const codeFiles = ['**/*.{js,mjs,cjs,ts,tsx,astro}'];
const typedFiles = ['**/*.{ts,tsx,astro}'];

const browserFiles = [
  'src/components/**/*.{ts,tsx}',
  'src/features/collection-filters/**/*.ts',
  'src/features/egregore/EgregoreExperience.tsx',
  'src/features/egregore/corpus/repository.ts',
  'src/features/egregore/runtime/{capabilities,fakeRuntime,fakeScenario,liteRtGemma}.ts',
  'src/features/egregore/state/**/*.{ts,tsx}',
  'src/hooks/**/*.{ts,tsx}',
];

const nodeFiles = [
  '**/*.config.{js,mjs,cjs,ts}',
  'scripts/**/*.{js,mjs,cjs,ts}',
  'src/content/gitTracking.ts',
  'src/features/egregore/**/*.server.ts',
  'src/features/egregore/corpus/{astro,build,segment}.ts',
  'src/features/egregore/runtime/modelDelivery.ts',
  'src/pages/**/*.ts',
];

const testFiles = ['tests/**/*.{ts,tsx}'];

const typescriptRecommended = tseslint.configs.recommended.map((config) => ({
  ...config,
  files: typedFiles,
}));

const jsxA11yRecommended = jsxA11y.flatConfigs.recommended;

export default [
  {
    name: 'jet-web/ignores',
    ignores: [
      'node_modules/**',
      'dist/**',
      '.astro/**',
      '.vercel/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      '.superpowers/**',
      'Untracked/**',
      'docs/archive/**',
      'docs/verification/baselines/**',
      'LICENSES/**',
      'THIRD_PARTY_NOTICES.md',
      'src/data/**/*.mdx',
      'public/images-staging/**',
      'package-lock.json',
    ],
  },
  {
    ...js.configs.recommended,
    name: 'jet-web/javascript',
    files: codeFiles,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
  },
  ...typescriptRecommended,
  ...eslintPluginAstro.configs.recommended,
  {
    name: 'jet-web/browser-globals',
    files: browserFiles,
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    name: 'jet-web/node-globals',
    files: nodeFiles,
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    name: 'jet-web/test-globals',
    files: testFiles,
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    name: 'jet-web/typescript-conventions',
    files: typedFiles,
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    name: 'jet-web/astro-inline-script-boundary',
    files: [
      'src/components/seo/GoogleAnalytics.astro',
      'src/components/seo/GoogleAnalytics.astro/*.{js,ts}',
    ],
    rules: {
      // `define:vars` injects a runtime binding that astro-eslint-parser reports as unused.
      '@typescript-eslint/no-unused-vars': 'off',
      // Preserve Google's documented `gtag` shim, which deliberately forwards `arguments`.
      'prefer-rest-params': 'off',
    },
  },
  {
    name: 'jet-web/react',
    files: ['**/*.tsx'],
    plugins: {
      ...jsxA11yRecommended.plugins,
      'react-hooks': reactHooks,
    },
    languageOptions: {
      ...jsxA11yRecommended.languageOptions,
      globals: globals.browser,
    },
    rules: {
      ...jsxA11yRecommended.rules,
      'react-hooks/exhaustive-deps': 'error',
      'react-hooks/rules-of-hooks': 'error',
    },
  },
  eslintConfigPrettier,
];
