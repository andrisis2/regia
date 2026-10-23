// GitHub finto, in memoria: le API che usa l'app Regia, con sha veri alla git.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function sha1(s) { return crypto.createHash('sha1').update(s).digest('hex'); }
function blobSha(buf) { return sha1(Buffer.concat([Buffer.from('blob ' + buf.length + '\0'), buf])); }

class Repo {
  constructor(dir) {
    this.blobs = {}; this.trees = {}; this.commits = {}; this.head = null;
    this.runs = []; this.dispatches = []; this.annullati = []; this.log = []; this.private = true;
    this.offline = false; this.permessoActions = true;
    const files = {};
    const walk = (d, rel) => {
      for (const n of fs.readdirSync(d)) {
        if (n === '.git' || n === '__pycache__') continue;
        const p = path.join(d, n), r = rel ? rel + '/' + n : n;
        if (fs.statSync(p).isDirectory()) walk(p, r);
        else files[r] = this.putBlob(fs.readFileSync(p));
      }
    };
    if (dir) walk(dir, '');
    this.commit(files, 'inizio', []);
  }
  putBlob(buf) { const s = blobSha(buf); this.blobs[s] = buf; return s; }
  putTree(files) { const s = sha1('tree ' + JSON.stringify(Object.entries(files).sort())); this.trees[s] = Object.assign({}, files); return s; }
  commit(files, message, parents) {
    const tree = this.putTree(files);
    const s = sha1('commit ' + tree + message + Date.now() + Math.random());
    this.commits[s] = { tree, message, parents: parents || (this.head ? [this.head] : []) };
    this.head = s; this.log.push(message);
    return s;
  }
  files() { return this.trees[this.commits[this.head].tree]; }
  text(p) { const s = this.files()[p]; return s ? this.blobs[s].toString('utf8') : null; }
  write(p, text, message) { const f = Object.assign({}, this.files()); f[p] = this.putBlob(Buffer.from(text)); this.commit(f, message || 'scrive ' + p); }
  remove(p, message) { const f = Object.assign({}, this.files()); delete f[p]; this.commit(f, message || 'toglie ' + p); }
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept, X-GitHub-Api-Version, If-None-Match',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Expose-Headers': 'ETag, Link'
};

async function gestisci(repo, route) {
  const req = route.request();
  const url = new URL(req.url());
  const metodo = req.method();
  if (metodo === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
  if (repo.offline) return route.abort('internetdisconnected');
  const json = (status, body) => route.fulfill({ status, headers: Object.assign({ 'Content-Type': 'application/json' }, CORS), body: body == null ? '' : JSON.stringify(body) });
  // come GitHub: con l'ETag giusto, «non è cambiato niente» (304) senza corpo
  const conEtag = body => {
    const tag = 'W/"' + require('crypto').createHash('sha1').update(JSON.stringify(body)).digest('hex') + '"';
    if (req.headers()['if-none-match'] === tag) { repo.nonCambiati = (repo.nonCambiati || 0) + 1; return route.fulfill({ status: 304, headers: Object.assign({ ETag: tag }, CORS), body: '' }); }
    return route.fulfill({ status: 200, headers: Object.assign({ 'Content-Type': 'application/json', ETag: tag }, CORS), body: JSON.stringify(body) });
  };
  const base = '/repos/andrisis2/regia-dati';
  if (!url.pathname.startsWith(base)) return json(404, { message: 'Not Found' });
  if (req.headers()['authorization'] !== 'Bearer tok-finto') return json(401, { message: 'Bad credentials' });
  const p = decodeURIComponent(url.pathname.slice(base.length));
  const body = req.postData() ? JSON.parse(req.postData()) : null;
  let m;

  if (p === '' && metodo === 'GET') return json(200, { full_name: 'andrisis2/regia-dati', private: repo.private });
  if (p === '/git/ref/heads/main') return conEtag({ object: { sha: repo.head } });
  if ((m = /^\/git\/trees\/([^/]+)$/.exec(p)) && metodo === 'GET') {
    let s = m[1] === 'main' ? repo.commits[repo.head].tree : repo.commits[m[1]] ? repo.commits[m[1]].tree : m[1];
    const t = repo.trees[s]; if (!t) return json(404, { message: 'Not Found' });
    return json(200, { sha: s, truncated: false, tree: Object.entries(t).map(([path, sha]) => ({ path, sha, type: 'blob', mode: '100644' })) });
  }
  if ((m = /^\/git\/commits\/([0-9a-f]+)$/.exec(p)) && metodo === 'GET') {
    const c = repo.commits[m[1]]; if (!c) return json(404, { message: 'Not Found' });
    return json(200, { sha: m[1], tree: { sha: c.tree }, message: c.message });
  }
  if ((m = /^\/git\/blobs\/([0-9a-f]+)$/.exec(p)) && metodo === 'GET') {
    const b = repo.blobs[m[1]]; if (!b) return json(404, { message: 'Not Found' });
    return json(200, { sha: m[1], size: b.length, encoding: 'base64', content: b.toString('base64').replace(/(.{60})/g, '$1\n') });
  }
  if ((m = /^\/contents\/(.+)$/.exec(p))) {
    const fp = m[1], files = repo.files();
    if (metodo === 'GET') {
      const s = files[fp]; if (!s) return json(404, { message: 'Not Found' });
      return json(200, { path: fp, sha: s, size: repo.blobs[s].length, content: repo.blobs[s].toString('base64') });
    }
    if (metodo === 'PUT') {
      if (files[fp] && !body.sha) return json(422, { message: '"sha" wasn\'t supplied.' });
      if (files[fp] && body.sha !== files[fp]) return json(409, { message: 'is at ' + files[fp] + ' but expected ' + body.sha });
      const f = Object.assign({}, files); f[fp] = repo.putBlob(Buffer.from(body.content, 'base64'));
      const c = repo.commit(f, body.message);
      return json(files[fp] ? 200 : 201, { content: { path: fp, sha: f[fp] }, commit: { sha: c } });
    }
  }
  if (p === '/git/blobs' && metodo === 'POST') return json(201, { sha: repo.putBlob(Buffer.from(body.content, body.encoding === 'base64' ? 'base64' : 'utf8')) });
  if (p === '/git/trees' && metodo === 'POST') {
    const f = Object.assign({}, repo.trees[body.base_tree] || {});
    for (const e of body.tree) {
      if (e.sha === null) delete f[e.path];
      else f[e.path] = e.content != null ? repo.putBlob(Buffer.from(e.content)) : e.sha;
    }
    return json(201, { sha: repo.putTree(f) });
  }
  if (p === '/git/commits' && metodo === 'POST') {
    const s = sha1('c' + body.tree + body.message + Math.random());
    repo.commits[s] = { tree: body.tree, message: body.message, parents: body.parents };
    return json(201, { sha: s });
  }
  if (p === '/git/refs/heads/main' && metodo === 'PATCH') {
    const c = repo.commits[body.sha];
    if (!c || c.parents[0] !== repo.head) return json(422, { message: 'Update is not a fast forward' });
    repo.head = body.sha; repo.log.push(c.message);
    return json(200, { object: { sha: body.sha } });
  }
  if (p === '/actions/workflows/claude.yml/runs') {
    if (!repo.permessoActions) return json(403, { message: 'Resource not accessible by personal access token' });
    return conEtag({ total_count: repo.runs.length, workflow_runs: repo.runs });
  }
  if ((m = /^\/actions\/runs\/(\d+)\/jobs$/.exec(p))) {
    if (!repo.permessoActions) return json(403, { message: 'Resource not accessible by personal access token' });
    const run = repo.runs.find(r => String(r.id) === m[1]);
    if (!run) return json(404, { message: 'Not Found' });
    return json(200, { total_count: 1, jobs: [{ id: 1, status: run.status, steps: run.steps || [] }] });
  }
  if ((m = /^\/actions\/runs\/(\d+)\/cancel$/.exec(p)) && metodo === 'POST') {
    if (!repo.permessoActions) return json(403, { message: 'Resource not accessible by personal access token' });
    const run = repo.runs.find(r => String(r.id) === m[1]);
    if (!run) return json(404, { message: 'Not Found' });
    if (run.status === 'completed') return json(409, { message: 'Cannot cancel a workflow run that is completed.' });
    repo.annullati.push(run.id); run.status = 'completed'; run.conclusion = 'cancelled';
    return json(202, {});
  }
  if (p === '/actions/workflows/claude.yml/dispatches' && metodo === 'POST') {
    if (!repo.permessoActions) return json(403, { message: 'Resource not accessible by personal access token' });
    repo.dispatches.push(body); return json(204, null);
  }
  return json(404, { message: 'Not Found: ' + metodo + ' ' + p });
}

module.exports = { Repo, gestisci, CORS };
