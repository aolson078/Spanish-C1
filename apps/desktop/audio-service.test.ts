import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  AudioService,
  AudioServiceError,
  decodePcm16Wave,
  encodePcm16Wave,
  type AudioEngine,
} from './audio-service.js';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const createRoot = async () => {
  await mkdir('release', { recursive: true });
  const root = await mkdtemp(path.join(process.cwd(), 'release', 'smoke-data-m6-audio-'));
  roots.push(root);
  const recordings = path.join(root, 'recordings');
  await mkdir(recordings);
  return { recordings };
};

const waveform = {
  samples: Float32Array.from({ length: 16_000 }, (_, index) => Math.sin(index / 20) * 0.25),
  sampleRate: 16_000,
};

const engine = (transcript = 'La transcripción propuesta.') => ({
  getAvailability: () => ({ available: true, message: 'ready' }),
  transcribe: async () => transcript,
  synthesize: async () => waveform,
}) satisfies AudioEngine;

describe('PCM WAV boundary', () => {
  it('round-trips bounded mono PCM audio', () => {
    const decoded = decodePcm16Wave(encodePcm16Wave(waveform));
    expect(decoded.sampleRate).toBe(16_000);
    expect(decoded.samples).toHaveLength(16_000);
    expect(decoded.samples[100]).toBeCloseTo(waveform.samples[100]!, 3);
  });

  it.each([
    new Uint8Array(20),
    Uint8Array.from({ length: 44 }, () => 0),
  ])('rejects malformed audio before inference', (bytes) => {
    expect(() => decodePcm16Wave(bytes)).toThrow(AudioServiceError);
  });
});

describe('audio transcript confirmation', () => {
  it('does not expose a transcript as committable evidence until the matching session confirms it', async () => {
    const paths = await createRoot();
    const service = new AudioService(engine(), paths, { createId: (() => {
      let index = 0;
      return () => `id-${++index}`;
    })() });

    const draft = await service.transcribe('session-1', encodePcm16Wave(waveform), 'discard');
    expect(draft.requiresConfirmation).toBe(true);
    expect(draft.retained).toBe(false);
    expect(() => service.claimTranscript(draft.token, 'session-2', draft.transcript)).toThrow(/another session/i);

    const confirmed = service.claimTranscript(draft.token, 'session-1', 'La transcripción corregida.');
    expect(confirmed.transcript).toBe('La transcripción corregida.');
    expect(confirmed.edited).toBe(true);
    expect(() => service.claimTranscript(draft.token, 'session-1', confirmed.transcript)).toThrow(/expired/i);
  });

  it('expires an unused transcript after ten minutes', async () => {
    const paths = await createRoot();
    let now = new Date('2026-08-25T12:00:00.000Z');
    const service = new AudioService(engine(), paths, { now: () => now, createId: () => 'token' });
    const draft = await service.transcribe('session-1', encodePcm16Wave(waveform), 'discard');
    now = new Date('2026-08-25T12:10:00.001Z');
    expect(() => service.claimTranscript(draft.token, 'session-1', draft.transcript)).toThrow(/expired/i);
  });

  it('restores a claimed transcript only when downstream submission fails before expiry', async () => {
    const paths = await createRoot();
    const service = new AudioService(engine(), paths, { createId: () => 'token' });
    const draft = await service.transcribe('session-1', encodePcm16Wave(waveform), 'discard');
    const claim = service.claimTranscript(draft.token, 'session-1', draft.transcript);
    service.restoreTranscript(claim);
    expect(service.claimTranscript(draft.token, 'session-1', draft.transcript).transcript).toBe(draft.transcript);
  });

  it('retains audio only when the learner selected keep', async () => {
    const paths = await createRoot();
    let index = 0;
    const service = new AudioService(engine(), paths, { createId: () => `id-${++index}` });
    const bytes = encodePcm16Wave(waveform);
    const draft = await service.transcribe('session-1', bytes, 'keep');
    expect(draft.recordingId).toBe('recording-id-2.wav');
    expect(await readFile(path.join(paths.recordings, draft.recordingId!))).toEqual(Buffer.from(bytes));
  });

  it('returns bounded local WAV speech for renderer playback', async () => {
    const paths = await createRoot();
    const service = new AudioService(engine(), paths);
    const speech = await service.synthesize('Escucha esta oración.');
    expect(speech.mimeType).toBe('audio/wav');
    expect(decodePcm16Wave(speech.bytes).sampleRate).toBe(16_000);
  });
});
