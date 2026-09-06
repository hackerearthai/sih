import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
export default {
  root: path.resolve(directory, '../frontend'),
  build: { outDir: path.join(directory, 'dist'), emptyOutDir: true },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    fs: { allow: [path.resolve(directory, '../frontend'), path.join(directory, 'browser')] },
    proxy: { '/api': { target: `http://127.0.0.1:${process.env.PORT || 5000}`, changeOrigin: true } },
  },
};
