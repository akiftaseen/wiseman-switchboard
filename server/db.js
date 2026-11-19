import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { UP } from '../shared/domain.js';

const defaultFile = fileURLToPath(new URL('../data/servicedesk.sqlite', import.meta.url));

// Keep both CHECK lists in sync with shared/domain.js. Changes require a migration.
const servicesSchema = `
  CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY, name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Up', 'Degraded', 'Down')),
    checkedAt TEXT NOT NULL
  );
`;

function migrateSchema(db) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const version = db.prepare('PRAGMA user_version').get().user_version;
    if (version > 1) throw new Error(`Unsupported database schema version: ${version}.`);
    if (version === 1) {
      db.exec('COMMIT');
      return;
    }

    const table = db.prepare("SELECT sql FROM sqlite_schema WHERE type = 'table' AND name = 'services'").get();
    // The original CHECK constraint requires a table rebuild before it can accept Up.
    const legacy = table?.sql.includes("'Operational'");
    if (legacy) db.exec('ALTER TABLE services RENAME TO legacy_services');
    db.exec(servicesSchema);
    if (legacy) {
      db.exec(`
        INSERT INTO services (id, name, status, checkedAt)
        SELECT id, name, CASE WHEN status = 'Operational' THEN 'Up' ELSE status END, checkedAt
        FROM legacy_services ORDER BY rowid
      `);
      db.exec('DROP TABLE legacy_services');
    }

    db.exec(`
      CREATE TABLE IF NOT EXISTS requests (
        id INTEGER PRIMARY KEY, name TEXT NOT NULL, issueType TEXT NOT NULL,
        description TEXT NOT NULL, createdAt TEXT NOT NULL,
        state TEXT NOT NULL DEFAULT 'Open' CHECK (state IN ('Open', 'Resolved'))
      );
      PRAGMA user_version = 1;
    `);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function seedServices(db) {
  // Starting the server never changes the recorded check time.
  const seed = db.prepare('INSERT INTO services VALUES (?, ?, ?, ?) ON CONFLICT(id) DO NOTHING');
  seed.run('email', 'Email', UP, '2026-11-18T09:30:00.000Z');
  seed.run('vpn', 'VPN', 'Degraded', '2026-11-18T09:32:00.000Z');
  seed.run('file-share', 'File Share', UP, '2026-11-18T09:31:00.000Z');
}

export function openDatabase(filename = process.env.DB_PATH || defaultFile) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  try {
    db.exec('PRAGMA busy_timeout = 3000; PRAGMA journal_mode = WAL;');
    migrateSchema(db);
    seedServices(db);
    return db;
  } catch (error) {
    db.close();
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
    updateRequestState: db.prepare('UPDATE requests SET state = ? WHERE id = ? RETURNING *')
  };
}
