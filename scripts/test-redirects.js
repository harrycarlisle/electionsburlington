import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
let failed = 0;
function fail(message) {
  console.error('FAIL', message);
  failed += 1;
}

const redirects = JSON.parse(readFileSync(join(root, 'redirects.json'), 'utf8'));
const sitemap = readFileSync(join(root, 'sitemap.xml'), 'utf8');
const newsSitemap = readFileSync(join(root, 'news-sitemap.xml'), 'utf8');

function destFile(url) {
  const clean = url.replace(/https:\/\/burlingtonnews\.ca/, '');
  if (clean === '/') return 'index.html';
  return join(clean.replace(/^\//, ''), 'index.html');
}

function isStub(text) {
  return /location\.replace\(/.test(text) && /noindex,follow/.test(text);
}

for (const item of [...redirects.redirects, ...redirects.articleRedirects]) {
  if (!item.to) {
    fail(`${item.from} missing destination`);
    continue;
  }
  if (item.to.includes('.html')) fail(`${item.from} destination still has .html: ${item.to}`);
  if (!item.to.endsWith('/')) fail(`${item.from} destination missing trailing slash: ${item.to}`);
  const stubPath = join(root, item.file);
  if (!existsSync(stubPath)) {
    fail(`missing stub ${item.file}`);
    continue;
  }
  const stub = readFileSync(stubPath, 'utf8');
  if (!isStub(stub)) fail(`${item.file} is not a redirect stub`);
  if (!stub.includes(`location.replace('${item.to}')`) && !stub.includes(`location.replace("${item.to}")`)) {
    fail(`${item.file} does not replace to ${item.to}`);
  }
  if (/\.html/.test(item.to)) fail(`chain risk ${item.file} -> ${item.to}`);
  const dest = join(root, destFile(item.to));
  if (!existsSync(dest)) fail(`destination missing for ${item.from} -> ${item.to}`);
  else {
    const destHtml = readFileSync(dest, 'utf8');
    if (isStub(destHtml)) fail(`redirect chain ${item.from} -> ${item.to} is also a stub`);
  }
}

if (sitemap.includes('.html')) fail('sitemap includes .html URLs');
if (newsSitemap.includes('.html')) fail('news sitemap includes .html URLs');
if (!sitemap.includes('https://burlingtonnews.ca/events/')) fail('sitemap missing /events/ hub');
if (!sitemap.includes('https://burlingtonnews.ca/sources/')) fail('sitemap missing /sources/');
if (sitemap.includes('methodology.html')) fail('sitemap still lists methodology.html');

const loc = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
for (const url of loc) {
  if (url.includes('.html')) fail(`sitemap loc ${url}`);
  const file = destFile(url.replace('https://burlingtonnews.ca', ''));
  const path = join(root, file);
  if (!existsSync(path)) fail(`sitemap URL missing file ${url}`);
  else if (isStub(readFileSync(path, 'utf8'))) fail(`sitemap includes stub ${url}`);
}

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    if (['.git', 'node_modules'].includes(name)) continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, files);
    else if (name.endsWith('.html') || name.endsWith('.js') || name.endsWith('.json')) files.push(path);
  }
  return files;
}

const skipInternalHtml = new Set([
  'redirects.json',
  'scripts/migrate_clean_urls.py',
  'home.js',
  'site-extra.js',
  'site-bundle.js',
  'news-v1.js',
  'article-modern.js',
]);

for (const path of walk(root)) {
  const rel = relative(root, path);
  if (skipInternalHtml.has(rel)) continue;
  if (rel.startsWith('articles/') || rel.endsWith('.html') && isStub(readFileSync(path, 'utf8'))) continue;
  if (!rel.endsWith('.html') && !rel.endsWith('.js')) continue;
  const text = readFileSync(path, 'utf8');
  if (isStub(text)) continue;
  const hits = text.match(/href=["'](?!https?:)[^"']+\.html["']/g) || [];
  for (const hit of hits) {
    if (hit.includes('weather.gc.ca') || hit.includes('maps.arcgis') || hit.includes('index.html?')) continue;
    fail(`${rel} still has internal .html link ${hit}`);
  }
}

if (failed) process.exit(1);
console.log('PASS redirects', redirects.redirects.length, 'hub stubs', redirects.articleRedirects.length, 'article stubs', loc.length, 'sitemap urls');
