import { SupabaseDB } from './db-supabase';

const DB_PROVIDER = process.env.DATABASE_PROVIDER || 'sqlite';

type AnyDB = import('./db-sqlite').SQLiteDB | SupabaseDB;

let _instance: AnyDB | null = null;

export function getDB(): AnyDB {
  if (!_instance) {
    if (DB_PROVIDER === 'supabase') {
      _instance = new SupabaseDB();
    } else {
      // turbopackIgnore prevents Turbopack from tracing db-sqlite.ts in the
      // production bundle — SQLite is only used in local dev (DATABASE_PROVIDER=sqlite)
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { SQLiteDB } = require(/* turbopackIgnore: true */ './db-sqlite') as typeof import('./db-sqlite');
      _instance = new SQLiteDB();
    }
  }
  return _instance;
}

export const db = {
  get instance() { return getDB(); }
};
