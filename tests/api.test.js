import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.js';
import { openDatabase } from '../server/db.js';
import { send } from './http.js';

const sample = { name: "  Sam O'Brien  ", issueType: 'VPN', description: ' Connection stops at sign-in. ' };

function setup(t) {
  const folder = mkdtempSync(join(tmpdir(), 'switchboard-test-'));
  const path = join(folder, 'test.sqlite');
  let db = openDatabase(path);
  let server = createServer(createApp(db));
  t.after(() => { db.close(); rmSync(folder, { recursive: true, force: true }); });
  return {
    call: (...args) => send(server, ...args),
    restart() {
      db.close();
      db = openDatabase(path);
      server = createServer(createApp(db));
    }
  };
}

test('seeds the three sample checks and an empty queue', async t => {
  const { call } = setup(t);
  const services = await call('/api/services');
  assert.equal(services.status, 200);
  assert.deepEqual(services.data.map(s => [s.name, s.status]), [
    ['Email', 'Up'], ['VPN', 'Degraded'], ['File Share', 'Up']
  ]);
  assert(services.data.every(s => Number.isFinite(Date.parse(s.checkedAt))));
  assert.deepEqual((await call('/api/requests')).data, []);
});

test('manual check changes status and time and survives reopening the database', async t => {
  const { call, restart } = setup(t);
  const before = (await call('/api/services')).data[1];
  const start = Date.now();
  const saved = await call('/api/services/vpn', { method: 'PATCH', body: { status: 'Down' } });
  assert.equal(saved.status, 200);
  assert.equal(saved.data.status, 'Down');
  assert.notEqual(saved.data.checkedAt, before.checkedAt);
  assert(Date.parse(saved.data.checkedAt) >= start);
  restart();
  assert.deepEqual((await call('/api/services')).data[1], saved.data);
  const checked = await call('/api/services/vpn', { method: 'PATCH', body: { status: 'Down' } });
  assert.equal(checked.status, 200);
  assert(Date.parse(checked.data.checkedAt) >= Date.parse(saved.data.checkedAt));
});

test('creates, orders, resolves, and reopens requests across restarts', async t => {
  const { call, restart } = setup(t);
  const first = await call('/api/requests', { method: 'POST', body: sample });
  assert.equal(first.status, 201);
  assert.equal(first.data.name, sample.name.trim());
  assert.equal(first.data.description, sample.description.trim());
  assert.equal(first.data.state, 'Open');
  assert(Number.isFinite(Date.parse(first.data.createdAt)));
  const second = await call('/api/requests', { method: 'POST', body: { ...sample, issueType: 'Other' } });
  assert.deepEqual((await call('/api/requests')).data, [second.data, first.data]);
  const path = '/api/requests/' + first.data.id;
  const saved = await call(path, { method: 'PATCH', body: { state: 'Resolved' } });
  assert.equal(saved.status, 200);
  assert.deepEqual(saved.data, { ...first.data, state: 'Resolved' });
  assert.deepEqual((await call(path, { method: 'PATCH', body: { state: 'Resolved' } })).data, saved.data);
  restart();
  assert.deepEqual((await call('/api/requests')).data, [second.data, saved.data]);

  const reopened = await call(path, { method: 'PATCH', body: { state: 'Open' } });
  assert.equal(reopened.status, 200);
  assert.deepEqual(reopened.data, first.data);
  assert.deepEqual((await call(path, { method: 'PATCH', body: { state: 'Open' } })).data, first.data);
  restart();
  assert.deepEqual((await call('/api/requests')).data, [second.data, first.data]);
});

test('rejects whitespace, excessive lengths, invalid types and unknown issue types', async t => {
  const { call } = setup(t);
  for (const [field, value] of [
    ['name', '  '], ['name', 123], ['name', 'x'.repeat(81)],
    ['description', '  '], ['description', 'x'.repeat(2001)], ['issueType', 'Unknown']
  ]) {
    const result = await call('/api/requests', { method: 'POST', body: { ...sample, [field]: value } });
    assert.equal(result.status, 400, `invalid ${field}: ${JSON.stringify(value).slice(0, 100)}`);
    assert(result.data.fields[field], `expected a validation error for ${field}`);
  }
  assert.deepEqual((await call('/api/requests')).data, []);
});

test('returns JSON errors for invalid JSON, content type and payload size', async t => {
  const { call } = setup(t);
  for (const [body, type, status] of [
    ['{', 'application/json', 400], ['{}', 'text/plain', 415],
    [JSON.stringify({ description: 'x'.repeat(33000) }), 'application/json', 413],
    ['null', 'application/json', 400], ['[]', 'application/json', 400]
  ]) {
    const result = await call('/api/requests', { method: 'POST', body, contentType: type });
    assert.equal(result.status, status, `${type}: ${body.slice(0, 100)}`);
    assert.equal(typeof result.data.error, 'string');
  }
  const encoded = await call('/api/requests', {
    method: 'POST', body: sample, extraHeaders: { 'Content-Encoding': 'gzip' }
  });
  assert.equal(encoded.status, 415);
  assert.equal(encoded.data.error, 'Unsupported request encoding.');
  assert.deepEqual((await call('/api/requests')).data, []);
});

test('rejects invalid transitions, invalid IDs, and absent resources', async t => {
  const { call } = setup(t);
  for (const [path, body, status] of [
    ['services/vpn', { status: 'Unknown' }, 400], ['services/unknown', { status: 'Down' }, 404],
    ['requests/1', { state: 'Pending' }, 400], ['requests/-1', { state: 'Resolved' }, 400],
    ['requests/1x', { state: 'Resolved' }, 400], ['requests/999', { state: 'Resolved' }, 404]
  ]) {
    const result = await call('/api/' + path, { method: 'PATCH', body });
    assert.equal(result.status, status, `PATCH ${path} ${JSON.stringify(body)}`);
    assert(result.data.error);
  }
  assert.equal((await call('/api/missing')).status, 404);
});

test('migrates legacy service status without losing checks or requests', t => {
  const folder = mkdtempSync(join(tmpdir(), 'switchboard-legacy-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const path = join(folder, 'legacy.sqlite');
  const legacy = new DatabaseSync(path);
  legacy.exec(`
    CREATE TABLE services (
      id TEXT PRIMARY KEY, name TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('Operational','Degraded','Down')),
      checkedAt TEXT NOT NULL
    );
    INSERT INTO services VALUES ('email', 'Email', 'Operational', '2026-01-01T00:00:00.000Z');
    INSERT INTO services VALUES ('custom', 'Custom', 'Down', '2026-01-02T00:00:00.000Z');
    CREATE TABLE requests (
      id INTEGER PRIMARY KEY, name TEXT, issueType TEXT, description TEXT, createdAt TEXT, state TEXT
    );
    INSERT INTO requests VALUES (17, 'Sam', 'Email', 'A saved request', '2026-01-01', 'Open');
  `);
  legacy.close();

  for (let run = 0; run < 2; run++) {
    const db = openDatabase(path);
    try {
      assert.deepEqual({ ...db.prepare("SELECT status, checkedAt FROM services WHERE id = 'email'").get() }, {
        status: 'Up',
        checkedAt: '2026-01-01T00:00:00.000Z'
      });
      assert.equal(db.prepare("SELECT status FROM services WHERE id = 'custom'").get().status, 'Down');
      assert.equal(db.prepare('SELECT description FROM requests WHERE id = 17').get().description, 'A saved request');
      assert.throws(() => db.exec("UPDATE services SET status = 'Operational' WHERE id = 'email'"), /CHECK constraint/);
    } finally {
      db.close();
    }
  }
});
