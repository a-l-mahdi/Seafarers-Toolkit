import * as SQLite from 'expo-sqlite';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS ranks (
  id TEXT PRIMARY KEY,
  department TEXT NOT NULL,
  name TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS profile (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  date_of_birth TEXT,
  nationality TEXT,
  email TEXT,
  phone TEXT,
  seaman_book_number TEXT,
  passport_number TEXT,
  department TEXT,
  current_rank_id TEXT,
  next_rank_id TEXT,
  photo_path TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vessels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  imo TEXT,
  type TEXT,
  flag TEXT,
  gross_tonnage INTEGER,
  net_tonnage INTEGER,
  owner TEXT,
  management_company TEXT,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contracts (
  id TEXT PRIMARY KEY,
  vessel_id TEXT NOT NULL REFERENCES vessels(id) ON DELETE SET NULL,
  rank_id TEXT REFERENCES ranks(id) ON DELETE SET NULL,
  join_date TEXT NOT NULL,
  expected_sign_off TEXT NOT NULL,
  actual_sign_off TEXT,
  duration_days INTEGER,
  status TEXT NOT NULL DEFAULT 'planned',
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sea_time_records (
  id TEXT PRIMARY KEY,
  contract_id TEXT REFERENCES contracts(id) ON DELETE CASCADE,
  rank_id TEXT REFERENCES ranks(id) ON DELETE SET NULL,
  source TEXT NOT NULL,
  from_date TEXT,
  to_date TEXT,
  days INTEGER NOT NULL DEFAULT 0,
  hours INTEGER NOT NULL DEFAULT 0,
  verified INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS document_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  type_id TEXT REFERENCES document_types(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  number TEXT,
  issue_date TEXT,
  expiry_date TEXT,
  issuing_authority TEXT,
  issuing_country TEXT,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS document_files (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  local_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  event_id TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  scheduled_at TEXT,
  sent_at TEXT,
  read_at TEXT,
  dismissed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_dedupe
  ON notifications(event_type, event_id, notification_type);

CREATE INDEX IF NOT EXISTS idx_contracts_join ON contracts(join_date);
CREATE INDEX IF NOT EXISTS idx_documents_expiry ON documents(expiry_date);
CREATE INDEX IF NOT EXISTS idx_sea_time_rank ON sea_time_records(rank_id);
`;

export async function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('seafarer.db');
      await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
      await db.execAsync(SCHEMA);
      await seedDefaults(db);
      return db;
    })();
  }
  return dbPromise;
}

async function seedDefaults(db: SQLite.SQLiteDatabase): Promise<void> {
  const rankCount = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) AS c FROM ranks');
  if (!rankCount || rankCount.c === 0) {
    const defaultRanks: [string, string, number][] = [
      ['Captain', 'deck', 1],
      ['Chief Officer', 'deck', 2],
      ['2nd Officer', 'deck', 3],
      ['3rd Officer', 'deck', 4],
      ['Deck Cadet', 'deck', 5],
      ['Chief Engineer', 'engine', 1],
      ['2nd Engineer', 'engine', 2],
      ['3rd Engineer', 'engine', 3],
      ['4th Engineer', 'engine', 4],
      ['Engine Cadet', 'engine', 5],
      ['ETO', 'electro', 1],
      ['ETR', 'electro', 2],
      ['Bosun', 'other', 3],
      ['AB (Able Seafarer)', 'other', 4],
      ['OS (Ordinary Seafarer)', 'other', 5],
    ];
    for (const [name, department, level] of defaultRanks) {
      await db.runAsync(
        'INSERT OR IGNORE INTO ranks (id, department, name, level, is_default) VALUES (?, ?, ?, ?, 1)',
        `rank_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
        department,
        name,
        level
      );
    }
  }

  const docTypeCount = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) AS c FROM document_types');
  if (!docTypeCount || docTypeCount.c === 0) {
    const defaultTypes = [
      'Passport',
      "Seaman's Book",
      'STCW',
      'Certificate of Competency',
      'Medical Certificate',
      'GMDSS',
      'Basic Safety Training',
      'Advanced Fire Fighting',
      'Proficiency in Survival Craft',
      'Visa',
    ];
    for (const name of defaultTypes) {
      await db.runAsync(
        'INSERT OR IGNORE INTO document_types (id, name, is_default) VALUES (?, ?, 1)',
        `doctype_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
        name
      );
    }
  }
}
