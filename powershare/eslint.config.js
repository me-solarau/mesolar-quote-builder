import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import react from 'eslint-plugin-react'

/**
 * The build does not fail on an undefined identifier — Vite happily bundles a
 * reference that will throw the moment the component renders. This config
 * exists mainly for `no-undef` and the rules-of-hooks checks, which are the two
 * mistakes that reach the browser silently.
 */
export default [
  { ignores: ['dist/**', 'node_modules/**'] },
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } }
    },
    plugins: { 'react-hooks': reactHooks, react },
    settings: { react: { version: '19.0' } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Without these, every component referenced only from JSX reads as unused.
      'react/jsx-uses-react': 'error',
      'react/jsx-uses-vars': 'error',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'react-hooks/exhaustive-deps': 'warn'
    }
  },
  {
    files: ['src/**/*.test.js'],
    languageOptions: { globals: { ...globals.node } }
  }
]
