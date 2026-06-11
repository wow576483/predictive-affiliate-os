export default [
  {
    files: ['src/**/*.js', 'test/**/*.js', 'scripts/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        URL: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  {
    // Apps Script glue runs in the GAS V8 global-scope runtime (no modules).
    files: ['src/appsscript/**/*.gs'],
    languageOptions: { ecmaVersion: 2020, sourceType: 'script' },
    ignores: [],
  },
];
