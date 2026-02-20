import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/elevenlabs-call-cli.ts'],
  format: ['cjs'],
  target: 'es2020',
  noExternal: [],
  external: [/^[^./]/],
});
