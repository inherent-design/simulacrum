import { defineConfig } from 'tsdown'

export default defineConfig({
  dts: true,
  clean: true,
  unbundle: true,
  exports: true,
})
