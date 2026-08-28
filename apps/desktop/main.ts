import { app, BrowserWindow, dialog } from 'electron';
import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AiProvider, AssessmentEvaluationRequest, CorrectionRequest } from '../../packages/ai-provider/src/contracts.js';
import { FetchHttpTransport } from '../../packages/ai-provider/src/fetch-transport.js';
import { loadOllamaConfig } from '../../packages/ai-provider/src/config.js';
import { AiProviderError } from '../../packages/ai-provider/src/errors.js';
import { OllamaProvider } from '../../packages/ai-provider/src/ollama-provider.js';
import { initializeDataRoot } from '../../packages/persistence/src/data-root.js';
import { SpanishC1Repository } from '../../packages/persistence/src/repository.js';
import { ApplicationService } from './application-service.js';
import { acquireDataRootLock, type DataRootLock } from './data-root-lock.js';
import { resolveDataLocation } from './data-location.js';
import { registerIpcHandlers } from './ipc.js';
import { reconcilePendingRecovery, RecoveryCoordinator } from './recovery-coordinator.js';
import type { DataPaths } from '../../packages/persistence/src/data-root.js';
import { RecoveryModeService } from './recovery-mode.js';
import { registerBlockedModeIpc, registerRecoveryModeIpc } from './recovery-mode-ipc.js';
import { AudioService, NodeProcessAudioEngine } from './audio-service.js';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
let repository: SpanishC1Repository | undefined;
let dataRootLock: DataRootLock | undefined;

class UnavailableProvider implements AiProvider {
  constructor(private readonly error: AiProviderError) {}
  getDiagnostics(): Promise<never> { return Promise.reject(this.error); }
  proposeCorrection(_request: CorrectionRequest): Promise<never> { return Promise.reject(this.error); }
  evaluateAssessment(_request: AssessmentEvaluationRequest): Promise<never> { return Promise.reject(this.error); }
}

const createProvider = (): AiProvider => {
  try { return new OllamaProvider(loadOllamaConfig(), new FetchHttpTransport()); }
  catch (error) {
    return new UnavailableProvider(error instanceof AiProviderError
      ? error
      : new AiProviderError('INVALID_CONFIGURATION', 'The local AI configuration is invalid.'));
  }
};

const createWindow = async (): Promise<void> => {
  const window = new BrowserWindow({
    width: 1_100, height: 760, minWidth: 760, minHeight: 600, show: false,
    webPreferences: { preload: path.join(currentDirectory, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  window.once('ready-to-show', () => window.show());
  const developmentUrl = process.env.VITE_DEV_SERVER_URL;
  if (developmentUrl) await window.loadURL(developmentUrl);
  else await window.loadFile(path.join(app.getAppPath(), 'dist-web', 'index.html'));
};

let startupPaths: DataPaths | undefined;
let startupError: unknown;
try {
  const dataLocation = resolveDataLocation({
    appPath: app.getAppPath(), executablePath: app.getPath('exe'), isPackaged: app.isPackaged,
    configuredDataRoot: process.env.APP_DATA_ROOT, portableExecutableDirectory: process.env.PORTABLE_EXECUTABLE_DIR,
  });
  startupPaths = initializeDataRoot(dataLocation.configuredRoot, dataLocation.projectRoot);
  const installation = path.resolve(app.isPackaged
    ? (process.env.PORTABLE_EXECUTABLE_DIR ?? path.dirname(app.getPath('exe')))
    : app.getAppPath());
  const installationId = createHash('sha256').update(installation.toLowerCase()).digest('hex').slice(0, 16);
  const electronState = path.join(installation, `.spanish-c1-electron-${installationId}`);
  mkdirSync(electronState, { recursive: true });
  app.setPath('userData', electronState);
} catch (error) { startupError = error; }

if (!app.requestSingleInstanceLock()) app.quit();
else app.whenReady().then(async () => {
  const dataPaths = startupPaths;
  try {
    if (startupError) throw startupError;
    if (!dataPaths) throw new Error('The portable data folder could not be resolved.');
    dataRootLock = await acquireDataRootLock(dataPaths.root);
    if (!dataRootLock) {
      registerBlockedModeIpc({ mode: 'blocked', message: 'Another Spanish C1 process owns this portable data folder. Close that process before trying again.', activeDataRoot: dataPaths.root });
      await createWindow();
      return;
    }
    reconcilePendingRecovery(dataPaths);
    repository = new SpanishC1Repository(dataPaths.database);
    repository.setSetting('activeDataRoot', dataPaths.root);
    const provider = createProvider();
    const applicationService = new ApplicationService(provider, repository, dataPaths.root);
    const portableDirectory = process.env.PORTABLE_EXECUTABLE_DIR ?? path.dirname(app.getPath('exe'));
    const audioModelRoot = path.resolve(process.env.AUDIO_MODEL_ROOT ?? (app.isPackaged
      ? path.join(portableDirectory, 'm6-benchmark', 'models')
      : path.join(app.getAppPath(), 'release', 'm6-benchmark', 'models')));
    const audioWorkerPath = app.isPackaged
      ? path.join(process.resourcesPath, 'audio-worker.cjs')
      : path.join(app.getAppPath(), 'scripts', 'audio-worker.cjs');
    const audioModuleRoot = app.isPackaged
      ? path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules')
      : path.join(app.getAppPath(), 'node_modules');
    const audioService = new AudioService(
      new NodeProcessAudioEngine(audioModelRoot, audioWorkerPath, audioModuleRoot),
      dataPaths,
    );
    const recovery = new RecoveryCoordinator(repository, dataPaths);
    registerIpcHandlers(provider, applicationService, audioService, recovery, () => { app.relaunch(); app.exit(0); });
    await createWindow();
    app.on('activate', async () => { if (BrowserWindow.getAllWindows().length === 0) await createWindow(); });
  } catch (error) {
    if (dataPaths && dataRootLock) {
      registerRecoveryModeIpc(
        new RecoveryModeService(dataPaths),
        { mode: 'recovery', message: error instanceof Error ? error.message : 'The database could not be opened.', activeDataRoot: dataPaths.root },
        () => { app.relaunch(); app.exit(0); },
      );
      await createWindow();
      return;
    }
    await dialog.showMessageBox({
      type: 'error', title: 'Spanish C1 could not open its data',
      message: error instanceof Error ? error.message : 'The portable data folder or database is unavailable.',
      detail: 'No learning data was changed. Use a verified backup or JSON export only after the data folder is available.',
    });
    app.quit();
  }
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.once('before-quit', () => {
  try { repository?.close(); } catch { /* Recovery may already have closed the repository. */ }
  dataRootLock?.server.close();
});
