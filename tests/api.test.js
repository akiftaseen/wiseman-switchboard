import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
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
  const saved = await call('/api/services/vpn', 'PATCH', { status: 'Down' });
  assert.equal(saved.status, 200);
  assert.equal(saved.data.status, 'Down');
  assert.notEqual(saved.data.checkedAt, before.checkedAt);
  assert(Date.parse(saved.data.checkedAt) >= start);
  restart();
  assert.deepEqual((await call('/api/services')).data[1], saved.data);
  const checked = await call('/api/services/vpn', 'PATCH', { status: 'Down' });
  assert.equal(checked.status, 200);
  assert(Date.parse(checked.data.checkedAt) >= Date.parse(saved.data.checkedAt));
});

test('creates, lists newest first, resolves idempotently, and persists after restart', async t => {
  const { call, restart } = setup(t);
  const first = await call('/api/requests', 'POST', sample);
  assert.equal(first.status, 201);
  assert.equal(first.data.name, sample.name.trim());
  assert.equal(first.data.description, sample.description.trim());
  assert.equal(first.data.state, 'Open');
  assert(Number.isFinite(Date.parse(first.data.createdAt)));
  const second = await call('/api/requests', 'POST', { ...sample, issueType: 'Other' });
  assert.deepEqual((await call('/api/requests')).data, [second.data, first.data]);
  const path = '/api/requests/' + first.data.id;
  const saved = await call(path, 'PATCH', { state: 'Resolved' });
  assert.equal(saved.status, 200);
  assert.deepEqual(saved.data, { ...first.data, state: 'Resolved' });
  assert.deepEqual((await call(path, 'PATCH', { state: 'Resolved' })).data, saved.data);
  restart();
  assert.deepEqual((await call('/api/requests')).data, [second.data, saved.data]);
});

test('rejects whitespace, excessive lengths, invalid types and unknown issue types', async t => {
  const { call } = setup(t);
  for (const [field, value] of [
    ['name', '  '], ['name', 123], ['name', 'x'.repeat(81)],
    ['description', '  '], ['description', 'x'.repeat(2001)], ['issueType', 'Unknown']
  ]) {
    const result = await call('/api/requests', 'POST', { ...sample, [field]: value });
    assert.equal(result.status, 400);
    assert(result.data.fields[field]);
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
    const result = await call('/api/requests', 'POST', body, type);
    assert.equal(result.status, status);
    assert.equal(typeof result.data.error, 'string');
  }
  const encoded = await call('/api/requests', 'POST', sample, 'application/json', {
    'Content-Encoding': 'gzip'
  });
  assert.equal(encoded.status, 415);
  assert.equal(encoded.data.error, 'Unsupported request encoding.');
  assert.deepEqual((await call('/api/requests')).data, []);
});

test('rejects invalid transitions, invalid IDs, and absent resources', async t => {
  const { call } = setup(t);
  for (const [path, body, status] of [
    ['services/vpn', { status: 'Unknown' }, 400], ['services/unknown', { status: 'Down' }, 404],
    ['requests/1', { state: 'Open' }, 400], ['requests/-1', { state: 'Resolved' }, 400],
    ['requests/1x', { state: 'Resolved' }, 400], ['requests/999', { state: 'Resolved' }, 404]
  ]) {
    const result = await call('/api/' + path, 'PATCH', body);
    assert.equal(result.status, status);
    assert(result.data.error);
  }
  assert.equal((await call('/api/missing')).status, 404);
});

test('upgrades a database that stored Operational to the Up status', async t => {
  const folder = mkdtempSync(join(tmpdir(), 'switchboard-test-'));
  const path = join(folder, 'old.sqlite');
  const old = new DatabaseSync(path);
  old.exec(`
    CREATE TABLE services (
      id TEXT PRIMARY KEY, name TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('Operational','Degraded','Down')),
      checkedAt TEXT NOT NULL
    );
    INSERT INTO services VALUES
      ('email', 'Email', 'Operational', '2026-11-18T10:00:00.000Z'),
      ('vpn', 'VPN', 'Down', '2026-11-18T10:05:00.000Z'),
      ('file-share', 'File Share', 'Operational', '2026-11-18T10:10:00.000Z');
  `);
  old.close();
  const db = openDatabase(path);
  const server = createServer(createApp(db));
  t.after(() => { db.close(); rmSync(folder, { recursive: true, force: true }); });

  const services = await send(server, '/api/services');
  assert.deepEqual(services.data.map(s => [s.id, s.status, s.checkedAt]), [
    ['email', 'Up', '2026-11-18T10:00:00.000Z'],
    ['vpn', 'Down', '2026-11-18T10:05:00.000Z'],
    ['file-share', 'Up', '2026-11-18T10:10:00.000Z']
  ]);
  assert.equal((await send(server, '/api/services/vpn', 'PATCH', { status: 'Up' })).data.status, 'Up');
});
