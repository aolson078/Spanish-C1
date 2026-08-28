import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveDataLocation } from './data-location.js';

const baseInput = {
  appPath: 'C:\\project',
  executablePath: 'C:\\temporary-extraction\\Spanish C1.exe',
  isPackaged: true,
};

describe('desktop data location', () => {
  it('stores portable data beside the original portable executable', () => {
    expect(resolveDataLocation({
      ...baseInput,
      portableExecutableDirectory: 'D:\\Spanish-C1',
    })).toEqual({
      configuredRoot: './data',
      projectRoot: path.resolve('D:\\Spanish-C1'),
    });
  });

  it('stores unpacked packaged data beside its executable', () => {
    expect(resolveDataLocation(baseInput).projectRoot).toBe(path.dirname(baseInput.executablePath));
  });

  it('keeps development data beneath the project app path', () => {
    expect(resolveDataLocation({ ...baseInput, isPackaged: false }).projectRoot).toBe(baseInput.appPath);
  });

  it('preserves an explicit data-root override and ignores an empty portable directory', () => {
    expect(resolveDataLocation({
      ...baseInput,
      configuredDataRoot: 'E:\\Spanish-C1-Data',
      portableExecutableDirectory: '  ',
    })).toEqual({
      configuredRoot: 'E:\\Spanish-C1-Data',
      projectRoot: path.dirname(baseInput.executablePath),
    });
  });
});
