#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  DEFAULT_SETTINGS,
  PRIORITY_SLUGS,
  SAMPLE_NARRATION,
  contentHash,
  extractNarration,
  findAudioItem
} from '../lib/article-audio.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT, 'data', 'article-audio.json');
const AUDIO_DIR = path.join(ROOT, 'assets', 'audio');

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

function articlePath(slug) {
  const story = path.join(ROOT, 'stories', slug, 'index.html');
  if (fs.existsSync(story)) return story;
  const html = path.join(ROOT, 'articles', `${slug}.html`);
  if (fs.existsSync(html)) return html;
  return null;
}

function listSlugs(requested) {
  if (requested.length) return requested;
  if (process.argv.includes('--priority')) return PRIORITY_SLUGS;
  return fs.readdirSync(path.join(ROOT, 'stories'))
    .filter(name => fs.existsSync(path.join(ROOT, 'stories', name, 'index.html')));
}

function providerSettings() {
  const settings = {
    ...DEFAULT_SETTINGS,
    voiceId: process.env.ELEVENLABS_VOICE_ID || DEFAULT_SETTINGS.voiceId,
    model: process.env.ELEVENLABS_MODEL || DEFAULT_SETTINGS.model
  };
  if (process.env.ELEVENLABS_PRONUNCIATION_DICT_ID) {
    settings.pronunciationDictionaryId = process.env.ELEVENLABS_PRONUNCIATION_DICT_ID;
    settings.pronunciationDictionaryVersion = process.env.ELEVENLABS_PRONUNCIATION_DICT_VERSION || '';
  }
  return settings;
}

async function synthesizeElevenLabs(text, settings, apiKey) {
  const url = new URL(`https://api.elevenlabs.io/v1/text-to-speech/${settings.voiceId}`);
  url.searchParams.set('output_format', 'mp3_44100_128');
  const body = {
    text,
    model_id: settings.model,
    voice_settings: {
      stability: settings.stability,
      similarity_boost: settings.similarityBoost,
      style: settings.style,
      use_speaker_boost: settings.speakerBoost,
      speed: settings.speed
    }
  };
  if (settings.pronunciationDictionaryId) {
    body.pronunciation_dictionary_locators = [{
      pronunciation_dictionary_id: settings.pronunciationDictionaryId,
      version_id: settings.pronunciationDictionaryVersion || undefined
    }];
  }
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg'
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`ElevenLabs ${response.status}: ${detail.slice(0, 240)}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

const PROVIDERS = {
  elevenlabs: synthesizeElevenLabs
};

async function synthesize(text, settings, apiKey) {
  const synthesizeFn = PROVIDERS[settings.provider];
  if (!synthesizeFn) throw new Error(`Unknown TTS provider: ${settings.provider}`);
  return synthesizeFn(text, settings, apiKey);
}

async function durationSeconds(file) {
  try {
    const { spawnSync } = await import('child_process');
    const result = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' });
    const value = Number(result.stdout.trim());
    return Number.isFinite(value) ? Math.round(value) : null;
  } catch (_) {
    return null;
  }
}

async function generateOne(slug, manifest, force) {
  const file = articlePath(slug);
  if (!file) {
    console.warn(`skip ${slug}: article not found`);
    return manifest;
  }
  const html = fs.readFileSync(file, 'utf8');
  if (/This story has moved/i.test(html) || /http-equiv="refresh"/i.test(html)) {
    console.warn(`skip ${slug}: redirect stub`);
    return manifest;
  }
  const narration = extractNarration(html);
  if (!narration) {
    console.warn(`skip ${slug}: no narration text`);
    return manifest;
  }
  const hash = contentHash(narration);
  const existing = findAudioItem(manifest, slug);
  if (!force && existing?.contentHash === hash && existing.audioUrl && fs.existsSync(path.join(ROOT, existing.audioUrl.replace(/^\//, '')))) {
    console.log(`reuse ${slug}`);
    return manifest;
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.warn(`skip ${slug}: ELEVENLABS_API_KEY is not set`);
    return manifest;
  }

  const settings = providerSettings();
  const audio = await synthesize(narration, settings, apiKey);
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
  const rel = `assets/audio/${slug}.mp3`;
  const dest = path.join(ROOT, rel);
  fs.writeFileSync(dest, audio);
  const duration = await durationSeconds(dest);
  const item = {
    slug,
    contentHash: hash,
    audioUrl: `/${rel}`,
    duration,
    generatedAt: new Date().toISOString(),
    provider: settings.provider,
    model: settings.model,
    voiceId: settings.voiceId
  };
  manifest.items = (manifest.items || []).filter(row => row.slug !== slug);
  manifest.items.push(item);
  manifest.settings = settings;
  console.log(`generated ${slug} (${audio.length} bytes)`);
  return manifest;
}

async function generateSample() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.log('ELEVENLABS_API_KEY is not configured. Sample audio was not generated.');
    return;
  }
  const settings = providerSettings();
  const audio = await synthesize(SAMPLE_NARRATION, settings, apiKey);
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
  const dest = path.join(AUDIO_DIR, '_voice-sample.mp3');
  fs.writeFileSync(dest, audio);
  console.log(`wrote ${dest} (${audio.length} bytes)`);
}

async function main() {
  const args = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
  const force = process.argv.includes('--force');
  if (process.argv.includes('--sample')) {
    await generateSample();
    return;
  }
  const slugs = listSlugs(args);
  let manifest = readJson(MANIFEST_PATH, {
    provider: DEFAULT_SETTINGS.provider,
    model: DEFAULT_SETTINGS.model,
    voiceId: process.env.ELEVENLABS_VOICE_ID || DEFAULT_SETTINGS.voiceId,
    settings: DEFAULT_SETTINGS,
    items: []
  });
  if (!process.env.ELEVENLABS_API_KEY) {
    console.log('ELEVENLABS_API_KEY is not configured. Architecture is in place; no audio was generated.');
    if (!fs.existsSync(MANIFEST_PATH)) writeJson(MANIFEST_PATH, manifest);
    return;
  }
  for (const slug of slugs) {
    manifest = await generateOne(slug, manifest, force);
  }
  writeJson(MANIFEST_PATH, manifest);
}

main().catch(error => {
  console.error(error.message || error);
  process.exit(1);
});
