import type { APIRoute } from 'astro';
import { db } from '../../lib/db';

export const prerender = false;

interface Body {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
  prefs?: { free?: unknown; overdue?: unknown };
}

export const POST: APIRoute = async ({ request }) => {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const endpoint = body.endpoint;
  const p256dh = body.keys?.p256dh;
  const auth = body.keys?.auth;

  if (typeof endpoint !== 'string' || !endpoint.startsWith('https://')) {
    return Response.json({ error: 'Invalid endpoint' }, { status: 400 });
  }
  if (typeof p256dh !== 'string' || typeof auth !== 'string') {
    return Response.json({ error: 'Missing subscription keys' }, { status: 400 });
  }

  const notifyFree = body.prefs?.free === false ? 0 : 1;
  const notifyOverdue = body.prefs?.overdue === false ? 0 : 1;

  db.prepare(
    `INSERT INTO subscriptions (endpoint, p256dh, auth, notify_free, notify_overdue, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET
       p256dh = excluded.p256dh,
       auth = excluded.auth,
       notify_free = excluded.notify_free,
       notify_overdue = excluded.notify_overdue`
  ).run(endpoint, p256dh, auth, notifyFree, notifyOverdue, Date.now());

  return Response.json({ ok: true });
};

export const DELETE: APIRoute = async ({ request }) => {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (typeof body.endpoint !== 'string') {
    return Response.json({ error: 'Invalid endpoint' }, { status: 400 });
  }
  db.prepare('DELETE FROM subscriptions WHERE endpoint = ?').run(body.endpoint);
  return Response.json({ ok: true });
};
