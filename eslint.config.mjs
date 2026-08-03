import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'admin-dashboard/**', 'coverage/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // The Shopify GraphQL responses are untyped; `any` is used deliberately.
      '@typescript-eslint/no-explicit-any': 'off',
      // Allow intentionally unused args/vars when prefixed with `_`.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },
  // Turn off stylistic rules that conflict with Prettier (keep last).
  prettier
);
