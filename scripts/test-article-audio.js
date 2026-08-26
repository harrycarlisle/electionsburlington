import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  applyPronunciation,
  contentHash,
  extractNarration,
  findAudioItem,
  slugFromPath
} from '../lib/article-audio.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

let failed = 0;
function assert(cond, message) {
  if (!cond) {
    failed += 1;
    console.error('FAIL', message);
  }
}

const html = `<header class="article-head"><h1>This Burlington team is 0–24.</h1><p class="article-deck">After an 0–12 season, they changed the name.</p></header><article class="article-body"><p>They play near the QEW and Guelph Line.</p><h2>So why do they keep coming back?</h2><p>Toss Bosses still show up.</p><figure><figcaption>Photo credit should vanish</figcaption></figure><section class="sources"><h2>Sources</h2><ul><li>https://example.com</li></ul></section></article>`;
const narration = extractNarration(html);
assert(narration.includes('This Burlington team is 0 to 24'), `keeps headline: ${narration.slice(0, 80)}`);
assert(narration.includes('Q E W'), 'pronounces QEW as letters');
assert(narration.includes('Gwelf'), 'pronounces Guelph');
assert(!/example.com/.test(narration), 'strips source URLs');
assert(!/Photo credit/.test(narration), 'strips image credits');
assert(narration.includes('So why do they keep coming back'), 'keeps section headings');
assert(contentHash(narration) === contentHash(narration), 'hash is stable');
assert(contentHash(narration) !== contentHash(narration + 'x'), 'hash changes with text');
assert(slugFromPath('stories/burlington-ultimate-team-0-24/index.html') === 'burlington-ultimate-team-0-24', 'story slug');
assert(findAudioItem({ items: [{ slug: 'a' }] }, 'a')?.slug === 'a', 'finds manifest item');
assert(applyPronunciation('QEW at Burloak') === 'Q E W at Burr-loke', 'pronunciation map');

const article = fs.readFileSync(path.join(root, 'stories/burlington-ultimate-team-0-24/index.html'), 'utf8');
const live = extractNarration(article);
assert(live.includes('This Burlington team is 0 to 24'), 'live article keeps headline for narration');
assert(/Toss Bosses/.test(live), 'keeps Toss Bosses');
assert(/Panic at the Disco/.test(live), 'keeps prior team name');
assert(!/User-verified/.test(live), 'drops old defensive wording');
assert(!/Public standings do not say/.test(live), 'drops outdated standings caveat');
assert(!/Burlington News did not find public player comments/.test(live), 'drops old no-comment caveat');
assert(!/https?:\/\//.test(live), 'strips source URLs from live article');

const player = fs.readFileSync(path.join(root, 'article-modern.js'), 'utf8');
assert(!/SpeechSynthesisUtterance/.test(player), 'does not use SpeechSynthesisUtterance');
assert(!/speechSynthesis/.test(player), 'does not use speechSynthesis');
assert(/listen_start/.test(player) && /listen_pause/.test(player), 'tracks listen start/pause');
assert(/listen_complete/.test(player) && /listen_speed_change/.test(player), 'tracks complete/speed');
assert(/article-audio\.json/.test(player), 'loads generated audio manifest');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'data/article-audio.json'), 'utf8'));
assert(Array.isArray(manifest.items) && manifest.items.length === 0, 'no audio files until the API key is configured');

if (failed) {
  console.error(`${failed} article-audio checks failed`);
  process.exit(1);
}
console.log('article-audio extract/hash/pronunciation checks passed');
