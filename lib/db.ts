import { SQLiteDB } from './db-sqlite';
import { SupabaseDB } from './db-supabase';

const DB_PROVIDER = process.env.DATABASE_PROVIDER || 'sqlite';

type AnyDB = SQLiteDB | SupabaseDB;

let _instance: AnyDB | null = null;

export function getDB(): AnyDB {
  if (!_instance) {
    _instance = DB_PROVIDER === 'supabase' ? new SupabaseDB() : new SQLiteDB();
  }
  return _instance;
}

export const db = {
  get instance() { return getDB(); }
};
