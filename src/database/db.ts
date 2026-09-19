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
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  zip_code TEXT,
  landline TEXT,
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
  duration_json TEXT,
  monthly_wage REAL,
  wage_currency TEXT,
  travel_days INTEGER,
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
  place_of_issue TEXT,
  warning_threshold_days INTEGER,
  valid_threshold_days INTEGER,
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

CREATE TABLE IF NOT EXISTS trip_files (
  id TEXT PRIMARY KEY,
  contract_id TEXT REFERENCES contracts(id) ON DELETE CASCADE,
  sea_time_id TEXT REFERENCES sea_time_records(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'contract',
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
      await migrate(db);
      await seedDefaults(db);
      return db;
    })();
  }
  return dbPromise;
}

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const docCols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(documents)');
  const names = new Set(docCols.map((c) => c.name));
  if (!names.has('warning_threshold_days')) {
    await db.execAsync('ALTER TABLE documents ADD COLUMN warning_threshold_days INTEGER');
  }
  if (!names.has('valid_threshold_days')) {
    await db.execAsync('ALTER TABLE documents ADD COLUMN valid_threshold_days INTEGER');
  }
  const tables = await db.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'trip_files'"
  );
  if (tables.length === 0) {
    await db.execAsync(`CREATE TABLE IF NOT EXISTS trip_files (
      id TEXT PRIMARY KEY,
      contract_id TEXT REFERENCES contracts(id) ON DELETE CASCADE,
      sea_time_id TEXT REFERENCES sea_time_records(id) ON DELETE CASCADE,
      kind TEXT NOT NULL DEFAULT 'contract',
      local_path TEXT NOT NULL,
      file_name TEXT NOT NULL,
      mime_type TEXT,
      size INTEGER,
      created_at TEXT NOT NULL
    );`);
  }
  const contractCols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(contracts)');
  const contractNames = new Set(contractCols.map((c) => c.name));
  if (!contractNames.has('duration_json')) {
    // Stores the exact duration input (mode/days/months/custom date) so editing
    // a contract keeps its duration instead of resetting it to form defaults.
    await db.execAsync('ALTER TABLE contracts ADD COLUMN duration_json TEXT');
  }
  // Wage per contract: monthly wage, currency, and extra paid travel days used to
  // compute earnings and the repatriation allowance on the contract summary.
  if (!contractNames.has('monthly_wage')) {
    await db.execAsync('ALTER TABLE contracts ADD COLUMN monthly_wage REAL');
  }
  if (!contractNames.has('wage_currency')) {
    await db.execAsync('ALTER TABLE contracts ADD COLUMN wage_currency TEXT');
  }
  if (!contractNames.has('travel_days')) {
    await db.execAsync('ALTER TABLE contracts ADD COLUMN travel_days INTEGER');
  }
  // Contact fields on the profile (address block + landline) — used by the CV.
  const profileCols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(profile)');
  const profileNames = new Set(profileCols.map((c) => c.name));
  for (const col of ['address', 'city', 'state', 'country', 'zip_code', 'landline']) {
    if (!profileNames.has(col)) {
      await db.execAsync(`ALTER TABLE profile ADD COLUMN ${col} TEXT`);
    }
  }
  // Place of issue on documents (shown for passport / seaman's book / CoC).
  const docCols2 = await db.getAllAsync<{ name: string }>('PRAGMA table_info(documents)');
  if (!docCols2.some((c) => c.name === 'place_of_issue')) {
    await db.execAsync('ALTER TABLE documents ADD COLUMN place_of_issue TEXT');
  }
  const rankCols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(ranks)');
  const rankNames = new Set(rankCols.map((c) => c.name));
  if (!rankNames.has('promotion_months')) {
    // Sea time (in months) required to promote FROM each rank to the next one;
    // user-configurable per rank, computed in days (months × 30.44) in the domain.
    await db.execAsync('ALTER TABLE ranks ADD COLUMN promotion_months INTEGER');
    await db.execAsync('UPDATE ranks SET promotion_months = 12 WHERE promotion_months IS NULL');
  }
}

async function seedDefaults(db: SQLite.SQLiteDatabase): Promise<void> {
  const rankCount = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) AS c FROM ranks');
  if (!rankCount || rankCount.c === 0) {
    const defaultRanks: [string, string, number][] = [
      // Deck officers (gold) — Catering Officer sits at the junior end, above the cadet.
      ['Captain', 'deck', 1],
      ['Chief Officer', 'deck', 2],
      ['2nd Officer', 'deck', 3],
      ['3rd Officer', 'deck', 4],
      ['Catering Officer', 'deck', 5],
      ['Deck Cadet', 'deck', 6],
      // Engine officers (purple)
      ['Chief Engineer', 'engine', 1],
      ['2nd Engineer', 'engine', 2],
      ['3rd Engineer', 'engine', 3],
      ['4th Engineer', 'engine', 4],
      ['Engine Cadet', 'engine', 5],
      // Electrical / electro-technical (green)
      ['ETO 1', 'electro', 1],
      ['ETO 2', 'electro', 2],
      ['ETR', 'electro', 3],
      ['ETO Cadet', 'electro', 4],
      // Deck ratings (petrol blue)
      ['Bosun', 'deck_rating', 1],
      ['Pump Man', 'deck_rating', 2],
      ['Sea Man 1', 'deck_rating', 3],
      ['Sea Man 2', 'deck_rating', 4],
      ['Sea Man 3', 'deck_rating', 5],
      // Engine ratings (petrol blue)
      ['Fitter', 'engine_rating', 1],
      ['Oiler', 'engine_rating', 2],
      ['Wiper', 'engine_rating', 3],
      // Catering ratings (silver / white distinction cloth)
      ['Chief Cook', 'catering', 1],
      ['1st Cook', 'catering', 2],
      ['Mess Man', 'catering', 3],
    ];
    for (const [name, department, level] of defaultRanks) {
      await db.runAsync(
        'INSERT OR IGNORE INTO ranks (id, department, name, level, promotion_months, is_default) VALUES (?, ?, ?, ?, 12, 1)',
        `rank_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
        department,
        name,
        level
      );
    }
  }

  // Rank seed v2 (also applied to existing installs): the old single ETO rank
  // is replaced by the electro-technical ladder; ETO 1 outranks ETO 2.
  await db.runAsync("DELETE FROM ranks WHERE id = 'rank_eto'");
  const rankV2: [string, string, number][] = [
    ['ETO 1', 'electro', 1],
    ['ETO 2', 'electro', 2],
    ['ETR', 'electro', 3],
    ['ETO Cadet', 'electro', 4],
  ];
  for (const [name, department, level] of rankV2) {
    await db.runAsync(
      'INSERT OR IGNORE INTO ranks (id, department, name, level, promotion_months, is_default) VALUES (?, ?, ?, ?, 12, 1)',
      `rank_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
      department,
      name,
      level
    );
  }
  await db.runAsync("UPDATE ranks SET level = 3 WHERE id = 'rank_etr' AND level = 2");
  await db.runAsync('UPDATE ranks SET promotion_months = 12 WHERE promotion_months IS NULL');

  // Rank seed v3 (also applied to existing installs): dedicated rating branches with
  // maritime "distinction cloth" colours, plus a Catering Officer among the deck officers.
  // Retire the old generic "other" ratings (Bosun/AB/OS) — replaced by the branches below.
  await db.runAsync("DELETE FROM ranks WHERE department = 'other' AND is_default = 1");
  // Any user-created rank still left in the retired department moves to the deck ratings.
  await db.runAsync("UPDATE ranks SET department = 'deck_rating' WHERE department = 'other'");
  const rankV3: [string, string, number][] = [
    // Catering Officer joins the deck officers as a junior officer (above the cadet).
    ['Catering Officer', 'deck', 5],
    // Deck ratings (petrol blue)
    ['Bosun', 'deck_rating', 1],
    ['Pump Man', 'deck_rating', 2],
    ['Sea Man 1', 'deck_rating', 3],
    ['Sea Man 2', 'deck_rating', 4],
    ['Sea Man 3', 'deck_rating', 5],
    // Engine ratings (petrol blue)
    ['Fitter', 'engine_rating', 1],
    ['Oiler', 'engine_rating', 2],
    ['Wiper', 'engine_rating', 3],
    // Catering ratings (silver / white distinction cloth)
    ['Chief Cook', 'catering', 1],
    ['1st Cook', 'catering', 2],
    ['Mess Man', 'catering', 3],
  ];
  for (const [name, department, level] of rankV3) {
    await db.runAsync(
      'INSERT OR IGNORE INTO ranks (id, department, name, level, promotion_months, is_default) VALUES (?, ?, ?, ?, 12, 1)',
      `rank_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
      department,
      name,
      level
    );
  }
  // The retired "other" department no longer exists in the profile picker.
  await db.runAsync("UPDATE profile SET department = NULL WHERE department = 'other'");

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
      'Basic Training for Liquid Gas Tanker',
      'Basic Training for Oil and Chemical Tanker',
    ];
    for (const name of defaultTypes) {
      await db.runAsync(
        'INSERT OR IGNORE INTO document_types (id, name, is_default) VALUES (?, ?, 1)',
        `doctype_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
        name
      );
    }
  }

  // Ensure newer default document types also exist on already-seeded installs.
  const laterDefaultTypes = [
    'Basic Training for Liquid Gas Tanker',
    'Basic Training for Oil and Chemical Tanker',
  ];
  for (const name of laterDefaultTypes) {
    await db.runAsync(
      'INSERT OR IGNORE INTO document_types (id, name, is_default) VALUES (?, ?, 1)',
      `doctype_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
      name
    );
  }

  // Earlier versions seeded three fixed "protected" documents; they duplicated
  // the user's own passport/CDC/CoC. Remove those seeded rows if still empty.
  await db.runAsync(
    `DELETE FROM documents WHERE id IN ('doc_passport','doc_seaman_book','doc_coc')
       AND (number IS NULL OR number = '')
       AND issue_date IS NULL AND expiry_date IS NULL
       AND (place_of_issue IS NULL OR place_of_issue = '')`
  );
}
