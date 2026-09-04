require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const db = require('./db');
const { seedUsers } = require('./db/seed');
const authRoutes = require('./routes/auth');
const documentRoutes = require('./routes/documents');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ──────────────────────────────────────────────
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Routes ─────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Global error handler ───────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Startup ────────────────────────────────────────────────
async function start() {
  try {
    // 1. Run schema SQL
    const schemaPath = path.join(__dirname, 'db', 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    await db.query(schemaSql);
    console.log('[DB] Schema applied');

    // 2. Seed demo users
    await seedUsers();

    // 3. Ensure uploads directory exists
    const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // 4. Check for smart contract config
    const contractFile = path.resolve(__dirname, '../shared/DocumentRegistry.json');
    if (fs.existsSync(contractFile)) {
      console.log('[CHAIN] DocumentRegistry.json found — blockchain features enabled');
    } else {
      console.warn('[CHAIN] shared/DocumentRegistry.json not found — blockchain features will be disabled until the file is created');
    }

    // 5. Start server
    app.listen(PORT, () => {
      console.log(`\n  🚀  SIH26190 Backend running on http://localhost:${PORT}`);
      console.log(`  📋  Endpoints:`);
      console.log(`       POST /api/auth/login`);
      console.log(`       POST /api/documents/upload`);
      console.log(`       GET  /api/documents`);
      console.log(`       GET  /api/documents/:docId`);
      console.log(`       POST /api/documents/:docId/verify`);
      console.log(`       POST /api/documents/:docId/version`);
      console.log(`       GET  /api/documents/:docId/history`);
      console.log(`       GET  /api/health\n`);
    });
  } catch (err) {
    console.error('[STARTUP] Fatal error:', err);
    process.exit(1);
  }
}

start();
