import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    ignores: ['**/dist/**', '**/out/**', '**/node_modules/**', '**/generated/**', 'vendor/**', '**/jest.config.js'],
  },
  {
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
  // Relaxed rules for test files
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/tests/**', '**/mocks/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  }
);
