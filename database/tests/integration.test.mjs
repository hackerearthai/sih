import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import EmbeddedPostgres from 'embedded-postgres';

const require = createRequire(import.meta.url);
const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('PostgreSQL → existing API → frontend contract', { timeout: 120000 }, async (t) => {
  // Dedicated test cluster/database: never use DATABASE_URL or the user's data.
  const databaseDir = path.join(directory, '.test-postgres');
  const databaseName = 'integration_' + randomUUID().replaceAll('-', '');
  const postgres = new EmbeddedPostgres({ databaseDir, user: 'test_user', password: 'test_password',
    port: 55432, persistent: true, postgresFlags: ['-c', 'listen_addresses=127.0.0.1'],
    onLog: () => {}, onError: () => {},
  });
  let api;
  let db;
  let chain;
  let originalChain;
  let created = false;
  try {
    if (!existsSync(path.join(databaseDir, 'PG_VERSION'))) await postgres.initialise();
    await postgres.start();
    await postgres.createDatabase(databaseName); created = true;
    process.env.DATABASE_URL = `postgresql://test_user:test_password@127.0.0.1:55432/${databaseName}`;
    process.env.DB_SSL = 'false';
    process.env.JWT_SECRET = randomUUID();
    process.env.BLOCKCHAIN_PRIVATE_KEY = '';
    process.env.AI_SERVICE_URL = 'http://127.0.0.1:1';
    process.env.UPLOAD_DIR = path.join(directory, '.test-uploads', databaseName);
    api = await require('../src/server').startServer({ port: 0 });
    db = require('../src/client');
    chain = require('../../backend/src/blockchain/contract');
    originalChain = { ...chain };
    await require('../scripts/seed').seed();
    const url = `http://127.0.0.1:${api.server.address().port}/api`;
    let token;
    let userId;
    let documentId;
    const call = async (route, options = {}) => {
      const response = await fetch(url + route, { ...options, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } });
      return { status: response.status, body: await response.json() };
    };
    const login = (username, password) => call('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
    const upload = (route, content = '%PDF-1.4\nIntegration test', reason) => {
      const body = new FormData(); body.append('file', new Blob([content], { type: 'application/pdf' }), 'same-name.pdf');
      if (reason) body.append('reason', reason);
      return call(route, { method: 'POST', body });
    };
    await t.test('migrations and seeds are repeatable; protected routes require database credentials', async () => {
      await require('../scripts/migrate').migrate();
      await require('../scripts/seed').seed();
      assert.equal((await call('/health')).body.database, 'connected');
      assert.equal((await call('/documents')).status, 401);
      assert.equal((await login('admin', 'admin123')).status, 401);
      assert.equal((await login("' OR 1=1 --", 'pass123')).status, 401);
      assert.equal((await login('admin1', 'wrong')).status, 401);
      const response = await login('admin1', 'pass123');
      assert.equal(response.status, 200);
      token = response.body.token; userId = response.body.userId;
      assert.equal((await call('/auth/me')).body.username, 'admin1');
      assert.deepEqual((await call('/documents')).body, []);
      assert.equal((await db.query('SELECT count(*) FROM public.users')).rows[0].count, '4');
    });
    await t.test('an unavailable blockchain rejects upload and leaves no database record or file', async () => {
      chain.registerDocument = async () => null;
      assert.equal((await upload('/documents/upload')).status, 503);
      assert.equal((await db.query('SELECT count(*) FROM public.documents')).rows[0].count, '0');
      assert.deepEqual(await fs.readdir(process.env.UPLOAD_DIR), []);
    });
    // Only external chain outcomes are simulated below. HTTP, JWT, bcrypt,
    // PostgreSQL, writable compatibility views, files and hashing are real.
    const hashes = new Map();
    chain.registerDocument = async (id, hash) => { hashes.set(id, hash); return { txHash: 'test-registration' }; };
    chain.verifyDocument = async (id, hash) => ({ verified: hashes.get(id) === hash, onChainHash: hashes.get(id) });
    chain.addVersion = async (id, hash) => { hashes.set(id, hash); return { txHash: 'test-version' }; };
    chain.logAccess = async () => null;
    chain.getDocumentHistory = async () => [];
    await t.test('upload persists through writable views and fresh API reads', async () => {
      const response = await upload('/documents/upload');
      assert.equal(response.status, 201);
      documentId = response.body.docId;
      const result = await db.query('SELECT * FROM public.documents WHERE doc_id = $1', [documentId]);
      assert.equal(result.rows[0].uploader_id, userId);
      assert.equal(result.rows[0].doc_hash, response.body.docHash);
      const list = await call('/documents');
      assert.equal(list.body[0].docId, documentId);
      assert.equal(list.body[0].status, 'verified');
      const metadata = await call('/document-metadata');
      assert.equal(metadata.body[0].uploader, 'admin1');
      assert.equal(metadata.body[0].docHash, response.body.docHash);
      assert.equal(metadata.body[0].aiRiskFlag, 'review_recommended');
      assert.equal('filepath' in metadata.body[0], false);
      const detail = await call(`/documents/${documentId}`);
      assert.equal(detail.body.versions.length, 1);
      assert.equal(detail.body.versions[0].version, 1);
      assert.equal((await call(`/documents/${documentId}/verify`, { method: 'POST' })).body.status, 'verified');
      // A second login/session reads the same saved record (no browser state).
      token = (await login('investigator1', 'pass123')).body.token;
      assert.equal((await call('/documents')).body[0].docId, documentId);
    });
    await t.test('version writes preserve append-only history and mismatches stay tampered', async () => {
      const response = await upload(`/documents/${documentId}/version`, '%PDF-1.4\nSecond version', 'Corrected record');
      assert.equal(response.status, 201);
      assert.equal(response.body.version, 2);
      const detail = await call(`/documents/${documentId}`);
      assert.equal(detail.body.currentVersion, 2);
      assert.equal(detail.body.versions.length, 2);
      await assert.rejects(db.query('UPDATE public.document_versions SET reason = $1 WHERE doc_id = $2', ['rewrite history', documentId]), /append-only/);
      await fs.appendFile(detail.body.filepath, '\nchanged outside application');
      assert.equal((await call(`/documents/${documentId}/verify`, { method: 'POST' })).body.status, 'tampered');
      assert.equal((await call('/documents')).body[0].status, 'tampered');
      chain.verifyDocument = async () => null;
      assert.equal((await call(`/documents/${documentId}/verify`, { method: 'POST' })).status, 503);
      assert.equal((await call('/documents')).body[0].status, 'pending');
    });
    await t.test('demo seeding is repeatable and real files support local checks and downloads', async () => {
      assert.equal(await require('../scripts/demo-data').seedDemoData(), 6);
      assert.equal(await require('../scripts/demo-data').seedDemoData(), 0);
      const records = (await call('/workspace/records')).body;
      const demos = records.filter((d) => d.isDemo);
      assert.equal(demos.length, 6);
      assert.ok(demos.every((d) => d.sizeBytes > 0 && !('filepath' in d)));
      const altered = demos.find((d) => d.filename.startsWith('Altered'));
      assert.equal(altered.status, 'tampered');
      const check = await call(`/workspace/records/${altered.docId}/verify`, { method: 'POST' });
      assert.equal(check.body.source, 'local-demo');
      assert.equal(check.body.status, 'tampered');
      assert.equal(check.body.onChainHash, null);
      const download = await fetch(url + `/workspace/records/${altered.docId}/download`, { headers: { Authorization: `Bearer ${token}` } });
      assert.equal(download.status, 200);
      assert.match(download.headers.get('content-disposition'), /attachment/);
      assert.match(await download.text(), /DEMO DATA ONLY/);
      assert.equal((await call('/workspace/records/not-a-uuid/download')).status, 400);
      const history = await call(`/workspace/records/${altered.docId}/history`);
      assert.equal(history.body.source, 'local-demo');
      assert.ok(history.body.rows.some((r) => r.action === 'download'));
      assert.ok(history.body.rows.some((r) => r.action === 'verify'));
      const detail = await call(`/workspace/records/${altered.docId}`);
      assert.equal(detail.body.versions.length, 1);
      assert.equal('filepath' in detail.body, false);
    });
    await t.test('preferences, assignments and notification reads persist', async () => {
      const prefs = { displayName: 'Demo Reviewer', workspace: 'All workspaces', theme: 'light', defaultFilter: 'review', notifications: false };
      const json = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      assert.equal((await call('/workspace/preferences', json('PUT', prefs))).status, 200);
      assert.equal((await call('/workspace/preferences')).body.displayName, prefs.displayName);
      assert.equal((await call('/workspace/preferences', json('PUT', { ...prefs, theme: 'invalid' }))).status, 400);
      const demo = (await call('/workspace/records')).body.find((d) => d.isDemo);
      assert.equal((await call(`/workspace/records/${demo.docId}`, json('PATCH', { workspace: 'Regional Forensics', caseReference: 'DEMO-ASSIGNED', assignedTo: userId }))).status, 200);
      const saved = (await call(`/workspace/records/${demo.docId}`)).body;
      assert.equal(saved.caseReference, 'DEMO-ASSIGNED');
      assert.equal(saved.assignee, 'admin1');
      const alerts = (await call('/workspace/notifications')).body;
      assert.ok(alerts.length >= 3);
      assert.equal((await call('/workspace/notifications/read', json('POST', { ids: alerts.map((a) => a.docId) }))).status, 200);
      assert.ok((await call('/workspace/notifications')).body.every((a) => a.read));
      assert.ok((await call('/workspace/activity')).body.some((row) => row.action === 'share'));
    });
    await t.test('team controls enforce administrator access and store usable accounts', async () => {
      const body = { username: 'demo_new_member', displayName: 'New Demo Member', password: 'ExamplePass123!', role: 'investigator' };
      const options = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
      assert.equal((await call('/workspace/members', options)).status, 403);
      token = (await login('admin1', 'pass123')).body.token;
      assert.equal((await call('/workspace/members', options)).status, 201);
      assert.equal((await call('/workspace/members', options)).status, 409);
      assert.ok((await call('/workspace/members')).body.some((m) => m.username === body.username));
      assert.equal((await login(body.username, body.password)).status, 200);
    });
    await t.test('explicit demo uploads and revisions work without a blockchain and preserve old files', async () => {
      const created = await upload('/workspace/demo/upload', 'Demo upload content');
      assert.equal(created.status, 201);
      assert.equal(created.body.isDemo, true);
      const id = created.body.docId;
      assert.equal((await call(`/workspace/records/${id}/verify`, { method: 'POST' })).body.status, 'verified');
      const revision = await upload(`/workspace/records/${id}/demo-version`, 'Revised demo content', 'Corrected demo record');
      assert.equal(revision.status, 201);
      assert.equal(revision.body.version, 2);
      const detail = (await call(`/workspace/records/${id}`)).body;
      assert.equal(detail.versions.length, 2);
      const old = await fetch(url + `/workspace/records/${id}/download?version=1`, { headers: { Authorization: `Bearer ${token}` } });
      assert.equal(await old.text(), 'Demo upload content');
      assert.equal((await call(`/workspace/records/${documentId}/demo-version`, { method: 'POST' })).status, 400);
      const previousEnvironment = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';
        assert.equal((await upload('/workspace/demo/upload')).status, 403);
      } finally {
        if (previousEnvironment === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousEnvironment;
      }
    });
    await t.test('expired sessions cannot read saved records', async () => {
      token = 'expired-or-invalid';
      assert.equal((await call('/documents')).status, 401);
      assert.equal((await call('/document-metadata')).status, 401);
      assert.equal((await call('/auth/me')).status, 401);
      assert.equal((await call('/workspace/records')).status, 401);
      assert.equal((await call('/workspace/members')).status, 401);
    });
  } finally {
    if (originalChain) Object.assign(chain, originalChain);
    if (api) await api.close();
    if (created) await postgres.dropDatabase(databaseName);
    await postgres.stop();
  }
});
