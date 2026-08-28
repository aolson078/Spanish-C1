import { randomUUID } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { DataPaths } from '../../packages/persistence/src/data-root.js';

export const maximumAudioBytes = 20 * 1_024 * 1_024;
const maximumAudioSeconds = 120;
const transcriptLifetimeMs = 10 * 60 * 1_000;

export type AudioRetention = 'discard' | 'keep';

export interface AudioStatus {
  readonly available: boolean;
  readonly speechToTextModel: 'whisper-base-int8';
  readonly textToSpeechModel: 'claude-high-int8';
  readonly message: string;
  readonly retention: AudioRetention;
}

export interface AudioTranscriptDraft {
  readonly token: string;
  readonly transcript: string;
  readonly expiresAt: string;
  readonly retained: boolean;
  readonly recordingId?: string;
  readonly requiresConfirmation: true;
}

export interface SynthesizedSpeech {
  readonly mimeType: 'audio/wav';
  readonly bytes: Uint8Array;
}

interface Waveform {
  readonly samples: Float32Array;
  readonly sampleRate: number;
}

interface TranscriptToken {
  readonly sessionId: string;
  readonly transcript: string;
  readonly expiresAtMs: number;
}

export interface ClaimedTranscript {
  readonly token: string;
  readonly pending: TranscriptToken;
  readonly transcript: string;
  readonly edited: boolean;
}

export interface AudioEngine {
  getAvailability(): { available: boolean; message: string };
  transcribe(waveform: Waveform): Promise<string>;
  synthesize(text: string): Promise<Waveform>;
}

export class AudioServiceError extends Error {
  constructor(readonly code: 'AUDIO_UNAVAILABLE' | 'INVALID_AUDIO' | 'INVALID_TRANSCRIPT', message: string) {
    super(message);
    this.name = 'AudioServiceError';
  }
}

const readAscii = (bytes: Uint8Array, offset: number, length: number): string =>
  String.fromCharCode(...bytes.subarray(offset, offset + length));

export const decodePcm16Wave = (bytes: Uint8Array): Waveform => {
  if (bytes.byteLength < 44 || bytes.byteLength > maximumAudioBytes) {
    throw new AudioServiceError('INVALID_AUDIO', 'Record between one second and two minutes of audio.');
  }
  if (readAscii(bytes, 0, 4) !== 'RIFF' || readAscii(bytes, 8, 4) !== 'WAVE') {
    throw new AudioServiceError('INVALID_AUDIO', 'The recording is not a supported WAV file.');
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const declaredLength = view.getUint32(4, true) + 8;
  if (declaredLength > bytes.byteLength) {
    throw new AudioServiceError('INVALID_AUDIO', 'The recording is incomplete.');
  }

  let format: { channels: number; sampleRate: number; bitsPerSample: number } | undefined;
  let dataOffset = -1;
  let dataLength = 0;
  let offset = 12;
  while (offset + 8 <= declaredLength) {
    const chunkId = readAscii(bytes, offset, 4);
    const chunkLength = view.getUint32(offset + 4, true);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkLength;
    if (chunkEnd > declaredLength) throw new AudioServiceError('INVALID_AUDIO', 'The recording contains an invalid WAV chunk.');
    if (chunkId === 'fmt ') {
      if (chunkLength < 16 || view.getUint16(chunkStart, true) !== 1) {
        throw new AudioServiceError('INVALID_AUDIO', 'The recording must use uncompressed PCM audio.');
      }
      format = {
        channels: view.getUint16(chunkStart + 2, true),
        sampleRate: view.getUint32(chunkStart + 4, true),
        bitsPerSample: view.getUint16(chunkStart + 14, true),
      };
    } else if (chunkId === 'data') {
      dataOffset = chunkStart;
      dataLength = chunkLength;
    }
    offset = chunkEnd + (chunkLength % 2);
  }

  if (!format || dataOffset < 0 || format.channels !== 1 || format.bitsPerSample !== 16) {
    throw new AudioServiceError('INVALID_AUDIO', 'The recording must be mono, 16-bit PCM audio.');
  }
  if (format.sampleRate < 8_000 || format.sampleRate > 48_000 || dataLength === 0 || dataLength % 2 !== 0) {
    throw new AudioServiceError('INVALID_AUDIO', 'The recording has an unsupported sample rate or duration.');
  }
  const sampleCount = dataLength / 2;
  const durationSeconds = sampleCount / format.sampleRate;
  if (durationSeconds < 0.25 || durationSeconds > maximumAudioSeconds) {
    throw new AudioServiceError('INVALID_AUDIO', 'Record between one second and two minutes of audio.');
  }

  const samples = new Float32Array(sampleCount);
  for (let index = 0; index < sampleCount; index += 1) {
    samples[index] = view.getInt16(dataOffset + index * 2, true) / 32_768;
  }
  return { samples, sampleRate: format.sampleRate };
};

export const encodePcm16Wave = ({ samples, sampleRate }: Waveform): Uint8Array => {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const writeAscii = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) bytes[offset + index] = value.charCodeAt(index);
  };
  writeAscii(0, 'RIFF');
  view.setUint32(4, bytes.length - 8, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index] ?? 0));
    view.setInt16(44 + index * 2, sample < 0 ? sample * 32_768 : sample * 32_767, true);
  }
  return bytes;
};

interface WorkerResult {
  readonly ok: boolean;
  readonly message?: string;
  readonly transcript?: string;
  readonly sampleRate?: number;
  readonly samples?: string;
}

const maximumWorkerPayloadBytes = 64 * 1_024 * 1_024;

export class NodeProcessAudioEngine implements AudioEngine {
  constructor(
    private readonly modelRoot: string,
    private readonly workerPath: string,
    private readonly moduleRoot: string,
    private readonly nodeExecutable = process.env.SPANISH_C1_NODE_EXECUTABLE ?? 'node.exe',
  ) {}

  private get asrDirectory(): string { return path.join(this.modelRoot, 'sherpa-onnx-whisper-base'); }
  private get ttsDirectory(): string { return path.join(this.modelRoot, 'vits-piper-es_MX-claude-high-int8'); }

  private requiredFiles(): readonly string[] {
    return [
      path.join(this.asrDirectory, 'base-encoder.int8.onnx'),
      path.join(this.asrDirectory, 'base-decoder.int8.onnx'),
      path.join(this.asrDirectory, 'base-tokens.txt'),
      path.join(this.ttsDirectory, 'es_MX-claude-high.onnx'),
      path.join(this.ttsDirectory, 'tokens.txt'),
      path.join(this.ttsDirectory, 'espeak-ng-data'),
    ];
  }

  getAvailability(): { available: boolean; message: string } {
    if (!existsSync(this.workerPath) || !existsSync(path.join(this.moduleRoot, 'sherpa-onnx-node', 'package.json'))) {
      return { available: false, message: 'The local speech worker is unavailable.' };
    }
    if (!this.requiredFiles().every((file) => existsSync(file))) {
      return { available: false, message: 'The selected offline Spanish speech models are unavailable.' };
    }
    const runtime = spawnSync(this.nodeExecutable, ['--version'], { windowsHide: true, timeout: 5_000 });
    if (runtime.error || runtime.status !== 0) {
      return { available: false, message: 'Node.js is required for offline speech. Install Node.js or set SPANISH_C1_NODE_EXECUTABLE.' };
    }
    return { available: true, message: 'Offline Mexican-Spanish speech is ready.' };
  }

  private request(payload: object): Promise<WorkerResult> {
    const availability = this.getAvailability();
    if (!availability.available) throw new AudioServiceError('AUDIO_UNAVAILABLE', availability.message);
    return new Promise((resolve, reject) => {
      const child = spawn(this.nodeExecutable, [this.workerPath], {
        env: {
          ...process.env,
          AUDIO_MODEL_ROOT: this.modelRoot,
          SHERPA_MODULE_ROOT: this.moduleRoot,
        },
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      });
      const stdout: Buffer[] = [];
      let stdoutBytes = 0;
      let settled = false;
      const fail = (message: string) => {
        if (settled) return;
        settled = true;
        reject(new AudioServiceError('AUDIO_UNAVAILABLE', message));
      };
      child.once('error', () => fail('The local speech worker could not start.'));
      child.stdout.on('data', (chunk: Buffer) => {
        stdoutBytes += chunk.length;
        if (stdoutBytes > maximumWorkerPayloadBytes) {
          child.kill();
          fail('The local speech worker returned too much data.');
        } else stdout.push(chunk);
      });
      child.stderr.resume();
      child.once('close', (code) => {
        if (settled) return;
        try {
          const result = JSON.parse(Buffer.concat(stdout).toString('utf8')) as WorkerResult;
          if (code !== 0 || !result.ok) throw new Error(result.message || 'The local speech worker failed.');
          settled = true;
          resolve(result);
        } catch (error) {
          fail(error instanceof SyntaxError ? 'The local speech worker returned an invalid result.' : error instanceof Error ? error.message : 'The local speech worker failed.');
        }
      });
      const input = JSON.stringify(payload);
      if (Buffer.byteLength(input) > maximumWorkerPayloadBytes) {
        child.kill();
        fail('The recording is too large for local speech processing.');
        return;
      }
      child.stdin.end(input);
    });
  }

  async transcribe(waveform: Waveform): Promise<string> {
    const samples = Buffer.from(waveform.samples.buffer, waveform.samples.byteOffset, waveform.samples.byteLength).toString('base64');
    const result = await this.request({ operation: 'transcribe', sampleRate: waveform.sampleRate, samples });
    const transcript = result.transcript?.trim() ?? '';
    if (!transcript) throw new AudioServiceError('INVALID_AUDIO', 'No Spanish speech was detected. Try recording again.');
    return transcript;
  }

  async synthesize(text: string): Promise<Waveform> {
    const result = await this.request({ operation: 'synthesize', text });
    if (!result.samples || !Number.isInteger(result.sampleRate) || result.sampleRate! < 8_000 || result.sampleRate! > 48_000) {
      throw new AudioServiceError('AUDIO_UNAVAILABLE', 'The local speech worker returned invalid audio.');
    }
    const bytes = Buffer.from(result.samples, 'base64');
    if (bytes.length === 0 || bytes.length % Float32Array.BYTES_PER_ELEMENT !== 0 || bytes.length > maximumWorkerPayloadBytes) {
      throw new AudioServiceError('AUDIO_UNAVAILABLE', 'The local speech worker returned invalid audio.');
    }
    const samples = new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    return { samples, sampleRate: result.sampleRate! };
  }
}

export interface AudioServiceOptions {
  readonly now?: () => Date;
  readonly createId?: () => string;
}

export class AudioService {
  private readonly transcripts = new Map<string, TranscriptToken>();
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(
    private readonly engine: AudioEngine,
    private readonly paths: Pick<DataPaths, 'recordings'>,
    options: AudioServiceOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? randomUUID;
  }

  getStatus(retention: AudioRetention): AudioStatus {
    const availability = this.engine.getAvailability();
    return {
      ...availability,
      speechToTextModel: 'whisper-base-int8',
      textToSpeechModel: 'claude-high-int8',
      retention,
    };
  }

  async transcribe(sessionId: string, bytes: Uint8Array, retention: AudioRetention): Promise<AudioTranscriptDraft> {
    this.pruneExpired();
    const waveform = decodePcm16Wave(bytes);
    const transcript = await this.engine.transcribe(waveform);
    const token = this.createId();
    const expiresAtMs = this.now().getTime() + transcriptLifetimeMs;
    let recordingId: string | undefined;
    if (retention === 'keep') {
      recordingId = `recording-${this.createId()}.wav`;
      await writeFile(path.join(this.paths.recordings, recordingId), bytes, { flag: 'wx' });
    }
    this.transcripts.set(token, { sessionId, transcript, expiresAtMs });
    return {
      token,
      transcript,
      expiresAt: new Date(expiresAtMs).toISOString(),
      retained: retention === 'keep',
      recordingId,
      requiresConfirmation: true,
    };
  }

  claimTranscript(token: string, sessionId: string, transcript: string): ClaimedTranscript {
    this.pruneExpired();
    const pending = this.transcripts.get(token);
    if (!pending || pending.sessionId !== sessionId) {
      throw new AudioServiceError('INVALID_TRANSCRIPT', 'The transcript draft expired or belongs to another session. Record it again.');
    }
    const normalized = transcript.trim();
    if (!normalized || normalized.length > 5_000) {
      throw new AudioServiceError('INVALID_TRANSCRIPT', 'Confirm a transcript between 1 and 5,000 characters.');
    }
    this.transcripts.delete(token);
    return { token, pending, transcript: normalized, edited: normalized !== pending.transcript };
  }

  restoreTranscript(claim: ClaimedTranscript): void {
    if (claim.pending.expiresAtMs > this.now().getTime() && !this.transcripts.has(claim.token)) {
      this.transcripts.set(claim.token, claim.pending);
    }
  }

  async synthesize(text: string): Promise<SynthesizedSpeech> {
    const normalized = text.trim();
    if (!normalized || normalized.length > 2_000) {
      throw new AudioServiceError('INVALID_TRANSCRIPT', 'Speech playback requires between 1 and 2,000 characters.');
    }
    const waveform = await this.engine.synthesize(normalized);
    const bytes = encodePcm16Wave(waveform);
    if (bytes.byteLength > maximumAudioBytes) {
      throw new AudioServiceError('INVALID_AUDIO', 'The generated speech is too long to play safely.');
    }
    return { mimeType: 'audio/wav', bytes };
  }

  private pruneExpired(): void {
    const timestamp = this.now().getTime();
    for (const [token, draft] of this.transcripts) {
      if (draft.expiresAtMs <= timestamp) this.transcripts.delete(token);
    }
  }
}
