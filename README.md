# Spanish C1

Private, local-first Windows application for progressing from B2 Spanish to practical C1, with primary emphasis on Mexican Spanish.

## Requirements

- Windows 10 or later
- Node.js 24.13.1 or later
- npm 11 or later
- Ollama-compatible API, initially `http://127.0.0.1:11434`
- Initial model, `qwen3.5:4b`
- Offline speech runtime and selected Spanish models (installed with the approved M6 audio setup)

## Setup

```powershell
npm.cmd install
Copy-Item .env.example .env
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

The application uses defaults from `.env.example` even when `.env` is absent. To override them, set the corresponding environment variables before starting the application.

## Run

```powershell
npm.cmd run dev
```

The Vite development listener and Ollama default are both restricted to Windows loopback.

## Build the portable Windows application

```powershell
npm.cmd run dist:win
```

The current portable executable is written to `release\Spanish C1 0.3.0.exe`. When launched, its default `data` folder is created beside the original portable executable, not inside Electron's temporary extraction directory. `APP_DATA_ROOT` may still override that location.

Keep `release\m6-benchmark\models` beside the executable as `m6-benchmark\models`. The application uses only `sherpa-onnx-whisper-base` and `vits-piper-es_MX-claude-high-int8`; the other benchmark candidates are not required for normal use. `AUDIO_MODEL_ROOT` may override the model folder for development or diagnostics.

The local development package is not code-signed, so Windows may identify its publisher as unknown.

On first launch, Settings shows storage, database, local Ollama, model, backup, and publisher readiness. AI problems are degraded—not blocking—so saved learning data and navigation remain available. **Finish setup** records acknowledgement without installing a model or changing Ollama.

### Use the private GPT-OSS host

When both computers are connected to the same Tailscale network, launch the packaged app with:

```powershell
.\Launch-Spanish-C1-HostAI.ps1
```

The launcher verifies `http://100.117.2.102:11434`, requires `gpt-oss-agent-64k:latest`, and starts `release\host-ai\Spanish C1 0.3.0.exe` with 8,192 tokens of context, a two-minute request timeout, and medium GPT-OSS reasoning. The reasoning trace is not parsed, displayed, or stored; only the final schema-validated JSON is accepted. Learner data remains in this repository's `data` folder, and desktop audio continues to use `release\m6-benchmark\models`.

To verify the host and model without opening the app or learner database:

```powershell
.\Launch-Spanish-C1-HostAI.ps1 -CheckOnly
```

Launching the executable normally without this script continues to use the loopback `qwen3.5:4b` default.

Rebuild the host-AI package without replacing the normal portable build or audio models:

```powershell
npm.cmd run dist:win:host-ai
```

## Desktop audio

- Session prompts can be played through the offline Mexican-Spanish voice.
- Production, targeted-practice, and transfer tasks support either written or spoken responses.
- Spoken responses are transcribed locally with Whisper Base. The transcript is always shown as a draft and can be corrected before it enters the learning record.
- Recording retention defaults to **discard**. If **keep** is selected in Settings, WAV recordings are saved only under the portable data root's `recordings` folder.
- Retained recordings are not included in the JSON learning-data export or SQLite backup. Copy the `recordings` folder separately if those files matter to you.
- If microphone access is denied, enable desktop-app microphone access in **Windows Settings → Privacy & security → Microphone**, then retry.
- Audio remains unavailable without the local models, but written sessions and saved learning data continue to work.

Verify the bounded local speech worker and both selected models without opening the learner database:

```powershell
npm.cmd run test:m6:runtime
npm.cmd run test:m6:packaged-runtime
```

## Import and recovery

- **Export JSON** creates a strict format-v2, schema-v5 full snapshot.
- **Choose JSON export** accepts validated format-v1 or format-v2 snapshots up to 256 MiB. Import is full replacement and preserves this installation's active data root.
- **Preview restore** accepts only managed schema-v5 SQLite backups.
- Import and restore require a ten-minute, single-use preview plus exact `IMPORT` or `RESTORE` confirmation.
- Before replacement, the app validates a staged database, creates and verifies an independent safety backup, closes SQLite, swaps beneath the active data root, and restarts.
- If the live database cannot open, the app exposes only validated JSON import and managed-backup restore. Existing unreadable database-family files are copied and hashed before replacement is enabled.
- Recovery artifacts under `data\.recovery` and safety files under `data\backups` are intentionally retained in 0.2.0.

## Verification

Deterministic tests never require Ollama:

```powershell
npm.cmd test
```

The opt-in live smoke test sends one Spanish correction request to the configured local model:

```powershell
npm.cmd run test:ollama:live
```

Model output is an untrusted proposal. Schema validation and curated identifiers must pass before application code can use it.

M7 deterministic and packaged checks use only new allowlisted roots under `release\smoke-data-*`:

```powershell
npm.cmd run test:m7:recovery
npm.cmd run test:m7:soak
npm.cmd run test:m7:transfer
npm.cmd run test:m7:packaged
npm.cmd run test:m7:upgrade
npm.cmd run test:m7:shared-root
```

The last three commands launch and stop only preserved/candidate executables against fresh synthetic roots. The shared-root check runs two portable installations concurrently and proves the blocked copy leaves the learner fingerprint unchanged. They never select or replace real learner data.
