import './env';
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const dbPath = process.env.DB_PATH || resolve(process.cwd(), 'data/laundry.db');
mkdirSync(dirname(dbPath), { recursive: true });

const globalForDb = globalThis as unknown as { __laundryDb?: Database.Database };

function create(): Database.Database {
  const database = new Database(dbPath);
  database.pragma('journal_mode = WAL');
  database.exec(`
    CREATE TABLE IF NOT EXISTS observations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      machine_id TEXT NOT NULL DEFAULT 'washer',
      kind TEXT NOT NULL CHECK (kind IN ('running', 'free', 'done_with_clothes')),
      minutes_left INTEGER,
      created_at INTEGER NOT NULL,
      notified_free INTEGER NOT NULL DEFAULT 0,
      notified_overdue INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_obs_machine_time
      ON observations (machine_id, created_at DESC, id DESC);

    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      notify_free INTEGER NOT NULL DEFAULT 1,
      notify_overdue INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );
  `);
  return database;
}

export const db = globalForDb.__laundryDb ?? (globalForDb.__laundryDb = create());

export type ObservationKind = 'running' | 'free' | 'done_with_clothes';

export interface Observation {
  id: number;
  machine_id: string;
  kind: ObservationKind;
  minutes_left: number | null;
  created_at: number;
  notified_free: number;
  notified_overdue: number;
}

export interface Subscription {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
  notify_free: number;
  notify_overdue: number;
  created_at: number;
}
