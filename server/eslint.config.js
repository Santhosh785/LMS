import js from '@eslint/js'
import globals from 'globals'
import prettier from 'eslint-config-prettier'

/**
 * Server lint config.
 *
 * The rule selection is deliberate: **rules that catch bugs, not rules that
 * enforce taste.** Formatting is Prettier's job, and `eslint-config-prettier`
 * last in the array switches off everything that would fight it — two tools
 * disagreeing about a line break is how a lint step gets ignored.
 */
export default [
  {
    ignores: ['node_modules/**', '.mail-preview/**', 'coverage/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module', // package.json is "type": "module"
      globals: { ...globals.node },
    },
    rules: {
      // An unused variable is usually a half-finished edit. Leading-underscore
      // arguments are the established convention here for the deliberate ones
      // (see `errorHandler(err, req, res, _next)`).
      'no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      // The bug class this project is most exposed to: a forgotten await on a
      // database write or a mail send.
      'require-atomic-updates': 'error',
      'no-return-await': 'error',
      // An accidental global in a module that touches payments is not worth the
      // convenience it buys.
      'no-undef': 'error',
      'no-implicit-globals': 'error',
      // Real mistakes, not style.
      eqeqeq: ['error', 'smart'],
      'no-constant-binary-expression': 'error',
      'no-self-compare': 'error',
      'no-unmodified-loop-condition': 'error',
      'no-unreachable-loop': 'error',
      'no-template-curly-in-string': 'warn',
      'no-console': 'off', // deliberate: logging is the observability story here
    },
  },
  {
    files: ['tests/**/*.js', 'vitest.config.js'],
    languageOptions: {
      globals: { ...globals.node, ...globals.vitest },
    },
  },
  prettier,
]
