import globals from 'globals';
import tseslint from 'typescript-eslint';
import rootConfig from '../../eslint.config.js';

export default tseslint.config(
  ...rootConfig,
  { ignores: ['src/tools/generic-mint-circuit'] },
  {
    languageOptions: {
      globals: globals.node,
    },
  },
);
