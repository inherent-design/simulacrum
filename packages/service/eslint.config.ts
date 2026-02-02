import js from '@eslint/js'
import { defineConfig } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig([
  tseslint.configs.recommended,
  {
    files: ['src/{**,*}/*.ts'],
    languageOptions: {
      globals: {
        ...globals.nodeBuiltin,
      },
    },
    plugins: {
      js,
    },
    extends: ['js/recommended'],
  },
])
