import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frontendRequire = createRequire(path.resolve(directory, '../frontend/package.json'));
const { createServer } = await import(pathToFileURL(frontendRequire.resolve('vite')).href);
let api;
let frontend;
let postgres;
try {
  if (process.argv.includes('--local')) {
    const { startLocalPostgres } = await import('./local-postgres.mjs');
    postgres = await startLocalPostgres();
  }
  const { startServer } = require('../src/server');
  api = await startServer();
  if (postgres?.created) await require('./seed').seed();
  frontend = await createServer({ configFile: path.join(directory, 'vite.config.mjs') });
  await frontend.listen();
  frontend.printUrls();
  const close = async () => {
    await frontend.close();
    await api.close();
    await postgres?.close();
    process.exit(0);
  };
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, close);
} catch (error) {
  console.error('[dev]', error.message);
  await frontend?.close();
  await api?.close();
  await postgres?.close();
  process.exit(1);
}
