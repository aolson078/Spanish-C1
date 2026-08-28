import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  LinearResampler,
  OfflineRecognizer,
  OfflineTts,
  version: sherpaVersion,
  writeWave,
} = require('sherpa-onnx-node');

const repositoryRoot = process.cwd();
const benchmarkRoot = path.join(repositoryRoot, 'release', 'm6-benchmark');
const modelRoot = path.join(benchmarkRoot, 'models');
const runId = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const runRoot = path.join(benchmarkRoot, 'runs', runId);

const sentences = [
  'Ayer me di cuenta de que había dejado las llaves en la oficina.',
  'Aunque la propuesta parecía razonable, todavía faltaban varios detalles importantes.',
  '¿Me podrías explicar por qué cambió el horario sin avisarnos con anticipación?',
  'En México, la palabra ahorita puede expresar distintos grados de urgencia.',
  'Si hubiera sabido que la reunión terminaría tan tarde, habría organizado mejor mi día.',
];

const voices = [
  {
    id: 'claude-high-int8',
    directory: 'vits-piper-es_MX-claude-high-int8',
    model: 'es_MX-claude-high.onnx',
  },
  {
    id: 'ald-medium-int8',
    directory: 'vits-piper-es_MX-ald-medium-int8',
    model: 'es_MX-ald-medium.onnx',
  },
];

const recognizers = [
  { id: 'whisper-tiny-int8', directory: 'sherpa-onnx-whisper-tiny', prefix: 'tiny' },
  { id: 'whisper-base-int8', directory: 'sherpa-onnx-whisper-base', prefix: 'base' },
];

const elapsedSeconds = (startedAt) => Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;

const normalizeWords = (value) => value
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')
  .toLocaleLowerCase('es-MX')
  .replace(/[^\p{Letter}\p{Number}\s]/gu, ' ')
  .trim()
  .split(/\s+/u)
  .filter(Boolean);

const wordErrorRate = (expected, actual) => {
  const left = normalizeWords(expected);
  const right = normalizeWords(actual);
  const rows = Array.from({ length: left.length + 1 }, () => new Uint16Array(right.length + 1));

  for (let index = 0; index <= left.length; index += 1) rows[index][0] = index;
  for (let index = 0; index <= right.length; index += 1) rows[0][index] = index;

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitution = rows[leftIndex - 1][rightIndex - 1]
        + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1);
      rows[leftIndex][rightIndex] = Math.min(
        rows[leftIndex - 1][rightIndex] + 1,
        rows[leftIndex][rightIndex - 1] + 1,
        substitution,
      );
    }
  }

  return left.length === 0 ? 0 : rows[left.length][right.length] / left.length;
};

const createTts = async (voice) => {
  const directory = path.join(modelRoot, voice.directory);
  return OfflineTts.createAsync({
    model: {
      vits: {
        model: path.join(directory, voice.model),
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
};

const createRecognizer = async (candidate) => {
  const directory = path.join(modelRoot, candidate.directory);
  return OfflineRecognizer.createAsync({
    featConfig: { sampleRate: 16_000, featureDim: 80 },
    decodingMethod: 'greedy_search',
    modelConfig: {
      whisper: {
        encoder: path.join(directory, `${candidate.prefix}-encoder.int8.onnx`),
        decoder: path.join(directory, `${candidate.prefix}-decoder.int8.onnx`),
        language: 'es',
        task: 'transcribe',
        tailPaddings: 300,
      },
      tokens: path.join(directory, `${candidate.prefix}-tokens.txt`),
      numThreads: 4,
      provider: 'cpu',
      debug: 0,
    },
  });
};

await mkdir(runRoot, { recursive: true });

const samples = [];
const ttsResults = [];

for (const voice of voices) {
  const startedLoading = process.hrtime.bigint();
  const tts = await createTts(voice);
  const loadSeconds = elapsedSeconds(startedLoading);
  const voiceRoot = path.join(runRoot, voice.id);
  await mkdir(voiceRoot, { recursive: true });

  for (const [index, text] of sentences.entries()) {
    const startedGenerating = process.hrtime.bigint();
    const audio = await tts.generateAsync({ text, sid: 0, speed: 1 });
    const generationSeconds = elapsedSeconds(startedGenerating);
    const durationSeconds = audio.samples.length / audio.sampleRate;
    const file = path.join(voiceRoot, `${index + 1}.wav`);
    writeWave(file, { samples: audio.samples, sampleRate: audio.sampleRate });
    samples.push({ voice: voice.id, text, file, audio });
    ttsResults.push({
      voice: voice.id,
      sentence: index + 1,
      loadSeconds,
      generationSeconds,
      durationSeconds,
      realTimeFactor: generationSeconds / durationSeconds,
    });
  }
}

const asrResults = [];

for (const candidate of recognizers) {
  const startedLoading = process.hrtime.bigint();
  const recognizer = await createRecognizer(candidate);
  const loadSeconds = elapsedSeconds(startedLoading);

  for (const [index, sample] of samples.entries()) {
    const resampler = new LinearResampler(sample.audio.sampleRate, 16_000);
    const samplesAt16Khz = resampler.flush(sample.audio.samples);
    const stream = recognizer.createStream();
    stream.acceptWaveform({ samples: samplesAt16Khz, sampleRate: 16_000 });
    const startedDecoding = process.hrtime.bigint();
    const result = await recognizer.decodeAsync(stream);
    const decodeSeconds = elapsedSeconds(startedDecoding);
    const durationSeconds = samplesAt16Khz.length / 16_000;
    asrResults.push({
      recognizer: candidate.id,
      voice: sample.voice,
      sentence: (index % sentences.length) + 1,
      expected: sample.text,
      transcript: result.text.trim(),
      loadSeconds,
      decodeSeconds,
      durationSeconds,
      realTimeFactor: decodeSeconds / durationSeconds,
      wordErrorRate: wordErrorRate(sample.text, result.text),
    });
  }
}

const average = (values) => values.reduce((total, value) => total + value, 0) / values.length;
const summary = {
  sherpaVersion,
  createdAt: new Date().toISOString(),
  syntheticOnly: true,
  tts: Object.fromEntries(voices.map((voice) => {
    const rows = ttsResults.filter((result) => result.voice === voice.id);
    return [voice.id, {
      loadSeconds: rows[0].loadSeconds,
      averageRealTimeFactor: average(rows.map((row) => row.realTimeFactor)),
    }];
  })),
  asr: Object.fromEntries(recognizers.map((recognizer) => {
    const rows = asrResults.filter((result) => result.recognizer === recognizer.id);
    return [recognizer.id, {
      loadSeconds: rows[0].loadSeconds,
      averageRealTimeFactor: average(rows.map((row) => row.realTimeFactor)),
      averageWordErrorRate: average(rows.map((row) => row.wordErrorRate)),
    }];
  })),
};

const report = { summary, ttsResults, asrResults };
await writeFile(path.join(runRoot, 'benchmark-results.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ runRoot, summary }, null, 2));
