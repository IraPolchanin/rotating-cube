import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'playwright-report', 'test-results'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'three/examples/jsm/controls/OrbitControls',
                'three/examples/jsm/controls/OrbitControls.js',
                'three/addons/controls/OrbitControls',
                'three/addons/controls/OrbitControls.js',
              ],
              message:
                'OrbitControls must not be used. Rotate the cube mesh directly (NFR-8).',
            },
          ],
        },
      ],
    },
  },
)
