import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DataRootError,
  initializeDataRoot,
  resolveWithinDataRoot,
} from '../src/data-root.js';
import { createTestDataRoot, removeTestDataRoot } from './test-root.js';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) removeTestDataRoot(root);
});

describe('portable data root', () => {
  it('creates every application-owned directory beneath the configured root', () => {
    const paths = createTestDataRoot();
    roots.push(paths.root);

    for (const candidate of [
      paths.references,
      paths.recordings,
      paths.exports,
      paths.backups,
      paths.logs,
    ]) {
      expect(existsSync(candidate)).toBe(true);
      expect(path.relative(paths.root, candidate)).not.toMatch(/^\.\./);
    }
    expect(path.dirname(paths.database)).toBe(paths.root);
  });

  it('rejects absolute and traversal paths', () => {
    const paths = createTestDataRoot();
    roots.push(paths.root);

    expect(() => resolveWithinDataRoot(paths.root, '../outside.sqlite')).toThrow(DataRootError);
    expect(() => resolveWithinDataRoot(paths.root, path.resolve('outside.sqlite'))).toThrow(
      DataRootError,
    );
  });

  it('fails clearly instead of silently switching when the root is a file', () => {
    const paths = createTestDataRoot();
    roots.push(paths.root);
    const file = path.join(paths.root, 'not-a-directory');
    writeFileSync(file, 'synthetic');

    expect(() => initializeDataRoot(file)).toThrow(/unavailable or not writable/);
  });
});
