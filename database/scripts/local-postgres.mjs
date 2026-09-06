import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import EmbeddedPostgres from 'embedded-postgres';

const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Optional development runtime for machines without Docker/PostgreSQL.
// Data is persistent and is never automatically deleted.
export async function startLocalPostgres() {
  dotenv.config({ path: path.join(directory, '.env') });
  const connectionString = process.env.DATABASE_URL || 'postgresql://sih_user:sih_password@127.0.0.1:5432/sih26190';
  const url = new URL(connectionString);
  if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
    throw new Error('dev:local only starts local PostgreSQL. Use npm run dev for your configured hosted database.');
  }
  process.env.DATABASE_URL = connectionString;
  const databaseDir = path.join(directory, '.local-postgres');
  const postgres = new EmbeddedPostgres({
    databaseDir, user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
    port: Number(url.port || 5432), persistent: true,
    postgresFlags: ['-c', 'listen_addresses=127.0.0.1'],
    onLog: () => {}, onError: (message) => console.error('[postgres]', message),
  });
  if (!fs.existsSync(path.join(databaseDir, 'PG_VERSION'))) await postgres.initialise();
  await postgres.start();
  try {
    const database = decodeURIComponent(url.pathname.slice(1));
    if (!database) throw new Error('DATABASE_URL must include a database name.');
    const client = postgres.getPgClient('postgres');
    await client.connect();
    let created;
    try {
      const result = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [database]);
      created = result.rowCount === 0;
    } finally { await client.end(); }
    if (created) await postgres.createDatabase(database);
    console.log('[postgres] Local database ready; data stays in database/.local-postgres.');
    return { created, close: () => postgres.stop() };
  } catch (error) {
    await postgres.stop();
    throw error;
  }
}
