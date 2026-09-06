'use strict';

const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const backendRequire = createRequire(path.resolve(__dirname, '../../backend/package.json'));
const db = require('./client');
const { migrate } = require('../scripts/migrate');

async function startServer({ port = Number(process.env.PORT || 5000), host = process.env.HOST || '127.0.0.1' } = {}) {
  if (!process.env.DATABASE_URL) {
    throw new Error('Set DATABASE_URL in database/.env (see .env.example).');
  }
  if (process.env.DB_AUTO_MIGRATE !== 'false') {
    await migrate();
  } else {
    console.log('[migrate] Automatic migrations disabled; using the provisioned Supabase schema.');
  }

  if (!process.env.JWT_SECRET) {
    if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET is required in production.');
    process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
    console.log('[api] Using a temporary development session secret; sign in again after restarting.');
  }
  process.env.UPLOAD_DIR = path.resolve(__dirname, '..', process.env.UPLOAD_DIR || 'uploads');

  // Configure the existing backend pool before importing its routes. The
  // canonical pool above keeps its original connection and public schema.
  const canonicalUrl = process.env.DATABASE_URL;
  const apiUrl = new URL(canonicalUrl);
  const options = apiUrl.searchParams.get('options') || '';
  apiUrl.searchParams.set('options', `${options} -c search_path=backend_api,public`.trim());
  if (process.env.DB_SSL === 'true' && !apiUrl.searchParams.has('sslmode')) {
    apiUrl.searchParams.set('sslmode', process.env.DB_SSL_REJECT_UNAUTHORIZED === 'false' ? 'no-verify' : 'verify-full');
  }
  process.env.DATABASE_URL = apiUrl.toString();
  let backendDb;
  try {
    backendDb = backendRequire('./src/db');
  } finally {
    process.env.DATABASE_URL = canonicalUrl;
  }

  const express = backendRequire('express');
  const cors = backendRequire('cors');
  const auth = backendRequire('./src/middleware/auth');
  const app = express();
  app.use(cors({ origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173' }));
  app.use(express.json({ limit: '32kb' }));
  app.get('/api/health', async (_req, res) => {
    try {
      await db.query('SELECT 1');
      res.json({ status: 'ok', database: 'connected' });
    } catch {
      res.status(503).json({ error: 'Database unavailable' });
    }
  });
  app.get('/api/auth/me', auth, async (req, res, next) => {
    try {
      const result = await db.query('SELECT user_id AS "userId", username, role FROM public.users WHERE user_id = $1', [req.user.userId]);
      if (!result.rowCount) return res.status(401).json({ error: 'Account no longer exists' });
      res.json(result.rows[0]);
    } catch (error) { next(error); }
  });
  // Read-only enrichment for the existing document list: real names, hashes,
  // and risk flags, without exposing server filesystem paths.
  app.get('/api/document-metadata', auth, async (_req, res, next) => {
    try {
      const result = await db.query(`SELECT d.doc_id AS "docId", d.doc_hash AS "docHash",
        u.username AS uploader, d.ai_risk_flag AS "aiRiskFlag"
        FROM public.documents d JOIN public.users u ON u.user_id = d.uploader_id`);
      res.json(result.rows);
    } catch (error) { next(error); }
  });
  app.use('/api/auth', backendRequire('./src/routes/auth'));
  app.use('/api/workspace', require('./workspace'));
  app.use('/api/documents', backendRequire('./src/routes/documents'));
  app.use('/api', (_req, res) => res.status(404).json({ error: 'API endpoint not found' }));
  app.use((error, _req, res, _next) => {
    if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Files must be 50 MB or smaller.' });
    console.error('[api]', error.message);
    res.status(error.status === 400 ? 400 : 500).json({ error: error.status === 400 ? 'Invalid request body' : 'Internal server error' });
  });
  const server = await new Promise((resolve, reject) => {
    const listener = app.listen(port, host, () => resolve(listener));
    listener.once('error', reject);
  });
  console.log(`[api] Database connected. API listening on http://${host}:${server.address().port}`);
  return {
    server,
    async close() {
      server.closeIdleConnections?.();
      await new Promise((resolve) => server.close(resolve));
      await backendDb.pool.end();
      await db.close();
    },
  };
}

module.exports = { startServer };

if (require.main === module) {
  startServer().then(({ close }) => {
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => close().then(() => process.exit(0)));
  }).catch(async (error) => {
    console.error('[api] Startup failed:', error.message);
    await db.close().catch(() => {});
    process.exit(1);
  });
}
