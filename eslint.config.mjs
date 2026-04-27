import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/.expo/**',
      '**/coverage/**',
      '**/node_modules/**',
      'apps/mobile/jest.config.js',
      'apps/mobile/jest.preSetup.js',
      'apps/mobile/jest.errorGuardMock.js',
      'apps/mobile/jest.expoModulesMock.js',
      'apps/mobile/jest.uuidMock.js',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    // React Native runs in JS engines that are neither pure browser nor pure node.
    // Browser globals are the closest match; node-specific globals are rarely needed in app code.
    files: ['apps/mobile/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
  },
  prettier,
);
