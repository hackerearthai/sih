import assert from 'node:assert/strict';
import test from 'node:test';
import { toDocument, searchRecords, answerRecords } from '../browser/api.mjs';

test('search, workspace/status/assignee filters and record answers use saved metadata', () => {
  const docs = [
    { id: 'one', name: 'FIR_DEMO.txt', hash: 'abc', caseReference: 'DEMO-001', workspace: 'Central Investigations', status: 'clean', assignedTo: 'member-a', isDemo: true },
    { id: 'two', name: 'Witness.txt', hash: 'def', caseReference: 'DEMO-002', workspace: 'Regional Forensics', status: 'review', assignedTo: 'member-b', isDemo: true },
    { id: 'three', name: 'Altered.txt', hash: 'xyz', caseReference: 'DEMO-003', workspace: 'Central Investigations', status: 'tampered', assignedTo: 'member-a', isDemo: true },
  ];
  assert.equal(searchRecords(docs, 'demo-001')[0].id, 'one');
  assert.equal(searchRecords(docs, 'DEF')[0].id, 'two');
  assert.equal(searchRecords(docs, '', { assignee: 'member-b' }).length, 1);
  assert.equal(searchRecords(docs, '', { workspace: 'Central Investigations', status: 'tampered' })[0].id, 'three');
  assert.equal(answerRecords(docs, 'how many need review?').docs.length, 2);
  assert.equal(answerRecords(docs, 'summary').docs.length, 3);
  assert.equal(answerRecords(docs, 'fingerprint mismatch').docs[0].id, 'three');
  assert.equal(answerRecords(docs, 'unrelated record').docs.length, 0);
});

test('database and blockchain statuses map honestly to the frontend', () => {
  const row = { docId: 'record-a', filename: 'evidence.pdf', docHash: 'abc123', timestamp: '2026-09-05T00:00:00Z', uploader: 'admin1' };
  assert.equal(toDocument({ ...row, status: 'verified', aiRiskFlag: 'clean' }).status, 'clean');
  assert.equal(toDocument({ ...row, status: 'verified', aiRiskFlag: 'review_recommended' }).status, 'review');
  assert.equal(toDocument({ ...row, status: 'tampered', aiRiskFlag: 'clean' }).status, 'tampered');
  assert.equal(toDocument({ ...row, status: 'pending', aiRiskFlag: 'clean' }).status, 'review');
  assert.equal(toDocument(row).id, 'record-a');
  assert.equal(toDocument(row).hash, 'abc123');
  assert.equal(toDocument(row).uploader, 'admin1');
  assert.notEqual(toDocument(row).id, toDocument({ ...row, docId: 'record-b' }).id);
});

test('API client sends authenticated multipart files and clears an invalid session', async () => {
  const saved = { fetch: globalThis.fetch, sessionStorage: globalThis.sessionStorage, localStorage: globalThis.localStorage, window: globalThis.window };
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
  let expired = false;
  globalThis.sessionStorage = storage; globalThis.localStorage = storage;
  globalThis.window = { dispatchEvent: () => { expired = true; } };
  try {
    const api = await import('../browser/api.mjs');
    globalThis.fetch = async (_url, options) => {
      assert.equal(JSON.parse(options.body).username, 'admin1');
      return Response.json({ token: 'test-token', role: 'admin', userId: 'user-id' });
    };
    await api.login('admin1', 'pass123');
    assert.equal(api.getSession().username, 'admin1');
    globalThis.fetch = async (_url, options) => {
      assert.equal(options.headers.Authorization, 'Bearer test-token');
      assert.ok(options.body instanceof FormData);
      assert.equal(options.headers['Content-Type'], undefined);
      return Response.json({ docId: 'saved-id' }, { status: 201 });
    };
    assert.equal((await api.uploadDocument(new Blob(['file']))).docId, 'saved-id');
    globalThis.fetch = async () => Response.json({ error: 'Invalid or expired token' }, { status: 401 });
    await assert.rejects(api.currentUser(), /expired token/);
    assert.equal(expired, true);
    assert.equal(api.getSession(), null);
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  }
});
