import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

try {
  const path = resolve(process.cwd(), '.env');
  if (existsSync(path)) {
    process.loadEnvFile(path);
  }
} catch (error) {
  console.warn('Could not load .env:', error);
}
