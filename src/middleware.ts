import { defineMiddleware } from 'astro:middleware';
import { tickNotifications } from './lib/notifications';

const globalForTicker = globalThis as unknown as { __laundryTicker?: boolean };

export const onRequest = defineMiddleware((_context, next) => {
  if (!globalForTicker.__laundryTicker) {
    globalForTicker.__laundryTicker = true;
    setInterval(() => {
      tickNotifications().catch((error) => console.error('tick failed', error));
    }, 60_000);
  }
  return next();
});
