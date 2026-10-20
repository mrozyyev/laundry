import './env';
import webpush from 'web-push';
import { db, type Subscription } from './db';

const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:laundry@example.com';

export function publicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

function configure(): boolean {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(SUBJECT, pub, priv);
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  tag?: string;
  url?: string;
}

export async function sendPush(
  payload: PushPayload,
  pref: 'free' | 'overdue'
): Promise<number> {
  if (!configure()) {
    console.warn('VAPID keys missing; push skipped');
    return 0;
  }

  const column = pref === 'free' ? 'notify_free' : 'notify_overdue';
  const subs = db
    .prepare(`SELECT * FROM subscriptions WHERE ${column} = 1`)
    .all() as Subscription[];

  let sent = 0;
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth }
          },
          JSON.stringify(payload),
          { TTL: 3600 }
        );
        sent += 1;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          db.prepare('DELETE FROM subscriptions WHERE id = ?').run(sub.id);
        } else {
          console.error('push failed', status ?? error);
        }
      }
    })
  );

  return sent;
}
