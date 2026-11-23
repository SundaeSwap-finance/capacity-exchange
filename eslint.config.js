import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

const TEST_FILES = ['**/*.test.ts', '**/*.test.tsx', '**/tests/**', '**/mocks/**'];

// The only modules that read process.env. Everything else takes configuration as a value.
const ENV_READERS = [
  'apps/server/src/config/env.ts',
  'apps/server/src/config/logger.ts',
  'apps/server/src/loadConfig.ts',
  'apps/funder-cli/src/config.ts',
  'packages/midnight-node/src/appConfig.ts',
];

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    ignores: ['**/dist/**', '**/out/**', '**/node_modules/**', '**/generated/**', 'vendor/**', '**/jest.config.js'],
  },
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'max-len': [
        'error',
        { code: 120, comments: 120, ignoreUrls: true, ignoreStrings: true, ignoreTemplateLiterals: true },
      ],
      curly: 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },
  // Rules that need type information.
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      // React event handlers may be async: React ignores what they return.
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],
      '@typescript-eslint/no-base-to-string': 'error',
      '@typescript-eslint/restrict-template-expressions': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': ['error', { considerDefaultExhaustiveForUnions: true }],
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message:
            'Read configuration through the config module of this app, or resolveEnv() from ' +
            '@sundaeswap/capacity-exchange-nodejs, so that every setting is declared in one place.',
        },
      ],
    },
  },
  {
    files: ENV_READERS,
    rules: {
      'no-restricted-properties': 'off',
    },
  },
  // The demo apps report the type-aware rules without failing the check.
  {
    files: ['apps/demo/**/*.{ts,tsx}', 'apps/dashboard/**/*.{ts,tsx}', 'examples/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-misused-promises': ['warn', { checksVoidReturn: { attributes: false } }],
      '@typescript-eslint/no-base-to-string': 'warn',
      '@typescript-eslint/restrict-template-expressions': 'warn',
    },
  },
  // Relaxed rules for test files
  {
    files: TEST_FILES,
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-base-to-string': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
    },
  },
  // Test harnesses and repo scripts are configured through the environment directly.
  {
    files: [...TEST_FILES, 'apps/tests/**', 'scripts/**', '**/scripts/**'],
    rules: {
      'no-restricted-properties': 'off',
    },
  }
);
