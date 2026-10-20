export const TZ = process.env.TZ_NAME || 'Europe/Bucharest';

export interface LocalParts {
  year: number;
  month: number;
  day: number;
  weekday: number;
  hour: number;
  minute: number;
}

export interface ScheduleInfo {
  isOpen: boolean;
  opensAt: number | null;
  closesAt: number | null;
  nextOpensAt: number;
  localDateKey: string;
}

const HOURS: Record<number, [number, number, number, number] | undefined> = {
  1: [7, 0, 14, 30],
  2: [7, 0, 14, 30],
  3: [7, 0, 14, 30],
  4: [7, 0, 14, 30],
  5: [7, 0, 12, 0]
};

function localParts(date: Date, timeZone: string): LocalParts {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  const map: Record<string, number> = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== 'literal') map[part.type] = Number(part.value);
  }
  const weekday = new Date(Date.UTC(map.year, map.month - 1, map.day)).getUTCDay();
  return {
    year: map.year,
    month: map.month,
    day: map.day,
    weekday,
    hour: map.hour % 24,
    minute: map.minute
  };
}

function offsetMs(date: Date, timeZone: string): number {
  const p = localParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return asUtc - Math.floor(date.getTime() / 60000) * 60000;
}

export function zonedToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone = TZ
): number {
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  let ts = guess - offsetMs(new Date(guess), timeZone);
  ts = guess - offsetMs(new Date(ts), timeZone);
  return ts;
}

export function getSchedule(now: Date = new Date()): ScheduleInfo {
  const p = localParts(now, TZ);
  const nowMs = now.getTime();
  const today = HOURS[p.weekday];

  let opensAt: number | null = null;
  let closesAt: number | null = null;

  if (today) {
    const open = zonedToUtc(p.year, p.month, p.day, today[0], today[1]);
    const close = zonedToUtc(p.year, p.month, p.day, today[2], today[3]);
    if (nowMs >= open && nowMs < close) {
      opensAt = open;
      closesAt = close;
    }
  }

  let nextOpensAt = nowMs;
  for (let i = 0; i <= 7; i += 1) {
    const day = new Date(Date.UTC(p.year, p.month - 1, p.day + i));
    const hours = HOURS[day.getUTCDay()];
    if (!hours) continue;
    const open = zonedToUtc(
      day.getUTCFullYear(),
      day.getUTCMonth() + 1,
      day.getUTCDate(),
      hours[0],
      hours[1]
    );
    if (open > nowMs) {
      nextOpensAt = open;
      break;
    }
  }

  return {
    isOpen: opensAt !== null,
    opensAt,
    closesAt,
    nextOpensAt,
    localDateKey: `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
  };
}

export function formatTime(ts: number): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date(ts));
}

export function formatWhen(ts: number, now = Date.now()): string {
  const p = localParts(new Date(ts), TZ);
  const n = localParts(new Date(now), TZ);
  const sameDay = p.year === n.year && p.month === n.month && p.day === n.day;
  const tomorrow = new Date(Date.UTC(n.year, n.month - 1, n.day + 1));
  const isTomorrow =
    p.year === tomorrow.getUTCFullYear() &&
    p.month === tomorrow.getUTCMonth() + 1 &&
    p.day === tomorrow.getUTCDate();

  const dayName = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    weekday: 'short'
  }).format(new Date(ts));

  if (sameDay) return `today at ${formatTime(ts)}`;
  if (isTomorrow) return `tomorrow at ${formatTime(ts)}`;
  return `${dayName} at ${formatTime(ts)}`;
}

export function formatAgo(ts: number, now = Date.now()): string {
  const mins = Math.max(0, Math.floor((now - ts) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  if (hours < 24) return rest ? `${hours} h ${rest} min ago` : `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} d ago`;
}

export function formatDuration(mins: number): string {
  if (mins < 1) return 'less than a minute';
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}
