import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  dts: false,
  clean: true,
  minify: false,
  external: ['pg'],
  banner: {
    js: '#!/usr/bin/env node',
  },
});
