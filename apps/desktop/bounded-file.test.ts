import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createTestDataRoot, removeTestDataRoot } from '../../packages/persistence/test/test-root.js';
import { readBoundedRegularFile } from './bounded-file.js';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) removeTestDataRoot(root); });

describe('bounded authoritative file reads', () => {
  it('reads exact bytes from one regular-file handle and rejects the size boundary', () => {
    const paths = createTestDataRoot();
    roots.push(paths.root);
    const file = path.join(paths.root, 'selected.json');
    writeFileSync(file, '1234');

    expect(readBoundedRegularFile(file, 4).toString()).toBe('1234');
    expect(() => readBoundedRegularFile(file, 3)).toThrow('allowed size');
  });
});
