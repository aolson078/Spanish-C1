import { copyFile, mkdir } from 'node:fs/promises';

await mkdir('dist/apps/desktop', { recursive: true });
await copyFile('apps/desktop/preload.cjs', 'dist/apps/desktop/preload.cjs');
