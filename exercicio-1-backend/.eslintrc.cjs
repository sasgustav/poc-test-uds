/**
 * ESLint strict++ — type-checked + sonarjs + unicorn.
 * Foco em pegar bugs, não debate de estilo (Prettier cuida de formato).
 */
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'sonarjs', 'unicorn', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended-type-checked',
    'plugin:@typescript-eslint/stylistic-type-checked',
    'plugin:sonarjs/recommended-legacy',
    'plugin:unicorn/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'prettier',
  ],
  root: true,
  env: { node: true, jest: true },
  ignorePatterns: ['.eslintrc.cjs', 'dist', 'coverage', 'reports', 'node_modules'],
  settings: {
    'import/resolver': { typescript: true, node: true },
  },
  rules: {
    '@typescript-eslint/consistent-type-imports': 'warn',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
    '@typescript-eslint/require-await': 'error',
    'sonarjs/cognitive-complexity': ['warn', 15],
    'unicorn/prevent-abbreviations': 'off', // PT-BR naming
    'unicorn/no-null': 'off', // TypeORM returns null
    'unicorn/filename-case': ['error', { cases: { kebabCase: true, pascalCase: true } }],
    'unicorn/no-array-reduce': 'off',
    'import/order': [
      'warn',
      {
        'newlines-between': 'never',
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        alphabetize: { order: 'asc' },
      },
    ],
  },
  overrides: [
    {
      files: ['test/**/*.ts', '**/*.spec.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unsafe-argument': 'off',
        '@typescript-eslint/no-unsafe-enum-comparison': 'off',
        '@typescript-eslint/require-await': 'off',
        'sonarjs/no-duplicate-string': 'off',
        'sonarjs/no-invalid-await': 'off',
        'sonarjs/void-use': 'off',
        'sonarjs/assertions-in-tests': 'off',
      },
    },
    {
      files: ['**/migrations/*.ts'],
      rules: {
        'unicorn/filename-case': 'off',
      },
    },
  ],
};
