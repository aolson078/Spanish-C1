import { accessSync, constants, mkdirSync, statSync } from 'node:fs';
import path from 'node:path';

export class DataRootError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'DataRootError';
  }
}

export interface DataPaths {
  readonly root: string;
  readonly database: string;
  readonly references: string;
  readonly recordings: string;
  readonly exports: string;
  readonly backups: string;
  readonly logs: string;
  readonly settings: string;
  readonly testTemp: string;
  readonly recovery: string;
}

export const resolveWithinDataRoot = (root: string, relativePath: string): string => {
  if (!relativePath || path.isAbsolute(relativePath)) {
    throw new DataRootError('Data paths must be non-empty paths relative to APP_DATA_ROOT.');
  }
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relativePath);
  const relative = path.relative(resolvedRoot, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new DataRootError('A data path attempted to escape APP_DATA_ROOT.');
  }
  return resolved;
};

export const initializeDataRoot = (
  configuredRoot = process.env.APP_DATA_ROOT ?? './data',
  projectRoot = process.cwd(),
): DataPaths => {
  const root = path.resolve(projectRoot, configuredRoot);
  try {
    mkdirSync(root, { recursive: true });
    if (!statSync(root).isDirectory()) throw new Error('Path is not a directory.');
    accessSync(root, constants.R_OK | constants.W_OK);
  } catch (error) {
    throw new DataRootError(`APP_DATA_ROOT is unavailable or not writable: ${root}`, { cause: error });
  }

  const paths: DataPaths = {
    root,
    database: resolveWithinDataRoot(root, 'spanish-c1.sqlite'),
    references: resolveWithinDataRoot(root, 'references'),
    recordings: resolveWithinDataRoot(root, 'recordings'),
    exports: resolveWithinDataRoot(root, 'exports'),
    backups: resolveWithinDataRoot(root, 'backups'),
    logs: resolveWithinDataRoot(root, 'logs'),
    settings: resolveWithinDataRoot(root, 'settings.json'),
    testTemp: resolveWithinDataRoot(root, '.test-tmp'),
    recovery: resolveWithinDataRoot(root, '.recovery'),
  };

  for (const directory of [
    paths.references,
    paths.recordings,
    paths.exports,
    paths.backups,
    paths.logs,
    paths.recovery,
  ]) {
    mkdirSync(directory, { recursive: true });
  }

  return paths;
};
