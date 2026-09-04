const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('./index');

/** Demo users — seeded on every startup (idempotent via ON CONFLICT). */
const DEMO_USERS = [
  { userId: uuidv4(), username: 'investigator1', password: 'pass123', role: 'investigator' },
  { userId: uuidv4(), username: 'clerk1',         password: 'pass123', role: 'court_clerk' },
  { userId: uuidv4(), username: 'admin1',          password: 'pass123', role: 'admin' },
];

async function seedUsers() {
  for (const u of DEMO_USERS) {
    const hash = await bcrypt.hash(u.password, 10);
    await db.query(
      `INSERT INTO users ("userId", username, "passwordHash", role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (username) DO NOTHING`,
      [u.userId, u.username, hash, u.role],
    );
  }
  console.log('[SEED] Demo users seeded (investigator1, clerk1, admin1 / pass123)');
}

module.exports = { seedUsers };
