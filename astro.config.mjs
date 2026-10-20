import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  server: { host: true },
  vite: {
    ssr: {
      external: ['better-sqlite3', 'web-push']
    }
  }
});
