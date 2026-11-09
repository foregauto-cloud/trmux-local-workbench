'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT || 3000);
const ROOT = path.resolve(process.env.TRMUX_WORKSPACE || path.join(__dirname, 'workspace'));
const PUBLIC = path.join(__dirname, 'public');
const MAX_BODY = 1024 * 1024;
const MAX_FILES = 1200;
const EXCLUDED = new Set(['.git', 'node_modules', '.cache', 'dist', 'build']);
const RULES = [
  ['authentication-failure', /(?:failed|invalid|denied).{0,50}(?:login|logon|authentication|password)|(?:login|authentication).{0,50}(?:failed|invalid|denied)/i],
  ['privilege-change', /(?:sudo|elevation|privilege|role).{0,60}(?:granted|changed|escalat|administrator)/i],
  ['suspicious-command-indicator', /(?:powershell.{0,80}(?:-enc|encodedcommand)|curl\s+[^\n|]+\|\s*(?:sh|bash)|wget\s+[^\n|]+\|\s*(?:sh|bash))/i],
  ['path-traversal-indicator', /(?:\.\.\/|\.\.\\|%2e%2e(?:%2f|%5c))/i]
];

function json(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body), 'Cache-Control': 'no-store' });
  res.end(body);
}
function validPath(input) {
  if (typeof input !== 'string' || !input || input.length > 240 || input.includes('\\') || input.startsWith('/') || input.includes('\0')) throw new Error('Invalid workspace path.');
  const segments = input.split('/');
  if (segments.some(s => !s || s === '.' || s === '..' || s.startsWith('.'))) throw new Error('Hidden, empty, and parent paths are not available.');
  const resolved = path.resolve(ROOT, ...segments);
  if (resolved !== ROOT && !resolved.startsWith(ROOT + path.sep)) throw new Error('Path escapes the workspace.');
  return { segments, resolved };
}
function ensureWorkspace() { fs.mkdirSync(ROOT, { recursive: true }); }
function safeFile(input) {
  const { segments, resolved } = validPath(input);
  let current = ROOT;
  for (const segment of segments) {
    current = path.join(current, segment);
    try {
      const st = fs.lstatSync(current);
      if (st.isSymbolicLink()) throw new Error('Symbolic links are not allowed in the workspace.');
    } catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  return resolved;
}
function listFiles() {
  ensureWorkspace(); const out = [];
  function walk(dir, relative = '') {
    if (out.length >= MAX_FILES) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (EXCLUDED.has(entry.name) || entry.name.startsWith('.')) continue;
      const rel = relative ? `${relative}/${entry.name}` : entry.name;
      const full = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) walk(full, rel);
      else if (entry.isFile()) out.push({ path: rel, size: fs.statSync(full).size });
      if (out.length >= MAX_FILES) break;
    }
  }
  walk(ROOT); return out.sort((a,b) => a.path.localeCompare(b.path));
}
async function readJson(req) {
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > MAX_BODY) throw Object.assign(new Error('Request body exceeds 1 MiB.'), { status: 413 }); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw Object.assign(new Error('Invalid JSON.'), { status: 400 }); }
}
async function limitedJson(response, limit = 2 * 1024 * 1024) {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > limit) throw new Error('Local model response exceeded size limit.');
  if (!response.body) throw new Error('Empty response from local model runtime.');
  const reader = response.body.getReader(), chunks = []; let total = 0;
  try {
    while (true) { const { done, value } = await reader.read(); if (done) break; total += value.byteLength; if (total > limit) { await reader.cancel(); throw new Error('Local model response exceeded size limit.'); } chunks.push(Buffer.from(value)); }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
function sameOrigin(req) {
  if (req.headers['sec-fetch-site'] === 'cross-site') return false;
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.host && ['http:', 'https:'].includes(new URL(origin).protocol); } catch { return false; }
}
async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
  if (url.pathname.startsWith('/api/') && !sameOrigin(req)) return json(res, 403, { ok: false, error: 'Cross-origin request denied.' });
  if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, { ok: true, app: 'Trmux Local Workbench', mode: 'loopback-only', workspace: ROOT });
  if (req.method === 'GET' && url.pathname === '/api/files') {
    try { return json(res, 200, { ok: true, workspace: ROOT, files: listFiles() }); } catch { return json(res, 500, { ok: false, error: 'Could not list workspace.' }); }
  }
  if (req.method === 'GET' && url.pathname === '/api/file') {
    try {
      const target = safeFile(url.searchParams.get('path'));
      const st = fs.lstatSync(target);
      if (!st.isFile() || st.size > MAX_BODY) return json(res, 413, { ok: false, error: 'File is not regular or exceeds 1 MiB.' });
      return json(res, 200, { ok: true, path: url.searchParams.get('path'), content: fs.readFileSync(target, 'utf8') });
    } catch (e) { return json(res, e.code === 'ENOENT' ? 404 : 400, { ok: false, error: e.message }); }
  }
  if (req.method === 'PUT' && url.pathname === '/api/file') {
    try {
      const body = await readJson(req);
      if (typeof body.path !== 'string' || typeof body.content !== 'string' || Buffer.byteLength(body.content) > MAX_BODY) return json(res, 400, { ok: false, error: 'Expected path and text content up to 1 MiB.' });
      const target = safeFile(body.path);
      let parent = ROOT;
      for (const segment of body.path.split('/').slice(0, -1)) {
        parent = path.join(parent, segment);
        try { const st = fs.lstatSync(parent); if (st.isSymbolicLink() || !st.isDirectory()) throw new Error('Unsafe workspace directory.'); }
        catch (e) { if (e.code !== 'ENOENT') throw e; fs.mkdirSync(parent); }
      }
      try { const st = fs.lstatSync(target); if (st.isSymbolicLink() || !st.isFile()) throw new Error('Only regular files can be edited.'); }
      catch (e) { if (e.code !== 'ENOENT') throw e; }
      fs.writeFileSync(target, body.content, { encoding: 'utf8', mode: 0o600 });
      return json(res, 200, { ok: true, path: body.path, saved: true });
    } catch (e) { return json(res, e.status || 400, { ok: false, error: e.message }); }
  }
  if (req.method === 'POST' && url.pathname === '/api/analyze') {
    try {
      const body = await readJson(req);
      if (typeof body.text !== 'string' || !body.text.trim() || body.text.length > 100000) return json(res, 400, { ok: false, error: 'Provide log text up to 100,000 characters.' });
      const findings = [];
      body.text.split(/\r?\n/).forEach((line, i) => { for (const [category, rule] of RULES) if (rule.test(line)) { findings.push({ line: i + 1, category, excerpt: line.slice(0, 180) }); break; } });
      return json(res, 200, { ok: true, linesAnalyzed: body.text.split(/\r?\n/).length, findings, note: 'Heuristic indicators only; input is analyzed in memory and not retained.' });
    } catch (e) { return json(res, e.status || 400, { ok: false, error: e.message }); }
  }
  if (req.method === 'GET' && url.pathname === '/api/models') {
    try {
      const r = await fetch('http://127.0.0.1:11434/api/tags', { redirect: 'error', signal: AbortSignal.timeout(3000) });
      if (!r.ok) return json(res, 503, { ok: false, models: [], error: `Local Ollama returned HTTP ${r.status}.` });
      const data = await limitedJson(r); return json(res, 200, { ok: true, models: Array.isArray(data.models) ? data.models.filter(x => typeof x.name === 'string').map(x => ({ id: x.name, size: Number(x.size) || 0 })) : [] });
    } catch { return json(res, 503, { ok: false, models: [], error: 'Local Ollama not detected at 127.0.0.1:11434.' }); }
  }
  if (req.method === 'POST' && url.pathname === '/api/chat') {
    try {
      const body = await readJson(req);
      if (typeof body.model !== 'string' || body.model.length > 200 || typeof body.prompt !== 'string' || !body.prompt.trim() || body.prompt.length > 20000) return json(res, 400, { ok: false, error: 'Choose a local model and enter a prompt up to 20,000 characters.' });
      const inv = await fetch('http://127.0.0.1:11434/api/tags', { redirect: 'error', signal: AbortSignal.timeout(3000) });
      if (!inv.ok) return json(res, 503, { ok: false, error: 'Local Ollama is unavailable.' });
      const models = await limitedJson(inv);
      if (!(models.models || []).some(m => m.name === body.model)) return json(res, 400, { ok: false, error: 'Select a model already installed in local Ollama.' });
      const response = await fetch('http://127.0.0.1:11434/api/chat', { method: 'POST', redirect: 'error', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: body.model, messages: [{ role: 'user', content: body.prompt }], stream: false }), signal: AbortSignal.timeout(120000) });
      if (!response.ok) return json(res, 503, { ok: false, error: `Local Ollama returned HTTP ${response.status}.` });
      const data = await limitedJson(response, 4 * 1024 * 1024);
      return json(res, 200, { ok: true, message: typeof data.message?.content === 'string' ? data.message.content : '', localOnly: true });
    } catch (e) { return json(res, e.status || 503, { ok: false, error: e.message || 'Local inference failed.' }); }
  }
  if (url.pathname.startsWith('/api/')) return json(res, 404, { ok: false, error: 'Unknown API endpoint.' });
  if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { ok: false, error: 'Method not allowed.' });
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { return json(res, 400, { ok: false, error: 'Invalid URL.' }); }
  const requested = path.resolve(PUBLIC, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (!requested.startsWith(PUBLIC + path.sep)) return json(res, 403, { ok: false, error: 'Forbidden.' });
  let file = requested;
  try { if (!fs.statSync(file).isFile()) file = path.join(PUBLIC, 'index.html'); } catch { file = path.join(PUBLIC, 'index.html'); }
  const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
  try {
    const data = fs.readFileSync(file);
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Content-Length': data.length, 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'" });
    return res.end(req.method === 'HEAD' ? undefined : data);
  } catch { return json(res, 404, { ok: false, error: 'Not found.' }); }
}

ensureWorkspace();
const server = http.createServer((req, res) => { handler(req, res).catch(() => { if (!res.headersSent) json(res, 500, { ok: false, error: 'Internal server error.' }); }); });
server.listen(PORT, HOST, () => console.log(`Trmux Local Workbench: http://${HOST}:${server.address().port}\nWorkspace: ${ROOT}\nNo shell execution or remote model calls are enabled.`));
