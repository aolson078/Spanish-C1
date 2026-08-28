import { afterEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { acquireDataRootLock, type DataRootLock } from './data-root-lock.js';
import { createTestDataRoot, removeTestDataRoot } from '../../packages/persistence/test/test-root.js';

const roots: string[] = [];
const locks: DataRootLock[] = [];
afterEach(async () => {
  await Promise.all(locks.splice(0).map((lock) => new Promise<void>((resolve) => lock.server.close(() => resolve()))));
  for (const root of roots.splice(0)) removeTestDataRoot(root);
});

describe('portable data-root ownership', () => {
  it('allows only one live named-pipe owner for a canonical data root', async () => {
    const paths = createTestDataRoot();
    roots.push(paths.root);
    const first = await acquireDataRootLock(paths.root);
    expect(first).toBeDefined();
    locks.push(first!);

    expect(await acquireDataRootLock(paths.root)).toBeUndefined();
  });

  it('excludes an independent Windows process from the same named pipe', async () => {
    const paths = createTestDataRoot();
    roots.push(paths.root);
    const first = await acquireDataRootLock(paths.root);
    expect(first).toBeDefined();
    locks.push(first!);
    const script = "const net=require('node:net');const s=net.createServer();s.once('error',e=>{console.log(e.code);process.exit(e.code==='EADDRINUSE'?0:2)});s.listen(process.argv[1],()=>process.exit(3));";

    const child = spawnSync(process.execPath, ['-e', script, first!.pipeName], { encoding: 'utf8', timeout: 10_000, windowsHide: true });

    expect(child.status).toBe(0);
    expect(child.stdout.trim()).toBe('EADDRINUSE');
  });
});
