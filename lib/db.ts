import { SupabaseDB } from './db-supabase';

const DB_PROVIDER = process.env.DATABASE_PROVIDER || 'sqlite';

type AnyDB = import('./db-sqlite').SQLiteDB | SupabaseDB;

let _instance: AnyDB | null = null;

export function getDB(): AnyDB {
  if (!_instance) {
    if (DB_PROVIDER === 'supabase') {
      _instance = new SupabaseDB();
    } else {
      // Dynamic require keeps db-sqlite out of the production bundle trace
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { SQLiteDB } = require('./db-sqlite') as typeof import('./db-sqlite');
      _instance = new SQLiteDB();
    }
  }
  return _instance;
}

export const db = {
  get instance() { return getDB(); }
};
