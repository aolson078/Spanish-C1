import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { AudioTranscriptDraft } from '../../desktop/audio-service';
import type { StoredSessionProgress } from '../../../packages/persistence/src/models';

const recordingLimitMs = 120_000;
const targetSampleRate = 16_000;

const encodeWave = (samples: Float32Array, sampleRate: number): ArrayBuffer => {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeAscii = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
  };
  writeAscii(0, 'RIFF');
  view.setUint32(4, buffer.byteLength - 8, true);
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
  return buffer;
};

const mediaBlobToWave = async (blob: Blob): Promise<ArrayBuffer> => {
  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    const frames = Math.max(1, Math.ceil(decoded.duration * targetSampleRate));
    const offline = new OfflineAudioContext(1, frames, targetSampleRate);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    const rendered = await offline.startRendering();
    return encodeWave(rendered.getChannelData(0), targetSampleRate);
  } finally {
    await context.close();
  }
};

const microphoneGuidance = (error: unknown): string => {
  if (error instanceof DOMException && ['NotAllowedError', 'SecurityError'].includes(error.name)) {
    return 'Microphone access is blocked. Open Windows Settings → Privacy & security → Microphone, allow desktop apps, then try again.';
  }
  if (error instanceof DOMException && error.name === 'NotFoundError') {
    return 'No microphone was found. Connect one, confirm it appears in Windows Sound settings, then try again.';
  }
  return error instanceof Error ? error.message : 'The microphone could not be used.';
};

export const PromptAudioButton = ({ text, disabled, onError }: {
  text: string;
  disabled: boolean;
  onError(message: string): void;
}) => {
  const [playing, setPlaying] = useState(false);

  const play = async () => {
    setPlaying(true);
    const result = await window.spanishC1.synthesizeSpeech(text);
    if (!result.ok) {
      onError(result.error.message);
      setPlaying(false);
      return;
    }
    const bytes = result.value.bytes.slice();
    const url = URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer], { type: result.value.mimeType }));
    const audio = new Audio(url);
    const release = () => { URL.revokeObjectURL(url); setPlaying(false); };
    audio.addEventListener('ended', release, { once: true });
    audio.addEventListener('error', release, { once: true });
    try { await audio.play(); }
    catch (error) { release(); onError(error instanceof Error ? error.message : 'The prompt could not be played.'); }
  };

  return <button className="button-quiet" disabled={disabled || playing} onClick={() => void play()} type="button">{playing ? 'Preparing audio…' : 'Listen to prompt'}</button>;
};

export const SessionAudioControls = ({ sessionId, disabled, onProgress, onError, onBusyChange }: {
  sessionId: string;
  disabled: boolean;
  onProgress(progress: StoredSessionProgress): Promise<void>;
  onError(message: string): void;
  onBusyChange(busy: boolean): void;
}) => {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState('');
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [draft, setDraft] = useState<AudioTranscriptDraft>();
  const [transcript, setTranscript] = useState('');
  const [recordingUrl, setRecordingUrl] = useState<string>();
  const recorder = useRef<MediaRecorder | undefined>(undefined);
  const stream = useRef<MediaStream | undefined>(undefined);
  const stopTimer = useRef<number | undefined>(undefined);

  const refreshDevices = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const microphones = (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === 'audioinput');
    setDevices(microphones);
    setDeviceId((current) => microphones.some((device) => device.deviceId === current) ? current : microphones[0]?.deviceId ?? '');
  };

  useEffect(() => {
    void refreshDevices();
    return () => {
      if (stopTimer.current !== undefined) window.clearTimeout(stopTimer.current);
      stream.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => () => {
    if (recordingUrl) URL.revokeObjectURL(recordingUrl);
  }, [recordingUrl]);

  const finishRecording = async (chunks: BlobPart[], mimeType: string) => {
    stopTimer.current = undefined;
    setRecording(false);
    setTranscribing(true);
    onBusyChange(true);
    try {
      const blob = new Blob(chunks, { type: mimeType });
      if (recordingUrl) URL.revokeObjectURL(recordingUrl);
      setRecordingUrl(URL.createObjectURL(blob));
      const wave = await mediaBlobToWave(blob);
      const result = await window.spanishC1.transcribeSessionAudio(sessionId, wave);
      if (!result.ok) throw new Error(result.error.message);
      setDraft(result.value);
      setTranscript(result.value.transcript);
    } catch (error) {
      onError(microphoneGuidance(error));
    } finally {
      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = undefined;
      recorder.current = undefined;
      setTranscribing(false);
      onBusyChange(false);
      await refreshDevices();
    }
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      onError('Microphone recording is unavailable in this Windows environment.');
      return;
    }
    try {
      const selectedStream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
      });
      stream.current = selectedStream;
      await refreshDevices();
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : '';
      const selectedRecorder = new MediaRecorder(selectedStream, mimeType ? { mimeType } : undefined);
      const chunks: BlobPart[] = [];
      selectedRecorder.addEventListener('dataavailable', (event) => { if (event.data.size > 0) chunks.push(event.data); });
      selectedRecorder.addEventListener('stop', () => void finishRecording(chunks, selectedRecorder.mimeType), { once: true });
      recorder.current = selectedRecorder;
      setDraft(undefined);
      setTranscript('');
      setRecording(true);
      selectedRecorder.start();
      stopTimer.current = window.setTimeout(() => selectedRecorder.stop(), recordingLimitMs);
    } catch (error) { onError(microphoneGuidance(error)); }
  };

  const stopRecording = () => {
    if (stopTimer.current !== undefined) window.clearTimeout(stopTimer.current);
    if (recorder.current?.state === 'recording') recorder.current.stop();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    onBusyChange(true);
    try {
      const result = await window.spanishC1.submitSessionTranscript(sessionId, draft.token, transcript);
      if (result.ok) {
        setDraft(undefined);
        setTranscript('');
        await onProgress(result.value);
      } else onError(result.error.message);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'The confirmed transcript could not be submitted.');
    } finally {
      onBusyChange(false);
    }
  };

  return (
    <section className="audio-response" aria-labelledby="audio-response-heading">
      <div>
        <p className="context-label">Spoken response</p>
        <h4 id="audio-response-heading">Record, inspect, then confirm</h4>
        <p>Your recording stays local. Nothing becomes learning evidence until you confirm the transcript.</p>
      </div>
      <label htmlFor="microphone-device">Microphone</label>
      <select disabled={disabled || recording || transcribing} id="microphone-device" onChange={(event) => setDeviceId(event.target.value)} value={deviceId}>
        {devices.length === 0 && <option value="">Default Windows microphone</option>}
        {devices.map((device, index) => <option key={device.deviceId || index} value={device.deviceId}>{device.label || `Microphone ${index + 1}`}</option>)}
      </select>
      <div className="audio-actions">
        {!recording ? (
          <button disabled={disabled || transcribing} onClick={() => void startRecording()} type="button">{transcribing ? 'Transcribing locally…' : draft ? 'Record again' : 'Start recording'}</button>
        ) : (
          <button className="recording-button" onClick={stopRecording} type="button">Stop recording</button>
        )}
        {recording && <span className="recording-status" role="status">Recording · stops automatically after two minutes</span>}
      </div>
      {recordingUrl && <audio aria-label="Your latest recording" controls src={recordingUrl} />}
      {draft && (
        <form className="transcript-review" onSubmit={submit}>
          <p className="trust-note">Transcript draft — not evidence yet</p>
          <label htmlFor="audio-transcript">Correct anything the speech model misheard</label>
          <textarea id="audio-transcript" maxLength={5_000} onChange={(event) => setTranscript(event.target.value)} rows={5} value={transcript} />
          <p>{draft.retained ? `Recording retained locally as ${draft.recordingId}.` : 'Recording will not be retained after this session.'}</p>
          <button disabled={disabled || transcript.trim().length === 0} type="submit">Confirm transcript and continue</button>
        </form>
      )}
    </section>
  );
};
