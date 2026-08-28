import { spawn } from 'node:child_process';
import path from 'node:path';

const child = spawn(
  process.execPath,
  [
    path.join(process.cwd(), 'node_modules', 'vitest', 'vitest.mjs'),
    'run',
    'packages/ai-provider/test/ollama-provider.live.spec.ts',
  ],
  {
    stdio: 'inherit',
    env: { ...process.env, RUN_LIVE_OLLAMA_TEST: '1' },
  },
);

child.once('exit', (code) => process.exit(code ?? 1));
