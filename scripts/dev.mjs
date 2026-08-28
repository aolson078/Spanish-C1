import { spawn } from 'node:child_process';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run this script through npm so npm_execpath is available.');
const electronCommand = path.join(
  process.cwd(),
  'node_modules',
  'electron',
  'dist',
  process.platform === 'win32' ? 'electron.exe' : 'electron',
);
const children = new Set();

const start = (command, args, environment = process.env) => {
  const child = spawn(command, args, { stdio: 'inherit', env: environment });
  children.add(child);
  child.once('exit', () => children.delete(child));
  return child;
};

const stop = () => {
  for (const child of children) child.kill();
};

process.on('SIGINT', stop);
process.on('SIGTERM', stop);
process.on('exit', stop);

const build = start(process.execPath, [npmCli, 'run', 'build:desktop']);
const buildExit = await new Promise((resolve) => build.once('exit', resolve));
if (buildExit !== 0) process.exit(buildExit ?? 1);

const web = start(process.execPath, [npmCli, 'run', 'dev:web']);
let webReady = false;
for (let attempt = 0; attempt < 60; attempt += 1) {
  await delay(250);
  if (web.exitCode !== null) {
    stop();
    throw new Error(`Vite exited before it became ready (exit code ${web.exitCode}).`);
  }
  try {
    const response = await fetch('http://127.0.0.1:5173');
    if (response.ok) {
      webReady = true;
      break;
    }
  } catch {}
}
if (!webReady) {
  stop();
  throw new Error('Vite did not become ready at http://127.0.0.1:5173.');
}

const electron = start(electronCommand, ['.'], {
  ...process.env,
  VITE_DEV_SERVER_URL: 'http://127.0.0.1:5173',
});
const electronExit = await new Promise((resolve) => electron.once('exit', resolve));
stop();
process.exit(electronExit ?? 0);
