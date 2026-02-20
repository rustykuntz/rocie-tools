import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/voice-call-cli.ts'],
  format: ['cjs'],
  target: 'es2020',
  noExternal: [],
  external: [/^[^./]/],
});
