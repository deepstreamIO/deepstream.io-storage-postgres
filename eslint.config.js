// @ts-check
const { defineConfig, globalIgnores } = require('eslint/config')
const tseslint = require('typescript-eslint')
const stylistic = /** @type {import('eslint').ESLint.Plugin} */ (require('@stylistic/eslint-plugin'))

module.exports = defineConfig(
  globalIgnores(['dist/**', 'node_modules/**']),
  tseslint.configs.recommended,
  {
    plugins: { '@stylistic': stylistic },
    rules: {
      '@stylistic/indent': ['error', 2],
      '@stylistic/semi': ['error', 'never'],
      '@stylistic/quotes': ['error', 'single', { avoidEscape: true, allowTemplateLiterals: 'never' }],
      '@stylistic/arrow-parens': ['error', 'always'],
      '@stylistic/new-parens': 'error',
      '@stylistic/no-multiple-empty-lines': ['error', { max: 1 }],
      '@stylistic/no-trailing-spaces': 'error',
      '@stylistic/space-before-function-paren': ['error', 'always'],

      'no-undef-init': 'error',
      'one-var': ['error', 'never'],
      'prefer-const': 'error',
      'no-console': 'error',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-new': 'warn',
      'prefer-arrow-callback': 'warn',

      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
    }
  }
)
