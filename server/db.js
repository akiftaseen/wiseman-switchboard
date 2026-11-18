import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultFile = fileURLToPath(new URL('../data/servicedesk.sqlite', import.meta.url));

const servicesTable = `
  CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY, name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Up','Degraded','Down')),
    checkedAt TEXT NOT NULL
  );
`;

export function openDatabase(filename = process.env.DB_PATH || defaultFile) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`
    PRAGMA busy_timeout = 3000;
    PRAGMA journal_mode = WAL;
  `);
  migrateOperationalToUp(db);
  db.exec(`
    ${servicesTable}
    CREATE TABLE IF NOT EXISTS requests (
      id INTEGER PRIMARY KEY, name TEXT NOT NULL, issueType TEXT NOT NULL,
      description TEXT NOT NULL, createdAt TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'Open' CHECK (state IN ('Open','Resolved'))
    );
  `);
  // Fixed sample checks come from the original demo. Starting the server isn't a check.
  const seed = db.prepare('INSERT INTO services VALUES (?, ?, ?, ?) ON CONFLICT(id) DO NOTHING');
  seed.run('email', 'Email', 'Up', '2026-11-18T09:30:00.000Z');
  seed.run('vpn', 'VPN', 'Degraded', '2026-11-18T09:32:00.000Z');
  seed.run('file-share', 'File Share', 'Up', '2026-11-18T09:31:00.000Z');
  return db;
}

// Early databases stored "Operational" instead of "Up". SQLite can't edit a CHECK rule
// in place, so rebuild the small services table once and keep each saved check.
function migrateOperationalToUp(db) {
  const table = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'services'").get();
  if (!table?.sql.includes("'Operational'")) return;
  db.exec('BEGIN');
  try {
    db.exec(`
      ALTER TABLE services RENAME TO services_old;
      ${servicesTable}
      INSERT INTO services
        SELECT id, name, CASE status WHEN 'Operational' THEN 'Up' ELSE status END, checkedAt
        FROM services_old ORDER BY rowid;
      DROP TABLE services_old;
    `);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function prepareQueries(db) {
  return {
    listServices: db.prepare('SELECT * FROM services ORDER BY rowid'),
    recordCheck: db.prepare(`
      UPDATE services
      SET status = ?, checkedAt = ?
      WHERE id = ?
      RETURNING *
    `),
    listRequests: db.prepare('SELECT * FROM requests ORDER BY createdAt DESC, id DESC'),
    createRequest: db.prepare(`
      INSERT INTO requests (name, issueType, description, createdAt)
      VALUES (?, ?, ?, ?)
      RETURNING *
    `),
    resolveRequest: db.prepare("UPDATE requests SET state = 'Resolved' WHERE id = ? RETURNING *")
  };
}
