import type { APIRoute } from 'astro';
import { tickNotifications } from '../../lib/notifications';

export const prerender = false;

export const POST: APIRoute = async () => {
  await tickNotifications();
  return Response.json({ ok: true });
};
