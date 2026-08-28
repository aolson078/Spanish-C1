import { dialog, ipcMain } from 'electron';
import path from 'node:path';
import type { AiProvider } from '../../packages/ai-provider/src/contracts.js';
import { AiProviderError } from '../../packages/ai-provider/src/errors.js';
import { SessionWorkflowError, type ApplicationService } from './application-service.js';
import { isAssessmentId, isLearnerDecision, isLearnerText, isSessionId, isWeaknessId } from './ipc-validation.js';
import { RecoveryCoordinator, RecoveryCoordinatorError } from './recovery-coordinator.js';
import { getReadinessStatus } from './readiness.js';
import { maximumImportBytes } from '../../packages/persistence/src/portable-transfer.js';
import { readBoundedRegularFile } from './bounded-file.js';
import { AudioServiceError, type AudioRetention, type AudioService } from './audio-service.js';

const publicError = (error: unknown): { code: string; message: string } => {
  if (error instanceof AiProviderError) {
    return { code: error.code, message: error.message };
  }
  if (error instanceof SessionWorkflowError) {
    return { code: 'INVALID_SESSION_STATE', message: error.message };
  }
  if (error instanceof AudioServiceError) return { code: error.code, message: error.message };
  if (error instanceof Error && error.name === 'PortableRecoveryError') return { code: 'RECOVERY_FAILED', message: error.message };
  if (error instanceof RecoveryCoordinatorError) return { code: 'RECOVERY_FAILED', message: error.message };
  return { code: 'UNEXPECTED', message: 'The local request failed unexpectedly.' };
};

const toAudioBytes = (value: unknown): Uint8Array | undefined => {
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  return undefined;
};

export const registerIpcHandlers = (provider: AiProvider, application: ApplicationService, audio: AudioService, recovery: RecoveryCoordinator, restart: () => void): void => {
  let restoreInProgress = false;
  let activeAsyncMutations = 0;
  const recoveryBusy = () => ({ ok: false as const, error: { code: 'RESTORE_BUSY', message: 'Learning data is locked while recovery is in progress.' } });
  ipcMain.handle('app:get-bootstrap-status', () => ({ ok: true as const, value: { mode: 'normal' as const, activeDataRoot: application.activeDataRoot } }));
  ipcMain.handle('app:get-state', () => restoreInProgress ? recoveryBusy() : ({ ok: true as const, value: application.getState() }));
  ipcMain.handle('app:get-readiness', async () => {
    if (restoreInProgress) return recoveryBusy();
    try { return { ok: true as const, value: await getReadinessStatus(provider, application, audio.getStatus(application.getAudioRetention())) }; }
    catch (error) { return { ok: false as const, error: publicError(error) }; }
  });
  ipcMain.handle('app:acknowledge-setup', () => {
    if (restoreInProgress) return recoveryBusy();
    try { application.acknowledgeSetup(); return { ok: true as const, value: undefined }; }
    catch (error) { return { ok: false as const, error: publicError(error) }; }
  });

  ipcMain.handle('data:list-backups', () => {
    if (restoreInProgress) return recoveryBusy();
    try { return { ok: true as const, value: application.listBackups() }; }
    catch (error) { return { ok: false as const, error: publicError(error) }; }
  });
  ipcMain.handle('data:create-backup', async () => {
    if (restoreInProgress) return recoveryBusy();
    activeAsyncMutations += 1;
    try { return { ok: true as const, value: await application.createBackup() }; }
    catch (error) { return { ok: false as const, error: publicError(error) }; }
    finally { activeAsyncMutations -= 1; }
  });
  ipcMain.handle('data:create-export', () => {
    if (restoreInProgress || activeAsyncMutations > 0) return recoveryBusy();
    try { return { ok: true as const, value: application.createExport() }; }
    catch (error) { return { ok: false as const, error: publicError(error) }; }
  });
  ipcMain.handle('data:preview-backup', (_event, id: unknown) => {
    if (restoreInProgress) return recoveryBusy();
    if (typeof id !== 'string') return { ok: false as const, error: { code: 'INVALID_INPUT', message: 'Choose a valid managed backup.' } };
    try { return { ok: true as const, value: recovery.previewBackup(id) }; }
    catch (error) { return { ok: false as const, error: publicError(error) }; }
  });
  ipcMain.handle('data:select-import', async () => {
    if (restoreInProgress) return recoveryBusy();
    const selection = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Spanish C1 export', extensions: ['json'] }] });
    if (selection.canceled || selection.filePaths.length !== 1) return { ok: true as const, value: undefined };
    const selected = selection.filePaths[0]!;
    try {
      const bytes = readBoundedRegularFile(selected, maximumImportBytes);
      return { ok: true as const, value: recovery.previewImport(bytes, path.basename(selected)) };
    } catch (error) { return { ok: false as const, error: publicError(error) }; }
  });
  const commitRecovery = async (token: unknown, confirmation: unknown, requiredConfirmation: 'IMPORT' | 'RESTORE') => {
    if (typeof token !== 'string' || confirmation !== requiredConfirmation) return { ok: false as const, error: { code: 'INVALID_INPUT', message: `Preview the operation and type ${requiredConfirmation} exactly.` } };
    if (restoreInProgress || activeAsyncMutations > 0) return recoveryBusy();
    restoreInProgress = true;
    try {
      const value = await recovery.commit(token, requiredConfirmation, activeAsyncMutations);
      restart();
      return { ok: true as const, value };
    } catch (error) {
      if (!(error instanceof RecoveryCoordinatorError) || !error.repositoryClosed) restoreInProgress = false;
      else restart();
      return { ok: false as const, error: publicError(error) };
    }
  };
  ipcMain.handle('data:commit-import', (_event, token: unknown, confirmation: unknown) => commitRecovery(token, confirmation, 'IMPORT'));
  ipcMain.handle('data:commit-restore', (_event, token: unknown, confirmation: unknown) => commitRecovery(token, confirmation, 'RESTORE'));

  ipcMain.handle('ai:diagnostics', async () => {
    try {
      return { ok: true as const, value: await provider.getDiagnostics() };
    } catch (error) {
      return { ok: false as const, error: publicError(error) };
    }
  });

  ipcMain.handle('ai:propose-correction', async (_event, learnerText: unknown) => {
    if (restoreInProgress) return recoveryBusy();
    if (!isLearnerText(learnerText)) {
      return {
        ok: false as const,
        error: { code: 'INVALID_INPUT', message: 'Enter between 1 and 5,000 characters.' },
      };
    }

    activeAsyncMutations += 1;
    try {
      return {
        ok: true as const,
        value: await application.analyzeProduction(learnerText.trim()),
      };
    } catch (error) {
      return { ok: false as const, error: publicError(error) };
    } finally {
      activeAsyncMutations -= 1;
    }
  });

  ipcMain.handle('audio:get-status', () => {
    if (restoreInProgress) return recoveryBusy();
    return { ok: true as const, value: audio.getStatus(application.getAudioRetention()) };
  });

  ipcMain.handle('audio:set-retention', (_event, retention: unknown) => {
    if (restoreInProgress) return recoveryBusy();
    if (retention !== 'discard' && retention !== 'keep') {
      return { ok: false as const, error: { code: 'INVALID_INPUT', message: 'Choose a valid audio retention option.' } };
    }
    try {
      application.setAudioRetention(retention as AudioRetention);
      return { ok: true as const, value: audio.getStatus(retention) };
    } catch (error) { return { ok: false as const, error: publicError(error) }; }
  });

  ipcMain.handle('audio:transcribe-session', async (_event, sessionId: unknown, value: unknown) => {
    if (restoreInProgress) return recoveryBusy();
    const bytes = toAudioBytes(value);
    if (!isSessionId(sessionId) || !bytes) {
      return { ok: false as const, error: { code: 'INVALID_INPUT', message: 'Record a valid session response.' } };
    }
    activeAsyncMutations += 1;
    try {
      return { ok: true as const, value: await audio.transcribe(sessionId, bytes, application.getAudioRetention()) };
    } catch (error) { return { ok: false as const, error: publicError(error) }; }
    finally { activeAsyncMutations -= 1; }
  });

  ipcMain.handle('audio:submit-transcript', async (_event, sessionId: unknown, token: unknown, transcript: unknown) => {
    if (restoreInProgress) return recoveryBusy();
    if (!isSessionId(sessionId) || typeof token !== 'string' || !isLearnerText(transcript)) {
      return { ok: false as const, error: { code: 'INVALID_INPUT', message: 'Confirm a valid transcript before continuing.' } };
    }
    activeAsyncMutations += 1;
    let claim;
    try {
      claim = audio.claimTranscript(token, sessionId, transcript);
      const progress = await application.submitSessionText(sessionId, claim.transcript, 'spoken');
      return { ok: true as const, value: progress };
    } catch (error) {
      if (claim) audio.restoreTranscript(claim);
      return { ok: false as const, error: publicError(error) };
    }
    finally { activeAsyncMutations -= 1; }
  });

  ipcMain.handle('audio:synthesize', async (_event, text: unknown) => {
    if (restoreInProgress) return recoveryBusy();
    if (!isLearnerText(text)) {
      return { ok: false as const, error: { code: 'INVALID_INPUT', message: 'Choose valid Spanish text to play.' } };
    }
    try { return { ok: true as const, value: await audio.synthesize(text) }; }
    catch (error) { return { ok: false as const, error: publicError(error) }; }
  });

  ipcMain.handle('session:start-fifteen', () => {
    if (restoreInProgress) return recoveryBusy();
    try {
      return { ok: true as const, value: application.startFifteenMinuteSession() };
    } catch (error) {
      return { ok: false as const, error: publicError(error) };
    }
  });

  ipcMain.handle('session:advance-warmup', (_event, sessionId: unknown) => {
    if (restoreInProgress) return recoveryBusy();
    try {
      if (!isSessionId(sessionId)) throw new SessionWorkflowError('A valid session is required.');
      return { ok: true as const, value: application.advanceWarmup(sessionId) };
    } catch (error) {
      return { ok: false as const, error: publicError(error) };
    }
  });

  ipcMain.handle('session:submit-text', async (_event, sessionId: unknown, learnerText: unknown) => {
    if (restoreInProgress) return recoveryBusy();
    if (!isSessionId(sessionId) || !isLearnerText(learnerText)) {
      return { ok: false as const, error: { code: 'INVALID_INPUT', message: 'Enter between 1 and 5,000 characters.' } };
    }
    activeAsyncMutations += 1;
    try {
      return {
        ok: true as const,
        value: await application.submitSessionText(sessionId, learnerText.trim()),
      };
    } catch (error) {
      return { ok: false as const, error: publicError(error) };
    } finally {
      activeAsyncMutations -= 1;
    }
  });

  ipcMain.handle('session:review-correction', (_event, sessionId: unknown, decision: unknown) => {
    if (restoreInProgress) return recoveryBusy();
    try {
      if (!isSessionId(sessionId) || !isLearnerDecision(decision)) {
        throw new SessionWorkflowError('Choose a valid correction response.');
      }
      return { ok: true as const, value: application.reviewCorrection(sessionId, decision) };
    } catch (error) {
      return { ok: false as const, error: publicError(error) };
    }
  });

  ipcMain.handle('session:complete-fifteen', (_event, sessionId: unknown) => {
    if (restoreInProgress) return recoveryBusy();
    try {
      if (!isSessionId(sessionId)) throw new SessionWorkflowError('A valid session is required.');
      return { ok: true as const, value: application.completeFifteenMinuteSession(sessionId) };
    } catch (error) {
      return { ok: false as const, error: publicError(error) };
    }
  });

  ipcMain.handle('weakness:get-detail', (_event, weaknessId: unknown) => {
    if (restoreInProgress) return recoveryBusy();
    try {
      if (!isWeaknessId(weaknessId)) throw new SessionWorkflowError('A valid weakness is required.');
      return { ok: true as const, value: application.getWeaknessDetail(weaknessId) };
    } catch (error) {
      return { ok: false as const, error: publicError(error) };
    }
  });

  ipcMain.handle('weakness:set-paused', (_event, weaknessId: unknown, paused: unknown) => {
    if (restoreInProgress) return recoveryBusy();
    try {
      if (!isWeaknessId(weaknessId) || typeof paused !== 'boolean') {
        throw new SessionWorkflowError('A valid weakness control is required.');
      }
      return { ok: true as const, value: application.setWeaknessPaused(weaknessId, paused) };
    } catch (error) {
      return { ok: false as const, error: publicError(error) };
    }
  });

  ipcMain.handle('assessment:start', (_event, kind: unknown) => {
    if (restoreInProgress) return recoveryBusy();
    try {
      if (kind !== 'baseline' && kind !== 'checkpoint') {
        throw new SessionWorkflowError('Choose a valid assessment type.');
      }
      return { ok: true as const, value: application.startAssessment(kind) };
    } catch (error) {
      return { ok: false as const, error: publicError(error) };
    }
  });

  ipcMain.handle('assessment:submit-response', async (_event, assessmentId: unknown, response: unknown) => {
    if (restoreInProgress) return recoveryBusy();
    if (!isAssessmentId(assessmentId) || !isLearnerText(response)) {
      return { ok: false as const, error: { code: 'INVALID_INPUT', message: 'Enter between 1 and 5,000 characters.' } };
    }
    activeAsyncMutations += 1;
    try {
      return {
        ok: true as const,
        value: await application.submitAssessmentResponse(assessmentId, response.trim()),
      };
    } catch (error) {
      return { ok: false as const, error: publicError(error) };
    } finally {
      activeAsyncMutations -= 1;
    }
  });
};
