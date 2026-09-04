const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const db = require('../db');
const authMiddleware = require('../middleware/auth');
const chain = require('../blockchain/contract');
const { analyzeDocument } = require('../services/aiService');

const router = express.Router();

// ─── Multer config ──────────────────────────────────────────
const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

// ─── Helpers ────────────────────────────────────────────────
function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

function removeFileQuietly(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.warn('[FILES] Could not remove file:', err.message);
  }
}

// All routes below require JWT.
router.use(authMiddleware);

// ═════════════════════════════════════════════════════════════
// 1. POST /api/documents/upload
// ═════════════════════════════════════════════════════════════
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const uploaderId = req.body.uploaderId || req.user.userId;
    const filePath = req.file.path;
    const filename = req.file.originalname;
    const docId = uuidv4();

    // 1. Compute SHA-256.
    const docHash = await hashFile(filePath);

    // 2. AI is intentionally optional while the AI teammate is still building.
    // aiService.js already returns review_recommended if the AI service is offline.
    const { aiRiskFlag } = await analyzeDocument(filePath, filename);

    // 3. Register the integrity record on-chain.
    // Do not silently return success if blockchain registration failed.
    const chainResult = await chain.registerDocument(docId, docHash, uploaderId);
    if (!chainResult) {
      removeFileQuietly(filePath);
      return res.status(503).json({
        error: 'Blockchain service unavailable',
        message: 'Document was not stored because its integrity record could not be registered on-chain.',
      });
    }

    // 4. Save metadata only after successful blockchain registration.
    await db.query(
      `INSERT INTO documents ("docId", filename, filepath, "docHash", "uploaderId", timestamp, "aiRiskFlag", "currentVersion")
       VALUES ($1, $2, $3, $4, $5, NOW(), $6, 1)`,
      [docId, filename, filePath, docHash, uploaderId, aiRiskFlag],
    );

    await db.query(
      `INSERT INTO document_versions ("docId", version, filepath, "docHash", reason, "updatedBy", timestamp)
       VALUES ($1, 1, $2, $3, 'Initial upload', $4, NOW())`,
      [docId, filePath, docHash, uploaderId],
    );

    return res.status(201).json({
      docId,
      docHash,
      aiRiskFlag,
      txHash: chainResult.txHash,
    });
  } catch (err) {
    console.error('[UPLOAD] Error:', err);
    return res.status(500).json({ error: 'Upload failed', details: err.message });
  }
});

// ═════════════════════════════════════════════════════════════
// 2. GET /api/documents
// ═════════════════════════════════════════════════════════════
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT "docId", filename, "docHash", "uploaderId", timestamp FROM documents ORDER BY timestamp DESC',
    );

    const docs = await Promise.all(
      result.rows.map(async (doc) => {
        let status = 'pending';

        try {
          const fileResult = await db.query(
            'SELECT filepath FROM documents WHERE "docId" = $1',
            [doc.docId],
          );

          const filePath = fileResult.rows[0]?.filepath;
          if (filePath && fs.existsSync(filePath)) {
            const currentHash = await hashFile(filePath);
            const chainResult = await chain.verifyDocument(doc.docId, currentHash);

            if (chainResult) {
              status = chainResult.verified ? 'verified' : 'tampered';
            }
          }
        } catch (err) {
          console.warn(`[LIST] Verify check failed for ${doc.docId}:`, err.message);
        }

        return {
          docId: doc.docId,
          filename: doc.filename,
          status,
          uploaderId: doc.uploaderId,
          timestamp: doc.timestamp,
        };
      }),
    );

    return res.json(docs);
  } catch (err) {
    console.error('[LIST] Error:', err);
    return res.status(500).json({ error: 'Failed to list documents' });
  }
});

// ═════════════════════════════════════════════════════════════
// 3. GET /api/documents/:docId
// ═════════════════════════════════════════════════════════════
router.get('/:docId', async (req, res) => {
  try {
    const { docId } = req.params;

    // Fetch DB record first so a missing document returns 404 instead of
    // failing on the blockchain access-log call.
    const result = await db.query(
      'SELECT * FROM documents WHERE "docId" = $1',
      [docId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Only supported on-chain access actions are view/download/share.
    await chain.logAccess(docId, req.user.userId, 'view');

    const doc = result.rows[0];

    const versions = await db.query(
      'SELECT version, "docHash", reason, "updatedBy", timestamp FROM document_versions WHERE "docId" = $1 ORDER BY version ASC',
      [docId],
    );

    const onChainHistory = await chain.getDocumentHistory(docId);

    return res.json({
      ...doc,
      versions: versions.rows,
      accessLog: onChainHistory || [],
    });
  } catch (err) {
    console.error('[DETAIL] Error:', err);
    return res.status(500).json({ error: 'Failed to get document details' });
  }
});

// ═════════════════════════════════════════════════════════════
// 4. POST /api/documents/:docId/verify
// ═════════════════════════════════════════════════════════════
router.post('/:docId/verify', async (req, res) => {
  try {
    const { docId } = req.params;

    const result = await db.query(
      'SELECT filepath, "docHash" FROM documents WHERE "docId" = $1',
      [docId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const { filepath } = result.rows[0];

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    const currentHash = await hashFile(filepath);
    const chainResult = await chain.verifyDocument(docId, currentHash);

    if (!chainResult) {
      return res.status(503).json({
        error: 'Blockchain service unavailable',
        message: 'The document could not be cryptographically verified.',
      });
    }

    const status = chainResult.verified ? 'verified' : 'tampered';

    // IMPORTANT:
    // Do not call chain.logAccess(..., 'verify'). The current contract only
    // accepts view/download/share, so that call would revert.
    // Verification is a read-only blockchain operation and is returned here.

    return res.json({
      status,
      onChainHash: chainResult.onChainHash,
      currentHash,
    });
  } catch (err) {
    console.error('[VERIFY] Error:', err);
    return res.status(500).json({ error: 'Verification failed' });
  }
});

// ═════════════════════════════════════════════════════════════
// 5. POST /api/documents/:docId/version
// ═════════════════════════════════════════════════════════════
router.post('/:docId/version', upload.single('file'), async (req, res) => {
  try {
    const { docId } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const reason = req.body.reason || '';
    const updatedBy = req.body.updatedBy || req.user.userId;
    const filePath = req.file.path;

    if (!reason.trim()) {
      removeFileQuietly(filePath);
      return res.status(400).json({ error: 'Reason is required for a new version' });
    }

    const docResult = await db.query(
      'SELECT "currentVersion" FROM documents WHERE "docId" = $1',
      [docId],
    );

    if (docResult.rows.length === 0) {
      removeFileQuietly(filePath);
      return res.status(404).json({ error: 'Document not found' });
    }

    const newVersion = Number(docResult.rows[0].currentVersion) + 1;
    const newHash = await hashFile(filePath);

    // Blockchain is the source of integrity truth for the version chain.
    const chainResult = await chain.addVersion(docId, newHash, reason, updatedBy);
    if (!chainResult) {
      removeFileQuietly(filePath);
      return res.status(503).json({
        error: 'Blockchain service unavailable',
        message: 'The new version was not stored because its integrity record could not be registered on-chain.',
      });
    }

    await db.query(
      `INSERT INTO document_versions ("docId", version, filepath, "docHash", reason, "updatedBy", timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [docId, newVersion, filePath, newHash, reason, updatedBy],
    );

    await db.query(
      `UPDATE documents SET "currentVersion" = $1, "docHash" = $2, filepath = $3 WHERE "docId" = $4`,
      [newVersion, newHash, filePath, docId],
    );

    return res.status(201).json({
      docId,
      version: newVersion,
      docHash: newHash,
      reason,
      updatedBy,
      txHash: chainResult.txHash,
    });
  } catch (err) {
    console.error('[VERSION] Error:', err);
    return res.status(500).json({ error: 'Version update failed' });
  }
});

// ═════════════════════════════════════════════════════════════
// 6. GET /api/documents/:docId/history
// ═════════════════════════════════════════════════════════════
router.get('/:docId/history', async (req, res) => {
  try {
    const { docId } = req.params;

    // IMPORTANT:
    // Do not call chain.logAccess(..., 'view_history'). The Solidity contract
    // intentionally accepts only view/download/share.
    const history = await chain.getDocumentHistory(docId);

    if (history === null) {
      return res.status(503).json({
        error: 'Blockchain service unavailable',
        message: 'Document history could not be read from the blockchain.',
      });
    }

    return res.json(history);
  } catch (err) {
    console.error('[HISTORY] Error:', err);
    return res.status(500).json({ error: 'Failed to get history' });
  }
});

module.exports = router;
