const path = require('node:path');
(async () => {
  try {
    const { NodeProcessAudioEngine } = await import('../dist/apps/desktop/audio-service.js');
    const modelRoot = path.resolve(process.env.AUDIO_MODEL_ROOT ?? path.join('release', 'm6-benchmark', 'models'));
    const packaged = process.argv.includes('--packaged');
    const resources = path.resolve('release', 'win-unpacked', 'resources');
    const engine = new NodeProcessAudioEngine(
      modelRoot,
      packaged ? path.join(resources, 'audio-worker.cjs') : path.resolve('scripts', 'audio-worker.cjs'),
      packaged ? path.join(resources, 'app.asar.unpacked', 'node_modules') : path.resolve('node_modules'),
      process.execPath,
    );
    const status = engine.getAvailability();
    if (!status.available) throw new Error(status.message);

    const speech = await engine.synthesize('Si tuviera más tiempo, practicaría español todos los días.');
    const transcript = await engine.transcribe(speech);
    process.stdout.write(`${JSON.stringify({
      status: packaged ? 'packaged-ready' : 'ready',
      sampleRate: speech.sampleRate,
      sampleCount: speech.samples.length,
      transcriptLength: transcript.length,
    })}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : 'Audio runtime verification failed.'}\n`);
    process.exitCode = 1;
  }
})();
