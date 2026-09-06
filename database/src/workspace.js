'use strict';
const path = require('node:path');
const fs = require('node:fs/promises');
const { createReadStream } = require('node:fs');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const backendRequire = createRequire(path.resolve(__dirname, '../../backend/package.json'));
const express = backendRequire('express');
const multer = backendRequire('multer');
const bcrypt = backendRequire('bcryptjs');
const auth = backendRequire('./src/middleware/auth');
const chain = backendRequire('./src/blockchain/contract');
const db = require('./client');
const workspaces = ['Central Investigations', 'Digital Evidence Unit', 'Regional Forensics'];
const roles = ['investigator', 'court_clerk', 'admin'];
const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const fail = (status, message) => Object.assign(new Error(message), { status });
const isUuid = (value) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const selected = `SELECT d.*, u.username AS uploader, a.username AS assignee
  FROM public.documents d JOIN public.users u ON u.user_id=d.uploader_id
  LEFT JOIN public.users a ON a.user_id=d.assigned_to`;
async function record(id) {
  if (!isUuid(id)) throw fail(400, 'Invalid document ID');
  const row = (await db.query(`${selected} WHERE d.doc_id=$1`, [id])).rows[0];
  if (!row) throw fail(404, 'Document not found');
  return row;
}
async function fingerprint(filepath) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of createReadStream(filepath)) hash.update(chunk);
  return hash.digest('hex');
}
async function checked(row) {
  let currentHash;
  try { currentHash = await fingerprint(row.filepath); }
  catch (error) { if (error.code === 'ENOENT') return { status: 'pending', missing: true }; throw error; }
  if (row.is_demo) return { status: currentHash === row.doc_hash ? 'verified' : 'tampered', currentHash, onChainHash: null, storedHash: row.doc_hash, source: 'local-demo' };
  const result = await chain.verifyDocument(row.doc_id, currentHash);
  return result ? { status: result.verified ? 'verified' : 'tampered', currentHash, onChainHash: result.onChainHash, source: 'blockchain' } : { status: 'pending', unavailable: true };
}
async function publicRecord(row) {
  const check = await checked(row);
  const stat = await fs.stat(row.filepath).catch(() => null);
  return { docId: row.doc_id, filename: row.filename, docHash: row.doc_hash, uploaderId: row.uploader_id,
    uploader: row.uploader, timestamp: row.created_at, aiRiskFlag: row.ai_risk_flag, currentVersion: row.current_version,
    status: check.status, isDemo: row.is_demo, workspace: row.workspace, caseReference: row.case_reference,
    assignedTo: row.assigned_to, assignee: row.assignee, sizeBytes: stat?.size ?? null };
}
async function log(row, userId, action, detail, client = db) {
  await client.query('INSERT INTO public.access_log_cache (doc_id,user_id,action,detail) VALUES ($1,$2,$3,$4)', [row.doc_id, userId, action, detail]);
}
router.use(auth);
// Check current membership for every action, rather than trusting a stale role
// claim in a previously issued token.
router.use(wrap(async (req, _res, next) => {
  const user = (await db.query('SELECT user_id,username,role,display_name,preferences FROM public.users WHERE user_id=$1', [req.user.userId])).rows[0];
  if (!user) throw fail(401, 'Account no longer exists');
  req.account = user; next();
}));
router.get('/records', wrap(async (_req, res) => {
  const rows = (await db.query(`${selected} ORDER BY d.created_at DESC`)).rows;
  res.json(await Promise.all(rows.map(publicRecord)));
}));
router.get('/members', wrap(async (_req, res) => {
  res.json((await db.query('SELECT user_id AS "userId",username,display_name AS "displayName",role,created_at AS "createdAt" FROM public.users ORDER BY username')).rows);
}));
router.post('/members', wrap(async (req, res) => {
  if (req.account.role !== 'admin') throw fail(403, 'Only an administrator can add members');
  const { username, password, role, displayName = '' } = req.body;
  if (typeof username !== 'string' || !/^[a-zA-Z0-9_.-]{3,40}$/.test(username)) throw fail(400, 'Use a username of 3–40 letters, numbers, dots, dashes or underscores');
  if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password) > 72) throw fail(400, 'Use a password of at least 8 characters and at most 72 bytes');
  if (!roles.includes(role) || typeof displayName !== 'string' || displayName.length > 100) throw fail(400, 'Invalid role or display name');
  try {
    const hash = await bcrypt.hash(password, 10);
    const row = (await db.query('INSERT INTO public.users (username,password_hash,role,display_name) VALUES ($1,$2,$3,$4) RETURNING user_id AS "userId",username,role', [username, hash, role, displayName.trim()])).rows[0];
    res.status(201).json(row);
  } catch (error) { if (error.code === '23505') throw fail(409, 'That username already exists'); throw error; }
}));
router.get('/preferences', (req, res) => res.json({ displayName: req.account.display_name, ...req.account.preferences, role: req.account.role, username: req.account.username }));
router.put('/preferences', wrap(async (req, res) => {
  const { displayName, workspace, theme, defaultFilter, notifications } = req.body;
  if (typeof displayName !== 'string' || displayName.length > 100 || ![...workspaces, 'All workspaces'].includes(workspace) || !['dark','light'].includes(theme) || !['all','clean','review','tampered'].includes(defaultFilter) || typeof notifications !== 'boolean') throw fail(400, 'Invalid preferences');
  const preferences = { workspace, theme, defaultFilter, notifications };
  await db.query('UPDATE public.users SET display_name=$1,preferences=$2 WHERE user_id=$3', [displayName.trim(), JSON.stringify(preferences), req.account.user_id]);
  res.json({ displayName: displayName.trim(), ...preferences });
}));
router.get('/activity', wrap(async (_req, res) => {
  res.json((await db.query(`SELECT l.log_id AS id,l.doc_id AS "docId",d.filename,d.workspace,d.is_demo AS "isDemo",u.username,l.action,l.detail,l.created_at AS timestamp
    FROM public.access_log_cache l JOIN public.documents d ON d.doc_id=l.doc_id JOIN public.users u ON u.user_id=l.user_id ORDER BY l.created_at DESC LIMIT 250`)).rows);
}));
router.get('/notifications', wrap(async (req, res) => {
  res.json((await db.query(`SELECT d.doc_id AS "docId",d.filename,d.workspace,d.is_demo AS "isDemo",d.updated_at AS timestamp,
    (r.read_at IS NOT NULL AND r.read_at >= d.updated_at) AS read
    FROM public.documents d LEFT JOIN public.notification_reads r ON r.doc_id=d.doc_id AND r.user_id=$1
    WHERE d.status='tampered' OR d.ai_risk_flag='review_recommended' ORDER BY d.updated_at DESC`, [req.account.user_id])).rows);
}));
router.post('/notifications/read', wrap(async (req, res) => {
  if (!Array.isArray(req.body.ids) || req.body.ids.length > 250 || !req.body.ids.every(isUuid)) throw fail(400, 'Invalid notification IDs');
  await db.query(`INSERT INTO public.notification_reads (user_id,doc_id) SELECT $1,doc_id FROM public.documents WHERE doc_id=ANY($2::uuid[])
    ON CONFLICT (user_id,doc_id) DO UPDATE SET read_at=now()`, [req.account.user_id, req.body.ids]);
  res.json({ saved: true });
}));
router.get('/records/:id', wrap(async (req, res) => {
  const row = await record(req.params.id);
  await log(row, req.account.user_id, 'view', 'Opened document details');
  const versions = (await db.query(`SELECT version_number AS version,doc_hash AS "docHash",reason,updated_by AS "updatedBy",created_at AS timestamp FROM public.document_versions WHERE doc_id=$1 ORDER BY version_number`, [row.doc_id])).rows;
  res.json({ ...await publicRecord(row), versions });
}));
router.get('/records/:id/history', wrap(async (req, res) => {
  const row = await record(req.params.id);
  if (!row.is_demo) {
    const history = await chain.getDocumentHistory(row.doc_id);
    if (history === null) throw fail(503, 'Blockchain history is unavailable');
    return res.json({ source: 'blockchain', rows: history });
  }
  const rows = (await db.query(`SELECT l.action,l.detail,u.username AS "userId",l.created_at AS timestamp FROM public.access_log_cache l JOIN public.users u ON u.user_id=l.user_id WHERE doc_id=$1 ORDER BY l.created_at DESC`, [row.doc_id])).rows;
  res.json({ source: 'local-demo', rows });
}));
router.post('/records/:id/verify', wrap(async (req, res) => {
  const row = await record(req.params.id);
  const result = await checked(row);
  if (result.missing) throw fail(404, 'The saved file is missing');
  if (result.unavailable) throw fail(503, 'Blockchain service unavailable; verification could not be completed');
  await db.transaction(async (client) => {
    await client.query('UPDATE public.documents SET status=$1 WHERE doc_id=$2', [result.status, row.doc_id]);
    await log(row, req.account.user_id, 'verify', `${row.is_demo ? 'Local demo fingerprint' : 'Blockchain fingerprint'}: ${result.status === 'verified' ? 'matched' : 'mismatch'}`, client);
  });
  res.json(result);
}));
router.get('/records/:id/download', wrap(async (req, res) => {
  const row = await record(req.params.id);
  let filepath = row.filepath;
  if (req.query.version) {
    if (!/^\d+$/.test(req.query.version)) throw fail(400, 'Invalid version');
    const version = (await db.query('SELECT filepath FROM public.document_versions WHERE doc_id=$1 AND version_number=$2', [row.doc_id, req.query.version])).rows[0];
    if (!version) throw fail(404, 'Version not found'); filepath = version.filepath;
  }
  const root = await fs.realpath(process.env.UPLOAD_DIR);
  const real = await fs.realpath(filepath).catch(() => { throw fail(404, 'File not found'); });
  const relative = path.relative(root, real);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw fail(403, 'File is outside the upload directory');
  await log(row, req.account.user_id, 'download', req.query.version ? `Downloaded version ${req.query.version}` : 'Downloaded current document');
  res.download(real, row.filename);
}));
router.patch('/records/:id', wrap(async (req, res) => {
  const row = await record(req.params.id);
  const { workspace, caseReference, assignedTo } = req.body;
  if (!workspaces.includes(workspace) || typeof caseReference !== 'string' || caseReference.length > 80 || (assignedTo !== null && !isUuid(assignedTo))) throw fail(400, 'Invalid document metadata');
  if (assignedTo && !(await db.query('SELECT 1 FROM public.users WHERE user_id=$1', [assignedTo])).rowCount) throw fail(400, 'Assignee does not exist');
  await db.transaction(async (client) => {
    await client.query('UPDATE public.documents SET workspace=$1,case_reference=$2,assigned_to=$3 WHERE doc_id=$4', [workspace, caseReference.trim(), assignedTo, row.doc_id]);
    await log(row, req.account.user_id, 'share', 'Updated workspace, case reference or assignee', client);
  });
  res.json({ saved: true });
}));

// Explicit demo uploads are separate from real chain-backed uploads. They are
// development-only and are always marked as demo records in the database/UI.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
const demoOnly = (_req, _res, next) => process.env.NODE_ENV === 'production' ? next(fail(403, 'Demo uploads are disabled in production')) : next();
router.post('/demo/upload', demoOnly, upload.single('file'), wrap(async (req, res) => {
  if (!req.file) throw fail(400, 'Choose a file');
  const workspace = req.body.workspace || workspaces[0];
  if (!workspaces.includes(workspace)) throw fail(400, 'Invalid workspace');
  const id = crypto.randomUUID();
  const filepath = path.join(process.env.UPLOAD_DIR, `${id}${path.extname(req.file.originalname)}`);
  const hash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
  await fs.writeFile(filepath, req.file.buffer, { flag: 'wx' });
  try {
    await db.transaction(async (client) => {
      await client.query(`INSERT INTO public.documents (doc_id,filename,filepath,doc_hash,uploader_id,ai_risk_flag,status,is_demo,workspace) VALUES ($1,$2,$3,$4,$5,'review_recommended','verified',true,$6)`, [id, path.basename(req.file.originalname), filepath, hash, req.account.user_id, workspace]);
      await client.query(`INSERT INTO public.document_versions (doc_id,version_number,filepath,doc_hash,reason,updated_by) VALUES ($1,1,$2,$3,'Demo upload; no blockchain registration',$4)`, [id, filepath, hash, req.account.user_id]);
      await log({ doc_id: id }, req.account.user_id, 'upload', 'Demo file uploaded; no blockchain registration', client);
    });
  } catch (error) { await fs.unlink(filepath).catch(() => {}); throw error; }
  res.status(201).json({ docId: id, isDemo: true });
}));
router.post('/records/:id/demo-version', demoOnly, upload.single('file'), wrap(async (req, res) => {
  const row = await record(req.params.id);
  if (!row.is_demo) throw fail(400, 'Use the blockchain version endpoint for real records');
  if (!req.file || typeof req.body.reason !== 'string' || !req.body.reason.trim() || req.body.reason.length > 500) throw fail(400, 'Choose a file and enter a reason (up to 500 characters)');
  const filepath = path.join(process.env.UPLOAD_DIR, `${crypto.randomUUID()}${path.extname(req.file.originalname)}`);
  const hash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
  await fs.writeFile(filepath, req.file.buffer, { flag: 'wx' });
  try {
    const version = await db.transaction(async (client) => {
      const current = (await client.query('SELECT current_version FROM public.documents WHERE doc_id=$1 FOR UPDATE', [row.doc_id])).rows[0];
      const number = current.current_version + 1;
      await client.query('INSERT INTO public.document_versions (doc_id,version_number,filepath,doc_hash,reason,updated_by) VALUES ($1,$2,$3,$4,$5,$6)', [row.doc_id, number, filepath, hash, req.body.reason.trim(), req.account.user_id]);
      await client.query("UPDATE public.documents SET current_version=$1,filepath=$2,doc_hash=$3,status='verified',ai_risk_flag='review_recommended' WHERE doc_id=$4", [number, filepath, hash, row.doc_id]);
      await log(row, req.account.user_id, 'upload', `Added demo version ${number}: ${req.body.reason.trim()}`, client);
      return number;
    });
    res.status(201).json({ version });
  } catch (error) { await fs.unlink(filepath).catch(() => {}); throw error; }
}));
router.use((error, _req, res, _next) => {
  if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Files must be 50 MB or smaller' });
  const status = [400,401,403,404,409,503].includes(error.status) ? error.status : 500;
  if (status === 500) console.error('[workspace]', error.message);
  res.status(status).json({ error: status === 500 ? 'Unable to complete this action' : error.message });
});
module.exports = router;
