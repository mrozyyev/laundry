import { db, type Observation, type ObservationKind } from './db';
import { sendPush } from './push';
import { getState, latestObservation, type MachineState } from './state';
import { formatTime, getSchedule } from './time';

const MINUTE = 60_000;
const OVERDUE_AFTER = 30 * MINUTE;
const NOTIFY_WINDOW = 2 * 60 * MINUTE;

export function recordObservation(
  machineId: string,
  kind: ObservationKind,
  minutesLeft: number | null,
  nowMs = Date.now()
): MachineState {
  const schedule = getSchedule(new Date(nowMs));
  const previous = latestObservation(machineId, schedule.opensAt ?? 0);

  db.prepare(
    `INSERT INTO observations (machine_id, kind, minutes_left, created_at)
     VALUES (?, ?, ?, ?)`
  ).run(machineId, kind, minutesLeft, nowMs);

  if (kind === 'free') {
    const alreadyFree =
      previous?.kind === 'free' && nowMs - previous.created_at < 10 * MINUTE;
    if (!alreadyFree) {
      void sendPush(
        {
          title: 'Machine is free',
          body: 'Someone just confirmed it is empty. Go now.',
          tag: 'laundry-free',
          url: '/'
        },
        'free'
      );
    }
  }

  return getState(machineId, nowMs);
}

const LATEST_ID = `(
  SELECT x.id FROM observations x
  WHERE x.machine_id = o.machine_id
  ORDER BY x.created_at DESC, x.id DESC
  LIMIT 1
)`;

export async function tickNotifications(nowMs = Date.now()): Promise<void> {
  const schedule = getSchedule(new Date(nowMs));
  if (!schedule.isOpen || schedule.opensAt === null) return;

  const due = db
    .prepare(
      `SELECT o.* FROM observations o
       WHERE o.kind = 'running'
         AND o.notified_free = 0
         AND o.created_at >= ?
         AND o.id = ${LATEST_ID}
         AND o.created_at + COALESCE(o.minutes_left, 60) * 60000 <= ?
         AND o.created_at + COALESCE(o.minutes_left, 60) * 60000 >= ?`
    )
    .all(schedule.opensAt, nowMs, nowMs - NOTIFY_WINDOW) as Observation[];

  for (const obs of due) {
    db.prepare('UPDATE observations SET notified_free = 1 WHERE id = ?').run(obs.id);
    const endsAt = obs.created_at + (obs.minutes_left ?? 60) * MINUTE;
    await sendPush(
      {
        title: 'Machine should be free',
        body: `Cycle ended around ${formatTime(endsAt)}. Unconfirmed — check before walking over.`,
        tag: `laundry-free-${obs.id}`,
        url: '/'
      },
      'free'
    );
  }

  db.prepare(
    `UPDATE observations
     SET notified_free = 1
     WHERE kind = 'running'
       AND notified_free = 0
       AND created_at + COALESCE(minutes_left, 60) * 60000 < ?`
  ).run(nowMs - NOTIFY_WINDOW);

  const overdue = db
    .prepare(
      `SELECT o.* FROM observations o
       WHERE o.kind = 'done_with_clothes'
         AND o.notified_overdue = 0
         AND o.created_at >= ?
         AND o.id = ${LATEST_ID}
         AND ? - o.created_at >= ?`
    )
    .all(schedule.opensAt, nowMs, OVERDUE_AFTER) as Observation[];

  for (const obs of overdue) {
    db.prepare('UPDATE observations SET notified_overdue = 1 WHERE id = ?').run(obs.id);
    await sendPush(
      {
        title: 'Clothes still inside',
        body: `Reported finished at ${formatTime(obs.created_at)} and not collected. If you need the machine, the app says it is fair to move them.`,
        tag: `laundry-overdue-${obs.id}`,
        url: '/'
      },
      'overdue'
    );
  }
}
