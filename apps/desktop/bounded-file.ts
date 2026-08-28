import { closeSync, fstatSync, lstatSync, openSync, readSync } from 'node:fs';

export class BoundedFileError extends Error {
  constructor(message: string) { super(message); this.name = 'BoundedFileError'; }
}

export const readBoundedRegularFile = (file: string, maximumBytes: number): Buffer => {
  const linkMetadata = lstatSync(file);
  if (!linkMetadata.isFile() || linkMetadata.isSymbolicLink()) throw new BoundedFileError('Choose a regular file.');
  const descriptor = openSync(file, 'r');
  try {
    const metadata = fstatSync(descriptor);
    if (!metadata.isFile() || metadata.size > maximumBytes) throw new BoundedFileError('The selected file exceeds the allowed size.');
    const bytes = Buffer.allocUnsafe(metadata.size);
    let offset = 0;
    while (offset < bytes.length) {
      const count = readSync(descriptor, bytes, offset, bytes.length - offset, offset);
      if (count === 0) throw new BoundedFileError('The selected file changed while it was being read.');
      offset += count;
    }
    if (readSync(descriptor, Buffer.alloc(1), 0, 1, offset) !== 0) throw new BoundedFileError('The selected file changed while it was being read.');
    return bytes;
  } finally { closeSync(descriptor); }
};
