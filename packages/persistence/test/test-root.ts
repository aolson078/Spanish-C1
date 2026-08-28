import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import { initializeDataRoot, type DataPaths } from '../src/data-root.js';

const testParent = path.resolve(process.cwd(), 'release', 'smoke-data-unit');

export const createTestDataRoot = (): DataPaths => {
  mkdirSync(testParent, { recursive: true });
  const root = mkdtempSync(path.join(testParent, 'persistence-'));
  return initializeDataRoot(root);
};

export const removeTestDataRoot = (root: string): void => {
  const resolved = path.resolve(root);
  const relative = path.relative(testParent, resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Refusing to clean an unexpected test path: ${resolved}`);
  }
  rmSync(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
};
