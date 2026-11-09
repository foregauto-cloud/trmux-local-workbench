'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'trmux-workbench-'));
const workspace = path.join(tmp, 'workspace'); fs.mkdirSync(workspace);
fs.writeFileSync(path.join(workspace, 'hello.js'), 'console.log("hello")\n');
const child = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT: '0', TRMUX_WORKSPACE: workspace }, stdio: ['ignore', 'pipe', 'pipe'] });
let output = '';
child.stdout.on('data', b => { output += b.toString(); });
function waitForUrl() { return new Promise((resolve, reject) => { const started = Date.now(); const poll = () => { const match=output.match(/http:\/\/127\.0\.0\.1:(\d+)/); if(match)return resolve(match[1]); if(Date.now()-started>5000)return reject(new Error('server startup timeout'));setTimeout(poll,30); };poll(); }); }
test('loopback app exposes safe workspace operations and triage', async t => {
  const port = await waitForUrl(); const base = `http://127.0.0.1:${port}`; t.after(() => child.kill('SIGTERM'));
  let r = await fetch(`${base}/health`); assert.equal(r.status, 200);
  r = await fetch(`${base}/api/files`); assert.equal((await r.json()).files[0].path, 'hello.js');
  r = await fetch(`${base}/api/file?path=hello.js`); assert.match((await r.json()).content, /hello/);
  r = await fetch(`${base}/api/file?path=..%2foutside`); assert.notEqual(r.status, 200);
  r = await fetch(`${base}/api/file`, { method: 'PUT', headers: {'content-type':'application/json'}, body: JSON.stringify({path:'notes/todo.md',content:'safe edit'}) }); assert.equal(r.status, 200); assert.equal(fs.readFileSync(path.join(workspace,'notes','todo.md'),'utf8'),'safe edit');
  r = await fetch(`${base}/api/analyze`, { method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:'authentication failed for user'}) });const analysis=await r.json();assert.equal(analysis.findings[0].category,'authentication-failure');
});
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
