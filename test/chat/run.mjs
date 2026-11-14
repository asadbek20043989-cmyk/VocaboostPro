// Chat funksiyasi testi: Firebase emulyatori (test/blitz/fakefb.mjs) bilan. Ishga tushirish: node test/chat/run.mjs
import { start, state, reset } from '../blitz/fakefb.mjs';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
const { url } = await start();
process.env.FIREBASE_DB_URL = url; process.env.FIREBASE_DB_SECRET = 's';
delete process.env.BOT_TOKEN;
const P = new URL('../../server', import.meta.url).pathname;
const { handler, isBadText, tidyText, cleanChatCfg } = await import(P + '/functions/chat.mjs');
const { handler: dbh } = await import(P + '/functions/db.mjs');

const call = async (body, headers = {}) => { const r = await handler({ httpMethod: 'POST', headers, body: JSON.stringify(body) }); return { status: r.statusCode, ...JSON.parse(r.body) }; };
const put = async (path, v) => { await fetch(`${url}/${path}.json`, { method: 'PUT', body: JSON.stringify(v) }); };
const seedUsers = async () => {
  await put('leaderboard/tg_1', { name: 'Ali', level: 'B1', xp: 120, ts: 1 });
  await put('leaderboard/tg_2', { name: 'Vali', level: 'A2', xp: 50, ts: 1 });
  await put('leaderboard/tg_3', { name: 'Sardor', level: 'A1', xp: 10, ts: 1 });
  await put('leaderboard/tg_4', { name: 'Dilnoza', level: 'B2', xp: 10, ts: 1 });
};
let pass = 0;
const t = async (name, fn) => { try { reset(); await seedUsers(); await fn(); pass++; console.log('ok  ', name); } catch (e) { console.log('FAIL', name, '\n', e.stack.split('\n').slice(0, 5).join('\n')); process.exitCode = 1; } };
const send = (uid, text, extra = {}) => call({ action: 'send', uid, text, ...extra });
const msgs = () => Object.values(state()?.chat?.general || {});

// ---------- filtr ----------
await t('filtr: oddiy gaplar o‘tadi', async () => {
  for (const s of ['Salom hammaga!', 'How do you say "kitob" in English?', 'Men 1 2 3 4 5 6 7 8 9 10 gacha sanayman', 'Sikandar ismli do‘stim bor', 'Ona sinfda o‘qiydi', 'Bugun 25 ta so‘z yodladim']) assert.equal(isBadText(s), false, s);
});
await t('filtr: haqorat, havola, @username, telefon bloklanadi', async () => {
  for (const s of ['you are a f u c k', 'sen axmoq', 'kanalimga kiring t.me/abc', 'https://x.com', 'yozing @super_kanal', 'tel +998 90 123 45 67', 'fuuuck', 'pidor']) assert.equal(isBadText(s), true, s);
});
await t('tidyText: boshqaruv va RTL belgilar olib tashlanadi, uzunlik kesiladi', async () => {
  assert.equal(tidyText('a\u202eb\n\n c', 10), 'a b c');
  assert.equal(tidyText('x'.repeat(500), 300).length, 300);
});

// ---------- yuborish ----------
await t('yuborish: xabar yoziladi, ism ligadan olinadi (mijozdan emas)', async () => {
  const r = await send('tg_1', 'Salom', { name: 'HACKER' });
  assert.equal(r.status, 200); assert.equal(r.msg.name, 'Ali'); assert.equal(r.msg.lv, 'B1');
  assert.equal(msgs().length, 1); assert.equal(msgs()[0].text, 'Salom');
  assert.ok(/^t[0-9a-z]{11}$/.test(r.msg.id));
});
await t('yuborish: ligada yo‘q foydalanuvchi yoza olmaydi', async () => { assert.equal((await send('tg_999', 'hi')).status, 403); });
await t('yuborish: bo‘sh va noto‘g‘ri ID', async () => { assert.equal((await send('tg_1', '   ')).status, 400); assert.equal((await send('x', 'hi')).status, 400); });
await t('yuborish: haqoratli xabar saqlanmaydi', async () => { const r = await send('tg_1', 'sen axmoq'); assert.equal(r.status, 400); assert.equal(msgs().length, 0); });
await t('tezlik: 3 soniyadan tez — 429; bir xil matn — 429', async () => {
  assert.equal((await send('tg_1', 'bir')).status, 200);
  assert.equal((await send('tg_1', 'ikki')).status, 429);
  await put('chatLim/tg_1/ts', Date.now() - 5000);
  assert.equal((await send('tg_1', 'BIR!')).status, 429); // bir xil (belgilarsiz, katta-kichikdan qat'i nazar)
  assert.equal((await send('tg_1', 'uch')).status, 200);
});
await t('tezlik: daqiqada limit', async () => {
  await put('config/chat', { slowSec: 0, perMin: 3 });
  for (const w of ['a1', 'b2', 'c3']) assert.equal((await send('tg_2', 'matn ' + w)).status, 200);
  assert.equal((await send('tg_2', 'matn d4')).status, 429);
});
await t('mute: cheklangan foydalanuvchi yoza olmaydi, muddati o‘tgach yoza oladi', async () => {
  await put('chatMute/tg_1', { until: Date.now() + 600000 });
  assert.equal((await send('tg_1', 'salom')).status, 403);
  await put('chatMute/tg_1', { until: Date.now() - 1000 });
  assert.equal((await send('tg_1', 'salom')).status, 200);
});
await t('sozlama: chat o‘chirilgan, minXp, maxLen, admin so‘zlari', async () => {
  await put('config/chat', { enabled: false }); assert.equal((await send('tg_1', 'salom')).status, 403);
  await put('config/chat', { minXp: 100 });
  assert.equal((await send('tg_3', 'salom')).status, 403); assert.equal((await send('tg_1', 'salom')).status, 200);
  await put('config/chat', { maxLen: 20, slowSec: 0, badWords: 'tarvuz' });
  assert.equal((await send('tg_2', 'tarvuz yaxshi')).status, 400);
  const r = await send('tg_2', 'x'.repeat(50)); assert.equal(r.status, 200); assert.equal(r.msg.text.length, 20);
  await put('config/blitz', { badWords: 'qovun' }); // Global Blitz ro'yxati ham ishlaydi
  assert.equal((await send('tg_4', 'qovun yaxshi')).status, 400);
});
await t('tozalash: xona chegaradan oshmaydi (keep)', async () => {
  await put('config/chat', { slowSec: 0, perMin: 60, keep: 20 });
  for (let i = 0; i < 20; i++) await put(`chat/general/t${String(i).padStart(11, '0')}`, { uid: 'tg_9', name: 'Old', text: 'eski ' + i, ts: i + 1 });
  const orig = Math.random; Math.random = () => 0; // tozalash har safar ishlasin
  try { for (let i = 0; i < 5; i++) assert.equal((await send('tg_1', 'yangi ' + i)).status, 200); } finally { Math.random = orig; }
  const left = msgs();
  assert.ok(left.length <= 21, 'qoldi: ' + left.length);
  assert.ok(left.some(m => m.text === 'yangi 4') && !left.some(m => m.text === 'eski 0'));
});

// ---------- shikoyat ----------
await t('shikoyat: 3 ta turli foydalanuvchidan keyin xabar yashiriladi; takroriy shikoyat hisoblanmaydi', async () => {
  const r = await send('tg_1', 'Shubhali xabar'); const id = r.msg.id;
  const rep = u => call({ action: 'report', uid: u, id });
  assert.equal((await rep('tg_2')).hidden, false);
  assert.equal((await rep('tg_2')).hidden, false); // takror
  assert.equal(state().chatReports[id].n, 1);
  assert.equal((await rep('tg_3')).hidden, false);
  assert.equal((await rep('tg_4')).hidden, true);
  assert.equal(state().chat.general[id].hidden, true);
  assert.equal(state().chatReports[id].text, 'Shubhali xabar');
  assert.equal((await rep('tg_1')).status, 400); // o'z xabariga
  assert.equal((await call({ action: 'report', uid: 'tg_2', id: 'topilmagan1' })).status, 404);
});

// ---------- Telegram imzosi ----------
await t('imzo: BOT_TOKEN bor bo‘lsa — to‘g‘ri initData kerak', async () => {
  process.env.BOT_TOKEN = '123:ABC';
  try {
    const mk = (user, tamper) => {
      const p = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify(user), query_id: 'q' });
      const check = [...p.entries()].map(([k, v]) => `${k}=${v}`).sort().join('\n');
      const secret = createHmac('sha256', 'WebAppData').update('123:ABC').digest();
      p.set('hash', createHmac('sha256', secret).update(check).digest('hex'));
      return p.toString() + (tamper ? 'x' : '');
    };
    assert.equal((await send('tg_1', 'salom')).status, 401); // imzosiz
    assert.equal((await send('tg_1', 'salom', { initData: mk({ id: 1, first_name: 'Ali' }, true) })).status, 401); // buzilgan
    assert.equal((await send('tg_2', 'salom', { initData: mk({ id: 1, first_name: 'Ali' }) })).status, 401); // boshqa hisob nomidan
    assert.equal((await send('web_abc123', 'salom', { initData: mk({ id: 1, first_name: 'Ali' }) })).status, 401); // web hisob yoza olmaydi
    assert.equal((await send('tg_1', 'salom', { initData: mk({ id: 1, first_name: 'Ali' }) })).status, 200);
  } finally { delete process.env.BOT_TOKEN; }
});

// ---------- db proksi: chatga yozish taqiqlangan, o‘qish mumkin ----------
await t('db proksi: chat/general ga yozib bo‘lmaydi, o‘qish ishlaydi', async () => {
  const w = await dbh({ httpMethod: 'PUT', headers: {}, queryStringParameters: { p: 'chat/general/tx' }, body: JSON.stringify({ uid: 'tg_1', text: 'soxta', ts: 1 }) });
  assert.equal(w.statusCode, 403);
  const r = await dbh({ httpMethod: 'GET', headers: {}, queryStringParameters: { p: 'chat/general' } });
  assert.equal(r.statusCode, 200);
});

t.pass = pass;
console.log(`\n${pass} ta test o'tdi`);
process.exit(process.exitCode || 0);
