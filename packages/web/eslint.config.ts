import js from '@eslint/js'
import reactPlugin from 'eslint-plugin-react'
import { defineConfig } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig([
  tseslint.configs.recommended,
  reactPlugin.configs.flat.recommended,
  {
    files: ['src/{**,*}/*.ts'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      js,
      reactPlugin,
    },
    extends: ['js/recommended'],
  },
])
