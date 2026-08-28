import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { SpanishC1Repository } from '../dist/packages/persistence/src/repository.js';

const databaseIsOpenable = (databasePath) => {
  if (!existsSync(databasePath)) return false;
  try { using repository = new SpanishC1Repository(databasePath); repository.exportSnapshot(); return true; }
  catch { return false; }
};

export const spawnPackaged = (executable, dataRoot, extraEnvironment = {}) => spawn(executable, [], {
    env: { ...process.env, APP_DATA_ROOT: dataRoot, ...extraEnvironment },
    stdio: 'ignore', windowsHide: true,
  });

export const waitForPackagedDatabase = async (child, dataRoot) => {
  const databasePath = `${dataRoot}\\spanish-c1.sqlite`;
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline && !databaseIsOpenable(databasePath)) {
    if (child.exitCode !== null) throw new Error(`The packaged process exited before opening its synthetic database (code ${child.exitCode}).`);
    await delay(250);
  }
  if (!databaseIsOpenable(databasePath)) {
    child.kill();
    throw new Error('The packaged process did not open its synthetic database within 30 seconds.');
  }
};

export const stopPackaged = async (child) => {
  await delay(750);
  if (!child.pid) throw new Error('The packaged validation process has no process identifier.');
  const exited = child.exitCode === null ? new Promise((resolve) => child.once('exit', resolve)) : Promise.resolve();
  const stopped = spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { encoding: 'utf8', windowsHide: true });
  if (stopped.status !== 0 && child.exitCode === null) throw new Error('The packaged validation process tree could not be stopped.');
  await Promise.race([
    exited,
    delay(10_000).then(() => { throw new Error('The packaged validation process did not exit after its bounded synthetic run.'); }),
  ]);
  await delay(1_500);
};

export const launchPackagedAndStop = async (executable, dataRoot, extraEnvironment = {}) => {
  const child = spawnPackaged(executable, dataRoot, extraEnvironment);
  await waitForPackagedDatabase(child, dataRoot);
  await stopPackaged(child);
};
