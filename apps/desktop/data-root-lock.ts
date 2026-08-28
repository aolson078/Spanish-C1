import { createHash } from 'node:crypto';
import { createServer, type Server } from 'node:net';
import { realpathSync } from 'node:fs';

export interface DataRootLock { readonly server: Server; readonly pipeName: string }

export const acquireDataRootLock = async (root: string): Promise<DataRootLock | undefined> => {
  const identity = createHash('sha256').update(realpathSync(root).toLowerCase()).digest('hex').slice(0, 32);
  const pipeName = `\\\\.\\pipe\\spanish-c1-${identity}`;
  const server = createServer();
  return new Promise((resolve, reject) => {
    server.once('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') resolve(undefined);
      else reject(error);
    });
    server.listen(pipeName, () => resolve({ server, pipeName }));
  });
};
