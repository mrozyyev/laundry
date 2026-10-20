import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  srcDir: './src-preview',
  outDir: './dist-preview',
  base: '/laundry',
  build: { format: 'directory' }
});
