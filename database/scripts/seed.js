'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const db = require('../src/client');

async function seed() {
  const seedPath = path.resolve(__dirname, '..', 'seeds', 'demo_users.sql');
  const sql = await fs.readFile(seedPath, 'utf8');
  await db.query(sql);

  const result = await db.query(
    'SELECT username, role FROM users ORDER BY username',
  );
  console.log(`[seed] Demo users ready: ${result.rows.map((user) => user.username).join(', ')}`);
}

module.exports = { seed };

if (require.main === module) {
  seed()
    .then(() => db.close())
    .catch(async (error) => {
      console.error('[seed] Failed:', error.message);
      await db.close().catch(() => {});
      process.exitCode = 1;
    });
}
