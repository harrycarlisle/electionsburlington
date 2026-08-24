import { readFile, writeFile } from 'node:fs/promises';

const sources = ['news-v1.js', 'news-v2.js'];
const sections = [];

for (const source of sources) {
  sections.push(`/* ${source} */\n${(await readFile(source, 'utf8')).trimEnd()}`);
}

await writeFile('site-bundle.js', `${sections.join('\n\n')}\n`, 'utf8');
