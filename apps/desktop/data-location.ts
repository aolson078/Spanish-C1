import path from 'node:path';

export interface DataLocationInput {
  readonly appPath: string;
  readonly executablePath: string;
  readonly isPackaged: boolean;
  readonly configuredDataRoot?: string;
  readonly portableExecutableDirectory?: string;
}

export interface DataLocation {
  readonly configuredRoot: string;
  readonly projectRoot: string;
}

export const resolveDataLocation = (input: DataLocationInput): DataLocation => ({
  configuredRoot: input.configuredDataRoot ?? './data',
  projectRoot: input.portableExecutableDirectory?.trim()
    ? path.resolve(input.portableExecutableDirectory)
    : input.isPackaged
      ? path.dirname(input.executablePath)
      : input.appPath,
});
