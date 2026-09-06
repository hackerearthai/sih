'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const db = require('../src/client');

const migrationsDirectory = path.resolve(__dirname, '..', 'migrations');

async function migrate() {
  const client = await db.getClient();

  try {
    // Prevent two app instances from migrating the same database concurrently.
    await client.query('SELECT pg_advisory_lock($1)', [26190]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const filenames = (await fs.readdir(migrationsDirectory))
      .filter((filename) => filename.endsWith('.sql'))
      .sort();

    for (const filename of filenames) {
      const alreadyApplied = await client.query(
        'SELECT 1 FROM schema_migrations WHERE filename = $1',
        [filename],
      );

      if (alreadyApplied.rowCount > 0) {
        console.log(`[migrate] Already applied: ${filename}`);
        continue;
      }

      const sql = await fs.readFile(path.join(migrationsDirectory, filename), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1)',
          [filename],
        );
        await client.query('COMMIT');
        console.log(`[migrate] Applied: ${filename}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [26190]).catch(() => {});
    client.release();
  }
}

module.exports = { migrate };

if (require.main === module) {
  migrate()
    .then(() => db.close())
    .catch(async (error) => {
      console.error('[migrate] Failed:', error.message);
      await db.close().catch(() => {});
      process.exitCode = 1;
    });
}
