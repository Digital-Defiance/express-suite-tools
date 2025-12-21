import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

const sharedRules = {
  ...tseslint.configs.recommended.rules,
  '@typescript-eslint/no-explicit-any': 'off',
  '@typescript-eslint/no-unsafe-assignment': 'off',
  '@typescript-eslint/no-unsafe-call': 'off',
  '@typescript-eslint/no-unsafe-member-access': 'off',
  '@typescript-eslint/no-unsafe-return': 'off',
  '@typescript-eslint/no-unsafe-argument': 'off',
  '@typescript-eslint/no-unused-vars': [
    'error',
    {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_',
    },
  ],
};

export default [
  {
    ignores: ['dist/**', 'node_modules/**', '**/*.js', '**/*.d.ts'],
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: sharedRules,
  },
  {
    files: ['tests/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: './tsconfig.spec.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: sharedRules,
  },
];
