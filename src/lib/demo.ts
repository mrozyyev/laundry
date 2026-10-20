import type { MachineState } from './state';

export function demoState(now = Date.now()): MachineState {
  return {
    machine: 'washer',
    status: 'running',
    headline: '37 min left',
    detail: 'Demo snapshot · 37 minutes left on the display.',
    meta: 'Static preview · Beko B300 9 kg · nothing is saved',
    warning: null,
    freshness: 'fresh',
    isOpen: true,
    opensAt: now - 2 * 60 * 60_000,
    closesAt: now + 3 * 60 * 60_000,
    nextOpensAt: now + 20 * 60 * 60_000,
    lastReportAt: now,
    lastKind: 'running',
    endsAt: now + 37 * 60_000,
    overdueSince: null,
    minutesLeft: 37,
    now
  };
}
