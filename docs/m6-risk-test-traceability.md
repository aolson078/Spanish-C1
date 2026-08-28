# M6 desktop-audio traceability

Verified on 2026-08-25. M6 adds private Windows microphone capture, offline Mexican-Spanish prompt playback, offline transcription, editable transcript confirmation, device guidance, and recording retention beneath the portable data root.

## Acceptance evidence

| Claim | Evidence | Status |
|---|---|---|
| Spoken activity uses no paid or hosted service | Media capture stays in the renderer; bounded PCM crosses typed IPC; the main process invokes a loopback-free Node worker using local Sherpa models | PASS |
| The selected models are usable on this computer | `test:m6:runtime` synthesized 80,304 samples at 22.05 kHz and transcribed the result to 57 characters | PASS |
| Speech-model uncertainty cannot directly become a Spanish weakness | Transcription returns a memory-only, session-bound, single-use draft token; only an editable confirmed transcript reaches `submitSessionText` | PASS |
| A transcript can be corrected before evidence is committed | Audio-service tests prove edited confirmation, wrong-session rejection, expiry, replay prevention, and retry restoration after downstream failure | PASS |
| Recording retention is explicit and local | Default is `discard`; `keep` writes collision-resistant WAV names only beneath `DataPaths.recordings`; focused tests inspect the retained bytes | PASS |
| Missing audio components do not block written practice | Readiness classifies audio as degraded, the Speak control is disabled, and the written response form remains enabled | PASS |
| Portable packaging contains a working worker and native runtime | `Spanish C1 0.3.0.exe` built; the worker copied under packaged resources synthesized 80,568 samples and produced a 57-character transcript through the packaged native addon | PASS |
| Real microphone capture and speaker playback work in the packaged UI | Requires a short user-driven Windows microphone and playback check | UNVERIFIED |

## Boundary and failure coverage

- WAV input is limited to 20 MiB, mono PCM16, 8–48 kHz, and 0.25–120 seconds.
- Renderer recording stops automatically after two minutes and converts locally to 16 kHz mono PCM.
- Worker requests and responses are capped at 64 MiB and accept only `transcribe` or `synthesize`.
- Transcript tokens expire after ten minutes and are claimed atomically before asynchronous submission.
- A failed downstream submission restores a still-valid claim; a successful submission cannot replay it.
- The worker receives no Ollama endpoint, learner database path, or network capability from the application protocol.
- Retained recordings are intentionally outside SQLite/JSON backup and export; this is visible in Settings documentation.

## Component selection

The approved benchmark compared Whisper Tiny/Base and two Mexican-Spanish Piper voices. Whisper Base int8 was selected for materially better synthetic word-error performance; Claude high int8 was selected as the Mexican-Spanish voice. Aggregate results remain under `release\m6-benchmark\runs` and contain no learner recording.

The Sherpa Node addon is isolated from Electron because its upstream tracker documents an open packaged-Electron compatibility issue. Electron continues to own file access, retention, validation, IPC, and persistence; the local Node worker performs inference only.

## Commands executed

```powershell
npm.cmd run typecheck
npm.cmd test -- --run apps/desktop/audio-service.test.ts apps/desktop/readiness.test.ts apps/web/src/App.test.tsx packages/domain/src/assessment.test.ts
npm.cmd run test:m6:runtime
npm.cmd run dist:win
npm.cmd run test:m6:packaged-runtime
```

Focused result: 30 tests passed. Typechecking, source-worker runtime, packaged-resource runtime, and the portable build passed. The full database-backed suite was not run without fresh permission for synthetic SQLite queries.
