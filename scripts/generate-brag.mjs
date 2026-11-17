#!/usr/bin/env node

/**
 * BRAG Automation Script for CipherLedger AI
 * Converts website/app into a 20-second professional 1080x1920 launch video.
 */

import { execSync, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const outputDir = path.join(rootDir, 'brag-output');
const compositionDir = path.join(outputDir, 'composition');
const logFile = path.join(outputDir, 'render.log');

function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}`;
  console.log(line);
  try {
    fs.appendFileSync(logFile, line + '\n');
  } catch {}
}

function run(cmd, opts = {}) {
  log(`Executing: ${cmd}`);
  const result = execSync(cmd, {
    cwd: opts.cwd || rootDir,
    encoding: 'utf8',
    stdio: 'pipe',
    ...opts,
  });
  return result;
}

async function main() {
  console.log('\n========================================================');
  console.log('   BRAG — Website-to-Launch-Video Automation Pipeline   ');
  console.log('========================================================\n');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(logFile, `BRAG Render Log — ${new Date().toISOString()}\n\n`);

  // 1. Dependency checks
  log('Phase 1: Validating rendering dependencies...');
  try {
    const nodeVer = process.version;
    const major = parseInt(nodeVer.slice(1).split('.')[0], 10);
    if (major < 22) {
      throw new Error(`Node.js version must be >= 22 (current: ${nodeVer})`);
    }
    log(`✓ Node.js version: ${nodeVer}`);

    const ffmpegVer = run('ffmpeg -version').split('\n')[0];
    log(`✓ FFmpeg detected: ${ffmpegVer}`);

    const hfVer = run('npx hyperframes --version').trim();
    log(`✓ Hyperframes CLI detected: v${hfVer}`);
  } catch (err) {
    console.error(`\n❌ Environment pre-flight failed: ${err.message}`);
    process.exit(1);
  }

  // 2. Pre-render contract audit
  log('\nPhase 2: Checking composition contract (npx hyperframes check)...');
  try {
    const checkOutput = run('npx hyperframes check', { cwd: compositionDir });
    log(checkOutput);
    log('✓ Hyperframes contract check passed (0 errors)');
  } catch (err) {
    log(`Hyperframes check stdout/stderr: ${err.stdout || ''}\n${err.stderr || ''}`);
    if (err.status !== 0 && !err.stdout?.includes('Check passed')) {
      console.error('\n❌ Composition check failed. See render.log for details.');
      process.exit(1);
    }
    log('✓ Composition check completed with acceptable warnings.');
  }

  // 3. Render video
  log('\nPhase 3: Rendering video (1080x1920 @ 30 FPS)...');
  const startTime = Date.now();
  const targetMp4 = path.join(outputDir, 'brag.mp4');
  try {
    const renderOutput = run('npx hyperframes render --output ../brag.mp4', { cwd: compositionDir });
    log(renderOutput);
    const renderTime = ((Date.now() - startTime) / 1000).toFixed(1);
    log(`✓ Frame rendering and audio assembly complete in ${renderTime}s`);
  } catch (err) {
    log(`Render failed: ${err.stdout || ''}\n${err.stderr || ''}`);
    console.error(`\n❌ Render failed: ${err.message}`);
    process.exit(1);
  }

  // 4. Extract poster and bake frame 0
  log('\nPhase 4: Extracting poster frame and baking frame 0...');
  const posterJpg = path.join(outputDir, 'brag.jpg');
  const tempPosterMp4 = path.join(outputDir, 'brag.poster.mp4');
  try {
    run(`ffmpeg -y -ss 1.0 -i "${targetMp4}" -frames:v 1 -q:v 2 "${posterJpg}"`);
    log(`✓ Extracted poster frame to ${posterJpg}`);

    run(`ffmpeg -y -i "${targetMp4}" -i "${posterJpg}" -filter_complex "[0:v][1:v]overlay=0:0:enable='eq(n,0)'[v]" -map "[v]" -map "0:a?" -c:v libx264 -crf 18 -preset slow -pix_fmt yuv420p -c:a copy -movflags +faststart "${tempPosterMp4}"`);
    fs.renameSync(tempPosterMp4, targetMp4);
    log('✓ Baked poster as video frame 0 with +faststart flags');
  } catch (err) {
    log(`Poster baking warning: ${err.message}`);
  }

  // 5. Validation with FFprobe
  log('\nPhase 5: Verifying deliverable with FFprobe...');
  try {
    const probeRaw = run(`ffprobe -v error -show_entries format=duration,size,bit_rate:stream=width,height,r_frame_rate,codec_name,channels,sample_rate -of json "${targetMp4}"`);
    const probe = JSON.parse(probeRaw);
    const vStream = probe.streams.find(s => s.codec_name === 'h264');
    const aStream = probe.streams.find(s => s.codec_name === 'aac');
    const duration = parseFloat(probe.format.duration).toFixed(2);
    const sizeMb = (probe.format.size / (1024 * 1024)).toFixed(2);

    log(`✓ Resolution: ${vStream.width}x${vStream.height}`);
    log(`✓ Frame Rate: ${vStream.r_frame_rate} FPS`);
    log(`✓ Video Duration: ${duration}s`);
    log(`✓ Video Size: ${sizeMb} MB`);
    log(`✓ Audio Stream: ${aStream.codec_name.toUpperCase()} ${aStream.sample_rate}Hz (${aStream.channels} channels)`);

    console.log('\n========================================================');
    console.log('   🎉 BRAG Video Generation Completed Successfully!     ');
    console.log('========================================================');
    console.log(`Video Deliverable : ${targetMp4}`);
    console.log(`Poster Frame      : ${posterJpg}`);
    console.log(`Story Plan        : ${path.join(outputDir, 'plan.md')}`);
    console.log(`Share Copy        : ${path.join(outputDir, 'share-copy.md')}`);
    console.log(`Diagnostics Log   : ${logFile}`);
    console.log('========================================================\n');
  } catch (err) {
    console.error(`\n❌ FFprobe verification error: ${err.message}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
