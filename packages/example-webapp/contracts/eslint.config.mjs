import js from '@eslint/js';
import plugin from '@typescript-eslint/eslint-plugin';
import parser from '@typescript-eslint/parser';

export default [
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    ignores: ['**/out/**', 'node_modules/**'],
    languageOptions: {
      parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: ['./tsconfig.json'],
      },
      globals: {
        process: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        setTimeout: 'readonly',
        console: 'readonly',
        TextEncoder: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': plugin,
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-unused-vars': 'off',
    },
  },
  {
    ignores: ['**/out/**', 'node_modules/**'],
  },
];
