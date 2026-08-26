import crypto from 'crypto';

export const PRONUNCIATIONS = [
  [/\bQEW\b/g, 'Q E W'],
  [/\bToss Bosses\b/g, 'Toss Bosses'],
  [/\bBurloak\b/g, 'Burr-loke'],
  [/\bAldershot\b/g, 'All-der-shot'],
  [/\bGuelph\b/g, 'Gwelf'],
  [/\bHalton\b/g, 'Halton'],
  [/\bBurlington\b/g, 'Burlington']
];

export const SAMPLE_NARRATION = 'Burlington News. This is a short sample of the article narration voice. The Q E W, Gwelf Line, All-der-shot, Burr-loke, Halton, and Toss Bosses should all sound natural.';

export const DEFAULT_SETTINGS = {
  provider: 'elevenlabs',
  model: 'eleven_multilingual_v2',
  voiceId: 'nPczCjzI2devNBz1zQrb',
  voiceName: 'Brian',
  stability: 0.52,
  similarityBoost: 0.75,
  style: 0,
  speed: 0.98,
  speakerBoost: true
};

export const PRIORITY_SLUGS = [
  'how-bad-is-burlington-crime',
  'burlington-ultimate-team-0-24',
  'skyway-bridge-story',
  'nostalgia-games-cafe-closure',
  'ribfest-2026',
  'burlington-data-centre-not-ai',
  'ontario-student-rights-school',
  '730-brant-vacant-building'
];

export function applyPronunciation(text) {
  return PRONUNCIATIONS.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), text);
}

export function normalizeNarration(text) {
  return String(text || '')
    .replace(/\u2013|\u2014/g, ' to ')
    .replace(/\u2019/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractNarration(html) {
  const article = html.match(/<article class="article-body">([\s\S]*?)<\/article>/i)?.[1] || html;
  const cleaned = article
    .replace(/<section class="sources"[\s\S]*?<\/section>/gi, ' ')
    .replace(/<figcaption[\s\S]*?<\/figcaption>/gi, ' ')
    .replace(/<(script|style|button)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<h([1-6])[^>]*>/gi, '\n\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, ' ') || '';
  const deck = html.match(/<p class="article-deck"[^>]*>([\s\S]*?)<\/p>/i)?.[1]?.replace(/<[^>]+>/g, ' ') || '';
  const body = normalizeNarration(cleaned);
  const lead = normalizeNarration([h1, deck].filter(Boolean).join('. '));
  return applyPronunciation(normalizeNarration([lead, body].filter(Boolean).join('\n\n')));
}

export function contentHash(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

export function slugFromPath(filePath) {
  const parts = String(filePath).replace(/\\/g, '/').split('/');
  const file = parts[parts.length - 1] || '';
  if (file === 'index.html' && parts.length >= 2) return parts[parts.length - 2];
  return file.replace(/\.html$/, '');
}

export function findAudioItem(manifest, slug) {
  return (manifest?.items || []).find(item => item.slug === slug) || null;
}
