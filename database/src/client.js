'use strict';

const path = require('node:path');
const { Pool } = require('pg');

// Load database/.env when this package is run directly. When imported by the
// backend, DATABASE_URL already present in process.env continues to take priority.
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const poolConfig = {
  max: Number.parseInt(process.env.DB_POOL_MAX || '10', 10),
  idleTimeoutMillis: Number.parseInt(process.env.DB_IDLE_TIMEOUT_MS || '30000', 10),
  connectionTimeoutMillis: Number.parseInt(process.env.DB_CONNECT_TIMEOUT_MS || '5000', 10),
};

if (process.env.DATABASE_URL) {
  poolConfig.connectionString = process.env.DATABASE_URL;
}

if (process.env.DB_SSL === 'true') {
  poolConfig.ssl = { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' };
}

const pool = new Pool(poolConfig);

pool.on('error', (error) => {
  console.error('[database] Unexpected error on an idle PostgreSQL client:', error);
});

function query(text, params) {
  return pool.query(text, params);
}

function getClient() {
  return pool.connect();
}

async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function close() {
  return pool.end();
}

module.exports = { pool, query, getClient, transaction, close };
