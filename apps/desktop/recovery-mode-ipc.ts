import { dialog, ipcMain } from 'electron';
import path from 'node:path';
import { maximumImportBytes } from '../../packages/persistence/src/portable-transfer.js';
import { RecoveryCoordinatorError } from './recovery-coordinator.js';
import { RecoveryModeService, type BootstrapStatus } from './recovery-mode.js';
import { readBoundedRegularFile } from './bounded-file.js';

const failure = (error: unknown) => ({ ok: false as const, error: { code: 'RECOVERY_FAILED', message: error instanceof Error ? error.message : 'Recovery failed safely.' } });

export const registerRecoveryModeIpc = (service: RecoveryModeService, status: BootstrapStatus, restart: () => void): void => {
  ipcMain.handle('app:get-bootstrap-status', () => ({ ok: true as const, value: status }));
  ipcMain.handle('app:get-readiness', () => ({ ok: true as const, value: {
    overall: 'blocked' as const, setupAcknowledged: false,
    checks: [{ id: 'database' as const, level: 'blocked' as const, label: 'Learning database', message: status.message ?? 'The database could not be opened.' }],
  } }));
  ipcMain.handle('data:list-backups', () => {
    try { return { ok: true as const, value: service.listBackups() }; } catch (error) { return failure(error); }
  });
  ipcMain.handle('data:preview-backup', (_event, id: unknown) => {
    if (typeof id !== 'string') return failure(new RecoveryCoordinatorError('Choose a managed backup.'));
    try { return { ok: true as const, value: service.previewBackup(id) }; } catch (error) { return failure(error); }
  });
  ipcMain.handle('data:select-import', async () => {
    const selection = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Spanish C1 export', extensions: ['json'] }] });
    if (selection.canceled || selection.filePaths.length !== 1) return { ok: true as const, value: undefined };
    try {
      const selected = selection.filePaths[0]!;
      return { ok: true as const, value: service.previewImport(readBoundedRegularFile(selected, maximumImportBytes), path.basename(selected)) };
    } catch (error) { return failure(error); }
  });
  const commitRecovery = (token: unknown, confirmation: unknown, requiredConfirmation: 'IMPORT' | 'RESTORE') => {
    if (typeof token !== 'string' || confirmation !== requiredConfirmation) return failure(new RecoveryCoordinatorError(`Preview recovery and type ${requiredConfirmation} exactly.`));
    try { const value = service.commit(token, requiredConfirmation); restart(); return { ok: true as const, value }; }
    catch (error) { restart(); return failure(error); }
  };
  ipcMain.handle('data:commit-import', (_event, token: unknown, confirmation: unknown) => commitRecovery(token, confirmation, 'IMPORT'));
  ipcMain.handle('data:commit-restore', (_event, token: unknown, confirmation: unknown) => commitRecovery(token, confirmation, 'RESTORE'));
};

export const registerBlockedModeIpc = (status: BootstrapStatus): void => {
  ipcMain.handle('app:get-bootstrap-status', () => ({ ok: true as const, value: status }));
  ipcMain.handle('app:get-readiness', () => ({ ok: true as const, value: {
    overall: 'blocked' as const, setupAcknowledged: false,
    checks: [{ id: 'storage' as const, level: 'blocked' as const, label: 'Portable storage ownership', message: status.message ?? 'Another process owns this data root.' }],
  } }));
};
