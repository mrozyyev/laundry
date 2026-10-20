import type { APIRoute } from 'astro';
import { recordObservation } from '../../lib/notifications';
import type { ObservationKind } from '../../lib/db';

export const prerender = false;

const KINDS: ObservationKind[] = ['running', 'free', 'done_with_clothes'];

export const POST: APIRoute = async ({ request }) => {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const kind = body.kind as ObservationKind;
  if (!KINDS.includes(kind)) {
    return Response.json(
      { error: 'kind must be running, free or done_with_clothes' },
      { status: 400 }
    );
  }

  let minutes: number | null = null;
  if (kind === 'running') {
    minutes = Math.round(Number(body.minutes));
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 600) {
      return Response.json(
        { error: 'minutes must be between 1 and 600' },
        { status: 400 }
      );
    }
  }

  const state = recordObservation('washer', kind, minutes);
  return Response.json(state, { headers: { 'cache-control': 'no-store' } });
};
