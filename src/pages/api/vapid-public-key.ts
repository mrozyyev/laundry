import type { APIRoute } from 'astro';
import { publicKey } from '../../lib/push';

export const prerender = false;

export const GET: APIRoute = () => {
  const key = publicKey();
  if (!key) {
    return Response.json(
      { error: 'Push is not configured. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.' },
      { status: 503 }
    );
  }
  return Response.json({ key }, { headers: { 'cache-control': 'no-store' } });
};
