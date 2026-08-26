import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { handleContact } from '../lib/contact.js';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const PORT = Number(process.env.PORT || 8765);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8'
};

function toRequest(req, body) {
  const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) headers.set(key, Array.isArray(value) ? value.join(',') : value);
  }
  return new Request(url, {
    method: req.method,
    headers,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body
  });
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function sendFile(res, filePath) {
  const data = await readFile(filePath);
  res.writeHead(200, { 'content-type': TYPES[extname(filePath)] || 'application/octet-stream' });
  res.end(data);
}

const env = {
  CONTACT_EMAIL_TO: process.env.CONTACT_EMAIL_TO || 'feedback@burlingtonnews.ca',
  CONTACT_EMAIL_FROM: process.env.CONTACT_EMAIL_FROM || '',
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  CONTACT_DRY_RUN: process.env.CONTACT_DRY_RUN || '1'
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
    if (url.pathname === '/api/contact') {
      const body = await readBody(req);
      const request = toRequest(req, body);
      const response = await handleContact(request, env);
      const out = Buffer.from(await response.arrayBuffer());
      const headers = {};
      response.headers.forEach((value, key) => { headers[key] = value; });
      res.writeHead(response.status, headers);
      res.end(out);
      return;
    }

    let path = decodeURIComponent(url.pathname);
    if (path.endsWith('/')) path += 'index.html';
    const filePath = normalize(join(ROOT, path));
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    const info = await stat(filePath);
    if (info.isDirectory()) {
      await sendFile(res, join(filePath, 'index.html'));
      return;
    }
    await sendFile(res, filePath);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(500);
    res.end('Server error');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Burlington News local server http://127.0.0.1:${PORT} (contact dry-run=${env.CONTACT_DRY_RUN})`);
});
