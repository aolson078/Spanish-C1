const path = require('node:path');

const maximumPayloadBytes = 64 * 1_024 * 1_024;
const modelRoot = process.env.AUDIO_MODEL_ROOT;
const moduleRoot = process.env.SHERPA_MODULE_ROOT;

const respond = (value, exitCode = 0) => {
  process.stdout.write(JSON.stringify(value));
  process.exitCode = exitCode;
};

const readRequest = () => new Promise((resolve, reject) => {
  const chunks = [];
  let bytes = 0;
  process.stdin.on('data', (chunk) => {
    bytes += chunk.length;
    if (bytes > maximumPayloadBytes) reject(new Error('Speech request exceeded the local limit.'));
    else chunks.push(chunk);
  });
  process.stdin.once('end', () => {
    try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
    catch { reject(new Error('Speech request was invalid.')); }
  });
  process.stdin.once('error', reject);
});

const loadSherpa = () => {
  if (!modelRoot || !moduleRoot) throw new Error('Speech worker paths are unavailable.');
  return require(path.join(moduleRoot, 'sherpa-onnx-node'));
};

const transcribe = async (sherpa, request) => {
  if (!Number.isInteger(request.sampleRate) || request.sampleRate < 8_000 || request.sampleRate > 48_000 || typeof request.samples !== 'string') {
    throw new Error('Speech samples were invalid.');
  }
  const bytes = Buffer.from(request.samples, 'base64');
  if (bytes.length === 0 || bytes.length % Float32Array.BYTES_PER_ELEMENT !== 0 || bytes.length > maximumPayloadBytes) {
    throw new Error('Speech samples were invalid.');
  }
  const source = new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const samples = request.sampleRate === 16_000
    ? source
    : new sherpa.LinearResampler(request.sampleRate, 16_000).flush(source);
  const directory = path.join(modelRoot, 'sherpa-onnx-whisper-base');
  const recognizer = await sherpa.OfflineRecognizer.createAsync({
    featConfig: { sampleRate: 16_000, featureDim: 80 },
    decodingMethod: 'greedy_search',
    modelConfig: {
      whisper: {
        encoder: path.join(directory, 'base-encoder.int8.onnx'),
        decoder: path.join(directory, 'base-decoder.int8.onnx'),
        language: 'es',
        task: 'transcribe',
        tailPaddings: 300,
      },
      tokens: path.join(directory, 'base-tokens.txt'),
      numThreads: 4,
      provider: 'cpu',
      debug: 0,
    },
  });
  const stream = recognizer.createStream();
  stream.acceptWaveform({ samples, sampleRate: 16_000 });
  const result = await recognizer.decodeAsync(stream);
  return { ok: true, transcript: result.text.trim() };
};

const synthesize = async (sherpa, request) => {
  if (typeof request.text !== 'string' || request.text.trim().length === 0 || request.text.length > 2_000) {
    throw new Error('Speech text was invalid.');
  }
  const directory = path.join(modelRoot, 'vits-piper-es_MX-claude-high-int8');
  const tts = await sherpa.OfflineTts.createAsync({
    model: {
      vits: {
        model: path.join(directory, 'es_MX-claude-high.onnx'),
        tokens: path.join(directory, 'tokens.txt'),
        dataDir: path.join(directory, 'espeak-ng-data'),
        noiseScale: 0.667,
        noiseScaleW: 0.8,
        lengthScale: 1,
      },
    },
    maxNumSentences: 1,
    numThreads: 4,
  });
  const audio = await tts.generateAsync({ text: request.text.trim(), sid: 0, speed: 1 });
  const samples = Buffer.from(audio.samples.buffer, audio.samples.byteOffset, audio.samples.byteLength).toString('base64');
  return { ok: true, sampleRate: audio.sampleRate, samples };
};

(async () => {
  try {
    const request = await readRequest();
    const sherpa = loadSherpa();
    if (request.operation === 'transcribe') respond(await transcribe(sherpa, request));
    else if (request.operation === 'synthesize') respond(await synthesize(sherpa, request));
    else throw new Error('Speech operation was invalid.');
  } catch (error) {
    const message = error instanceof Error && /invalid|exceeded/i.test(error.message)
      ? error.message
      : 'Local speech inference failed. Check the offline speech models and try again.';
    respond({ ok: false, message }, 1);
  }
})();
