import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import prettier from 'eslint-config-prettier'

/**
 * Client lint config — React 18 with JSX, no TypeScript.
 *
 * `react-hooks/exhaustive-deps` is the rule that earns its keep here. This
 * codebase uses hooks heavily, and a missing dependency is a stale closure: an
 * effect that keeps reading the *first* render's props forever. That failure is
 * silent, intermittent, and nearly impossible to reproduce by hand — which is
 * exactly the kind of bug a linter should be finding instead of a customer.
 */
export default [
  {
    ignores: ['node_modules/**', 'dist/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: { react: { version: '18.3' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat['jsx-runtime'].rules, // no `import React` needed
      ...reactHooks.configs.recommended.rules,

      'no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],

      // The stale-closure rule. Warn rather than error so it cannot block a
      // deploy on a false positive, but it is read and acted on.
      'react-hooks/exhaustive-deps': 'warn',

      /**
       * Downgraded to a warning, deliberately, with the reason recorded.
       *
       * `set-state-in-effect` flags "derive state from props/query data inside an
       * effect", which is a performance and idiom recommendation, not a
       * correctness rule — the pattern it objects to works, it just costs an
       * extra render. It fires ~12 times across pages this project has not
       * otherwise touched, and rewriting each one would be a behavioural change
       * smuggled in under a tooling task.
       *
       * Kept visible rather than switched off: it is a real list of places worth
       * revisiting. Not silenced with twelve inline disables either — that would
       * hide the count and make the cleanup harder to find later.
       */
      'react-hooks/set-state-in-effect': 'warn',

      // Props are documented by the surrounding code and reviewed by hand;
      // prop-types on a codebase this size is noise, not safety.
      'react/prop-types': 'off',
      // Deliberate: the codebase uses ’ and — in copy, and escaping them would
      // make every string unreadable in source.
      'react/no-unescaped-entities': 'off',

      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      eqeqeq: ['error', 'smart'],
      'no-constant-binary-expression': 'error',
      'no-self-compare': 'error',
    },
  },
  prettier,
]
