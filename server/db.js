import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OPEN, requestStates, statuses, UP } from '../shared/domain.js';

const defaultFile = fileURLToPath(new URL('../data/servicedesk.sqlite', import.meta.url));

const servicesSchema = `
  CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY, name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN (${statuses.map(status => `'${status}'`).join(', ')})),
    checkedAt TEXT NOT NULL
  );
`;

function initializeServices(db) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const table = db.prepare("SELECT sql FROM sqlite_schema WHERE type = 'table' AND name = 'services'").get();
    // The original CHECK constraint requires a table rebuild before it can accept Up.
    const legacy = table?.sql.includes("'Operational'");
    if (legacy) db.exec('ALTER TABLE services RENAME TO legacy_services');
    db.exec(servicesSchema);
    if (legacy) {
      db.prepare(`
        INSERT INTO services (id, name, status, checkedAt)
        SELECT id, name, CASE WHEN status = 'Operational' THEN ? ELSE status END, checkedAt
        FROM legacy_services ORDER BY rowid
      `).run(UP);
      db.exec('DROP TABLE legacy_services');
    }

    // Starting the server never changes the recorded check time.
    const seed = db.prepare('INSERT INTO services VALUES (?, ?, ?, ?) ON CONFLICT(id) DO NOTHING');
    seed.run('email', 'Email', UP, '2026-11-18T09:30:00.000Z');
    seed.run('vpn', 'VPN', 'Degraded', '2026-11-18T09:32:00.000Z');
    seed.run('file-share', 'File Share', UP, '2026-11-18T09:31:00.000Z');
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function openDatabase(filename = process.env.DB_PATH || defaultFile) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`
    PRAGMA busy_timeout = 3000;
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS requests (
      id INTEGER PRIMARY KEY, name TEXT NOT NULL, issueType TEXT NOT NULL,
      description TEXT NOT NULL, createdAt TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT '${OPEN}' CHECK (state IN (${requestStates.map(state => `'${state}'`).join(', ')}))
    );
  `);
  initializeServices(db);
  return db;
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
