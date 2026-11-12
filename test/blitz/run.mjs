import { start, state, reset } from './fakefb.mjs';
import assert from 'node:assert/strict';
const { url } = await start();
process.env.FIREBASE_DB_URL = url; process.env.FIREBASE_DB_SECRET = 's';
const P = new URL('../../server', import.meta.url).pathname;
const { handler: bq } = await import(P + '/functions/bq.mjs');
const { handler: dbh } = await import(P + '/functions/db.mjs');
const { cleanupBlitz, blitzDb, dropCfgCache, scoreLog, weekKeyOf } = await import(P + '/lib/blitz.mjs');
const { safeName } = await import(P + '/lib/names.mjs');

const call = async (body) => { const r = await bq({ httpMethod: 'POST', headers: {}, body: JSON.stringify(body) }); return { status: r.statusCode, ...JSON.parse(r.body) }; };
const mkQ = () => Array.from({ length: 15 }, (_, i) => ({ e: 'w' + i, p: '', u: 'u' + i, o: ['u' + i, 'x' + i, 'y' + i, 'z' + i] }));
const answers = (qs, okN, m = 1500) => qs.map((q, i) => i < okN ? { a: q.u, m } : { a: 'wrong', m });
let pass = 0; const t = async (name, fn) => { try { reset(); dropCfgCache(); await fn(); pass++; console.log('ok  ', name); } catch (e) { console.log('FAIL', name, '\n', e.stack.split('\n').slice(0, 4).join('\n')); process.exitCode = 1; } };
const A = { uid: 'u_alice', level: 'B1', name: 'Alice', avatar: '', recent: [] };
const B = { uid: 'u_bob', level: 'B1', name: 'Bob', avatar: '', recent: [] };
const C = { uid: 'u_carl', level: 'B1', name: 'Carl', avatar: '', recent: [] };

await t('names filter', async () => {
  assert.equal(safeName('Sikandar'), 'Sikandar'); assert.equal(safeName('Nigar'), 'Nigar');
  assert.equal(safeName('f u c k'), "O'yinchi"); assert.equal(safeName('t.me/spam'), "O'yinchi");
});

await t('scoreLog basics', async () => {
  const qs = mkQ(); const sc = scoreLog(qs, answers(qs, 15, 1000));
  assert.equal(sc.c, 15); assert.ok(sc.s > 0);
  assert.equal(scoreLog(qs, answers(qs, 15, 100), { rejectFast: true }), null);
});

await t('live match: A waits, B joins -> room; client res write blocked; submit settles + reward', async () => {
  let r = await call({ op: 'join', ...A, first: true }); assert.equal(r.matched, false); assert.equal(r.info.used, 0);
  await new Promise(x => setTimeout(x, 20));
  r = await call({ op: 'join', ...B }); assert.equal(r.matched, true); const code = r.code;
  assert.ok(state().bglobal[code]);
  // client round write (allowed), result write (blocked)
  const qs = mkQ();
  const w = (m, p, b) => dbh({ httpMethod: m, headers: {}, queryStringParameters: { p }, body: JSON.stringify(b) });
  let x = await w('PUT', `bduels/${code}/rounds/r1/u_alice`, { ts: Date.now(), by: 'u_alice', i: qs.map((_, i) => 'id' + i), q: qs });
  assert.equal(x.statusCode, 200, x.body);
  x = await w('PUT', `bduels/${code}/res/r1/u_bob`, { k: 'u_alice', s: 100, c: 1, t: 1 }); assert.equal(x.statusCode, 403);
  x = await w('PUT', `bduels/${code}/players/u_carl`, { name: 'c', joinedAt: 1 }); assert.equal(x.statusCode, 403);
  // friend (non-global) room still writable
  x = await w('PUT', `bduels/ZZZZZZ/meta`, { createdBy: 'u_bob', createdAt: 1 }); assert.equal(x.statusCode, 200, x.body);
  x = await w('PUT', `bduels/ZZZZZZ/res/r1/u_bob`, { k: 'u_bob', s: 100, c: 1, t: 1 }); assert.equal(x.statusCode, 200, x.body);
  // fake game: elapsed check -> too fast rejected
  let s1 = await call({ op: 'submit', ...A, code, n: 1, r: answers(qs, 15, 1000) });
  assert.equal(s1.status, 400, JSON.stringify(s1));
  // make room look old enough
  const g = state().bglobal[code]; await fetch(`${url}/bglobal/${code}/ts.json`, { method: 'PUT', body: JSON.stringify(Date.now() - 120000) });
  s1 = await call({ op: 'submit', ...A, code, n: 1, r: answers(qs, 15, 1000) }); assert.equal(s1.ok, true); assert.equal(s1.settled, false);
  // double submit keeps first
  const s1b = await call({ op: 'submit', ...A, code, n: 1, r: answers(qs, 0, 1000) }); assert.equal(s1b.s, s1.s);
  const s2 = await call({ op: 'submit', ...B, code, n: 1, r: answers(qs, 8, 2000) });
  assert.equal(s2.settled, true); assert.equal(s2.settle.outcome, 'lose'); assert.equal(s2.settle.xp, 0);
  const st = state().bduels[code].settle.r1; assert.equal(st.w, 'u_alice'); assert.equal(st.r.u_alice.xp, 10); assert.equal(st.r.u_alice.used, 1);
  const grants = Object.values(state().grants.u_alice); assert.equal(grants.length, 1); assert.equal(grants[0].amount, 10);
  assert.equal(state().grants.u_bob, undefined);
  const wk = state().bweek[weekKeyOf(new Date(Date.now() + 5 * 3600000).toISOString().slice(0, 10))];
  assert.equal(wk.u_alice.w, 1); assert.equal(wk.u_bob.w, 0); assert.equal(wk.u_bob.p, 1);
  // outsider cannot submit
  const sc = await call({ op: 'submit', ...C, code, n: 1, r: [] }); assert.equal(sc.status, 403);
  // friend room cannot be used
  const sf = await call({ op: 'submit', ...C, code: 'ZZZZZZ', n: 1, r: [] }); assert.equal(sf.status, 403);
});

await t('ghost flow: save, play vs, reward, same-opp-per-day, limit', async () => {
  const qs = mkQ();
  // Bob saves ghost by practice (no vs)
  let r = await call({ op: 'saveghost', ...B, q: qs, r: answers(qs, 10, 2500) }); assert.equal(r.ok, true); assert.equal(r.saved, true);
  // Alice: nobody in queue -> ghost
  await call({ op: 'join', ...A });
  let g = await call({ op: 'ghost', ...A }); assert.equal(g.ghost.id, 'u_bob'); assert.ok(state().bplay.u_alice);
  // submitting with wrong vs rejected
  r = await call({ op: 'saveghost', ...A, vs: 'u_other', r: answers(g.ghost.q, 15, 1000) }); assert.equal(r.ok, false);
  // too fast (elapsed < sum) rejected
  r = await call({ op: 'saveghost', ...A, vs: 'u_bob', r: answers(g.ghost.q, 15, 3000) }); assert.equal(r.ok, false);
  // reissue then age bplay.issued
  g = await call({ op: 'ghost', ...A });
  await fetch(`${url}/bplay/u_alice/issued.json`, { method: 'PUT', body: JSON.stringify(Date.now() - 200000) });
  r = await call({ op: 'saveghost', ...A, vs: 'u_bob', r: answers(g.ghost.q, 15, 1200) }); assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.settle.outcome, 'win'); assert.equal(r.settle.xp, 10); assert.equal(r.settle.used, 1);
  // replay same play rejected
  r = await call({ op: 'saveghost', ...A, vs: 'u_bob', r: answers(g.ghost.q, 15, 1200) }); assert.equal(r.ok, false);
  // same opponent again today: counted false why same
  for (const k of ['u_alice']) await call({ op: 'join', ...A });
  g = await call({ op: 'ghost', ...A, recent: [] });
  await fetch(`${url}/bplay/u_alice/issued.json`, { method: 'PUT', body: JSON.stringify(Date.now() - 200000) });
  r = await call({ op: 'saveghost', ...A, vs: g.ghost.id, r: answers(g.ghost.q, 15, 1200) });
  assert.equal(r.settle.why, 'same'); assert.equal(r.settle.xp, 0);
  assert.equal(Object.keys(state().grants.u_alice).length, 1);
  // limit: 5 distinct opponents
  for (let i = 0; i < 6; i++) {
    const o = { uid: 'u_o' + i, level: 'B1', name: 'O' + i, avatar: '', recent: [] };
    await call({ op: 'saveghost', ...o, q: qs, r: answers(qs, 5, 2500) });
  }
  const used = []; let lastWhy = '';
  for (let i = 0; i < 6; i++) {
    const rec = [ 'u_bob', ...[0,1,2,3,4,5].filter(j => j !== i).map(j => 'u_o' + j) ].slice(0,5);
    await call({ op: 'join', ...A, recent: rec }); // may be matched? no live
    const gg = await call({ op: 'ghost', ...A, recent: rec });
    if (!gg.ghost) continue;
    await fetch(`${url}/bplay/u_alice/issued.json`, { method: 'PUT', body: JSON.stringify(Date.now() - 200000) });
    const rr = await call({ op: 'saveghost', ...A, vs: gg.ghost.id, r: answers(gg.ghost.q, 15, 1200) });
    used.push(rr.settle.counted); lastWhy = rr.settle.why;
  }
  assert.ok(used.filter(Boolean).length <= 4, JSON.stringify(used)); assert.ok(lastWhy === 'limit' || lastWhy === 'same', lastWhy);
  const daily = Object.values(state().bdaily)[0].u_alice; assert.ok(daily.n <= 5);
});

await t('config: rewards off / xp / limit from config/blitz', async () => {
  await fetch(`${url}/config/blitz.json`, { method: 'PUT', body: JSON.stringify({ rewards: false, badWords: 'zzbad' }) });
  const qs = mkQ();
  await call({ op: 'saveghost', ...B, q: qs, r: answers(qs, 10, 2500) });
  await call({ op: 'join', ...A }); const g = await call({ op: 'ghost', ...A });
  await fetch(`${url}/bplay/u_alice/issued.json`, { method: 'PUT', body: JSON.stringify(Date.now() - 200000) });
  const r = await call({ op: 'saveghost', ...A, vs: 'u_bob', r: answers(g.ghost.q, 15, 1200) });
  assert.equal(r.settle.why, 'off'); assert.equal(r.settle.xp, 0); assert.equal(state().grants, undefined);
  const n = await call({ op: 'join', ...{ ...A, name: 'zzbad man' } }); // name replaced
  assert.equal(state().bq.B1.u_alice.name, "O'yinchi");
});

await t('cleanup removes stale data', async () => {
  const old = Date.now() - 30 * 86400000;
  await fetch(`${url}/bglobal/AAAAAA.json`, { method: 'PUT', body: JSON.stringify({ ts: Date.now() - 2 * 86400000, a: 'x', b: 'y' }) });
  await fetch(`${url}/bduels/AAAAAA.json`, { method: 'PUT', body: JSON.stringify({ meta: { createdAt: Date.now() - 2 * 86400000 } }) });
  await fetch(`${url}/bduels/BBBBBB.json`, { method: 'PUT', body: JSON.stringify({ meta: { createdAt: old } }) });
  await fetch(`${url}/bghost/B1/u_old.json`, { method: 'PUT', body: JSON.stringify({ ts: old }) });
  await fetch(`${url}/bplay/u_old.json`, { method: 'PUT', body: JSON.stringify({ issued: Date.now() - 3 * 86400000 }) });
  await fetch(`${url}/bdaily/2020-01-01/u.json`, { method: 'PUT', body: JSON.stringify({ n: 1 }) });
  await fetch(`${url}/bstats/2020-01-01/live.json`, { method: 'PUT', body: JSON.stringify(1) });
  await fetch(`${url}/bweek/2020-01-06/u.json`, { method: 'PUT', body: JSON.stringify({ w: 1 }) });
  await fetch(`${url}/bq/B1/u_dead.json`, { method: 'PUT', body: JSON.stringify({ ts: old, hb: old }) });
  const out = await cleanupBlitz(blitzDb());
  assert.ok(!out.errors, JSON.stringify(out));
  const s = state();
  assert.equal(s.bglobal, undefined); assert.equal(s.bduels, undefined); assert.equal(s.bghost, undefined); assert.equal(s.bplay, undefined);
  assert.equal(s.bdaily, undefined); assert.equal(s.bstats, undefined); assert.equal(s.bweek, undefined); assert.equal(s.bq, undefined);
  console.log('   cleanup:', JSON.stringify(out));
});
console.log('passed', pass);
process.exit(process.exitCode || 0);
