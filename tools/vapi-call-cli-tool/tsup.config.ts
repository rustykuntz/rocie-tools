import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/vapi-call-cli.ts'],
  format: ['cjs'],
  target: 'es2020',
  noExternal: [],
  external: [/^[^./]/],
});
