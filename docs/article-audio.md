# Article audio

Burlington News generates article narration once, then serves a static audio file. The browser never calls a text-to-speech API and never falls back to `speechSynthesis`.

## Product rule

If `/data/article-audio.json` has no file for the current slug, the Listen control is hidden.

Do not imply that a reporter recorded the narration. The article player uses the label “AI-generated audio narration.”

## Generation

```bash
npm run audio:generate -- --priority
npm run audio:generate -- burlington-ultimate-team-0-24
npm run audio:generate -- --sample
```

The script:

1. reads `stories/<slug>/index.html`
2. extracts the H1, deck and body
3. strips sources, credits and UI copy
4. applies local pronunciation replacements
5. hashes the narration text
6. reuses the existing MP3 when the hash is unchanged
7. otherwise calls the configured TTS provider
8. writes `/assets/audio/<slug>.mp3` and updates the manifest

## Provider

Current provider: ElevenLabs, model `eleven_multilingual_v2`.

The generator is modular (`PROVIDERS` in `scripts/generate-article-audio.mjs`) so another licensed TTS service can replace ElevenLabs later.

Default evaluation voice: ElevenLabs **Brian** (`nPczCjzI2devNBz1zQrb`). Override with `ELEVENLABS_VOICE_ID`. Generate `--sample` and listen before locking the voice sitewide.

Conservative starting settings:

- stability: 0.52
- similarity: 0.75
- style: 0
- speed: 0.98
- speaker boost: on

## Secrets

Add these GitHub Actions secrets. None of them belong in HTML, JS, JSON committed as client config, or a public environment file.

| Secret | Required | Purpose |
|---|---|---|
| `ELEVENLABS_API_KEY` | yes, to generate audio | Provider authentication |
| `ELEVENLABS_VOICE_ID` | optional | Overrides the default Brian voice |
| `ELEVENLABS_MODEL` | optional | Overrides `eleven_multilingual_v2` |
| `ELEVENLABS_PRONUNCIATION_DICT_ID` | optional | ElevenLabs pronunciation dictionary |
| `ELEVENLABS_PRONUNCIATION_DICT_VERSION` | optional | Dictionary version |

If the API key is missing, article content can still ship. The workflow exits cleanly and Listen stays hidden.

## Pronunciation

Text replacements in `lib/article-audio.mjs` currently include:

- QEW → “Q E W”
- Guelph → “Gwelf”
- Burloak → “Burr-loke”
- Aldershot → “All-der-shot”
- Burlington, Halton, Toss Bosses left as written

Article-specific terms can be added to that list. If ElevenLabs hosts a pronunciation dictionary, pass its id through the optional secrets above.

## Storage

Initial storage is git-hosted static files at `/assets/audio/<slug>.mp3` (128 kbps speech MP3). That is acceptable for a modest library.

Do not keep growing git history with hundreds of regenerated binaries. When the audio set becomes large, move files to object/blob storage and keep only the manifest plus public URLs in the repo.

## Priority backfill

When the key and voice are approved, generate these first:

1. `how-bad-is-burlington-crime`
2. `burlington-ultimate-team-0-24`
3. `skyway-bridge-story`
4. `nostalgia-games-cafe-closure`
5. `ribfest-2026`
6. `burlington-data-centre-not-ai`
7. `ontario-student-rights-school`
8. `730-brant-vacant-building`

Backfill must not block a content deploy.
