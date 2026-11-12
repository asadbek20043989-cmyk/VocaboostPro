// Minimal Firebase RTDB REST emulator: GET/PUT/PATCH/DELETE, ETag/if-match, .sv increment, orderBy/endAt/limitToFirst, shallow
import http from 'node:http';
let root = null;
let ver = 0;
const parts = p => p.split('/').filter(Boolean);
const get = (path) => { let n = root; for (const k of parts(path)) { if (n == null || typeof n !== 'object') return null; n = n[k]; } return n === undefined ? null : n; };
const clean = v => { if (v && typeof v === 'object') { for (const k of Object.keys(v)) { v[k] = clean(v[k]); if (v[k] == null || (typeof v[k] === 'object' && !Object.keys(v[k]).length)) delete v[k]; } } return v; };
const resolveSv = (old, v) => (v && typeof v === 'object' && v['.sv'] && v['.sv'].increment !== undefined ? (Number(old) || 0) + v['.sv'].increment : v);
const set = (path, val) => {
  const ks = parts(path);
  if (!ks.length) { root = clean(val); return; }
  if (root == null || typeof root !== 'object') root = {};
  let n = root;
  for (let i = 0; i < ks.length - 1; i++) { if (n[ks[i]] == null || typeof n[ks[i]] !== 'object') n[ks[i]] = {}; n = n[ks[i]]; }
  const k = ks[ks.length - 1];
  if (val == null) delete n[k]; else n[k] = resolveSv(n[k], val);
  clean(root);
  if (root == null) root = {};
};
const etagOf = v => 'E' + JSON.stringify(v ?? null).length + ':' + (JSON.stringify(v ?? null).split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7));
export const state = () => root;
export const reset = () => { root = {}; };
export function start(port = 0) {
  root = {};
  const srv = http.createServer((req, res) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const u = new URL(req.url, 'http://x');
      const path = decodeURIComponent(u.pathname.replace(/\.json$/, ''));
      const cur = get(path);
      const send = (code, v, headers = {}) => { res.writeHead(code, { 'Content-Type': 'application/json', ...headers }); res.end(JSON.stringify(v)); };
      if (req.method === 'GET') {
        let v = cur;
        if (u.searchParams.get('shallow') === 'true' && v && typeof v === 'object') { v = Object.fromEntries(Object.keys(v).map(k => [k, true])); }
        const ob = u.searchParams.get('orderBy');
        if (ob && v && typeof v === 'object') {
          const f = JSON.parse(ob); const end = Number(u.searchParams.get('endAt')); const lim = Number(u.searchParams.get('limitToFirst')) || 1e9;
          const val = x => f.split('/').reduce((a, k) => (a == null ? a : a[k]), x);
          const rows = Object.entries(v).filter(([, x]) => val(x) != null && val(x) <= end).sort((a, b) => val(a[1]) - val(b[1])).slice(0, lim);
          v = Object.fromEntries(rows);
        }
        const h = req.headers['x-firebase-etag'] ? { ETag: cur == null ? 'null_etag' : etagOf(cur) } : {};
        return send(200, v, h);
      }
      const ifm = req.headers['if-match'];
      if (ifm !== undefined) {
        const have = cur == null ? 'null_etag' : etagOf(cur);
        if (ifm !== have) return send(412, { error: 'Precondition failed' }, { ETag: have });
      }
      if (req.method === 'PUT') { set(path, JSON.parse(body)); return send(200, JSON.parse(body)); }
      if (req.method === 'PATCH') { const b = JSON.parse(body); for (const [k, v] of Object.entries(b)) set(path + '/' + k, v); return send(200, b); }
      if (req.method === 'DELETE') { set(path, null); return send(200, null); }
      send(405, {});
    });
  });
  return new Promise(r => srv.listen(port, () => r({ srv, url: `http://127.0.0.1:${srv.address().port}` })));
}
