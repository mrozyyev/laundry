import { db, type Observation, type ObservationKind } from './db';
import { formatAgo, formatDuration, formatTime, formatWhen, getSchedule } from './time';

export type Status =
  | 'closed'
  | 'unknown'
  | 'free'
  | 'running'
  | 'likely_free'
  | 'clothes_inside';

export type Freshness = 'fresh' | 'aging' | 'stale';

export interface MachineState {
  machine: string;
  status: Status;
  headline: string;
  detail: string;
  meta: string;
  warning: string | null;
  freshness: Freshness;
  isOpen: boolean;
  opensAt: number | null;
  closesAt: number | null;
  nextOpensAt: number;
  lastReportAt: number | null;
  lastKind: ObservationKind | null;
  endsAt: number | null;
  overdueSince: number | null;
  minutesLeft: number | null;
  now: number;
}

const MINUTE = 60_000;
const DEFAULT_MINUTES = 60;

export function latestObservation(
  machineId: string,
  since: number
): Observation | undefined {
  return db
    .prepare(
      `SELECT * FROM observations
       WHERE machine_id = ? AND created_at >= ?
       ORDER BY created_at DESC, id DESC
       LIMIT 1`
    )
    .get(machineId, since) as Observation | undefined;
}

function freshnessOf(ageMs: number): Freshness {
  if (ageMs <= 20 * MINUTE) return 'fresh';
  if (ageMs <= 90 * MINUTE) return 'aging';
  return 'stale';
}

function base(machine: string, now: number): MachineState {
  return {
    machine,
    now,
    status: 'unknown',
    headline: '',
    detail: '',
    meta: '',
    warning: null,
    freshness: 'stale',
    isOpen: false,
    opensAt: null,
    closesAt: null,
    nextOpensAt: now,
    lastReportAt: null,
    lastKind: null,
    endsAt: null,
    overdueSince: null,
    minutesLeft: null
  };
}

function computeState(machineId = 'washer', nowMs = Date.now()): MachineState {
  const schedule = getSchedule(new Date(nowMs));
  const state = base(machineId, nowMs);

  state.isOpen = schedule.isOpen;
  state.opensAt = schedule.opensAt;
  state.closesAt = schedule.closesAt;
  state.nextOpensAt = schedule.nextOpensAt;

  const lastAny = db
    .prepare(
      `SELECT * FROM observations
       WHERE machine_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT 1`
    )
    .get(machineId) as Observation | undefined;

  if (!schedule.isOpen) {
    const leftInside =
      lastAny &&
      lastAny.kind === 'done_with_clothes' &&
      nowMs - lastAny.created_at < 24 * 60 * MINUTE;

    return {
      ...state,
      status: 'closed',
      headline: 'Room closed',
      detail: `Opens ${formatWhen(schedule.nextOpensAt, nowMs)}.`,
      warning: leftInside
        ? `Clothes were last seen inside at ${formatTime(lastAny.created_at)}. They may still be there at opening.`
        : null,
      lastReportAt: lastAny?.created_at ?? null,
      lastKind: lastAny?.kind ?? null
    };
  }

  const obs = latestObservation(machineId, schedule.opensAt ?? 0);

  if (!obs) {
    const carried =
      lastAny && lastAny.kind === 'done_with_clothes' && nowMs - lastAny.created_at < 36 * 60 * MINUTE;

    return {
      ...state,
      status: 'unknown',
      headline: 'No reports yet',
      detail: 'Nobody has checked the room since it opened.',
      warning: carried
        ? `Last report: clothes inside at ${formatTime(lastAny.created_at)}. Check before you start a wash.`
        : null
    };
  }

  const age = nowMs - obs.created_at;
  state.lastReportAt = obs.created_at;
  state.lastKind = obs.kind;
  state.freshness = freshnessOf(age);

  if (obs.kind === 'free') {
    return {
      ...state,
      status: 'free',
      headline: 'Free',
      detail:
        state.freshness === 'stale'
          ? `Confirmed ${formatAgo(obs.created_at, nowMs)} — nobody has checked since.`
          : `Confirmed ${formatAgo(obs.created_at, nowMs)}.`
    };
  }

  if (obs.kind === 'done_with_clothes') {
    const overdue = Math.max(0, Math.floor(age / MINUTE));
    state.overdueSince = obs.created_at;
    return {
      ...state,
      status: 'clothes_inside',
      headline: 'Clothes inside',
      detail:
        overdue < 1
          ? `Just reported as finished with clothes still inside · ${formatAgo(obs.created_at, nowMs)}.`
          : `Sitting there at least ${formatDuration(overdue)} · last checked ${formatAgo(obs.created_at, nowMs)}.`
    };
  }

  const minutes = obs.minutes_left ?? DEFAULT_MINUTES;
  const endsAt = obs.created_at + minutes * MINUTE;
  state.endsAt = endsAt;
  state.minutesLeft = Math.max(0, Math.ceil((endsAt - nowMs) / MINUTE));

  const closeConflict =
    schedule.closesAt !== null && endsAt > schedule.closesAt
      ? `This cycle won't finish before the room closes at ${formatTime(schedule.closesAt)}. Clothes will be locked in overnight.`
      : null;
  state.warning = closeConflict;

  if (nowMs < endsAt) {
    return {
      ...state,
      status: 'running',
      headline: `${state.minutesLeft} min left`,
      detail: `Seen running ${formatAgo(obs.created_at, nowMs)} · ends around ${formatTime(endsAt)}.`
    };
  }

  return {
    ...state,
    status: 'likely_free',
    headline: 'Should be free',
    detail: `Ended around ${formatTime(endsAt)} · last seen running ${formatAgo(obs.created_at, nowMs)}. Nobody has confirmed yet.`,
    warning:
      state.freshness === 'stale'
        ? 'This report is old. Check the machine before trusting it.'
        : closeConflict
  };
}

function metaFor(state: MachineState): string {
  const parts: string[] = [];
  if (state.isOpen && state.closesAt !== null) {
    const left = Math.max(0, Math.ceil((state.closesAt - state.now) / 60_000));
    parts.push(`Open until ${formatTime(state.closesAt)}`);
    parts.push(`closes in ${formatDuration(left)}`);
  } else {
    parts.push(`Opens ${formatWhen(state.nextOpensAt, state.now)}`);
  }
  if (state.lastReportAt !== null) {
    parts.push(`last report ${formatAgo(state.lastReportAt, state.now)}`);
  }
  return parts.join(' · ');
}

export function getState(machineId = 'washer', nowMs = Date.now()): MachineState {
  const state = computeState(machineId, nowMs);
  state.meta = metaFor(state);
  return state;
}
