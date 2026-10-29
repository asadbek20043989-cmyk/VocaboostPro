// Sertifikatlar: ommaviy tekshirish (QR kod shu yerga olib keladi) va so'z bosqichlari uchun avtomatik sertifikat berish.
//   GET  /.netlify/functions/cert?id=VB-000123     — ochiq: sertifikat ma'lumotlari (bekor qilingan bo'lsa topilmaydi)
//   POST {action:'claim', uid, n, name, initData}  — "n ta so'z yodlandi" sertifikatini oladi (har bir bosqich uchun bir marta)
//   POST {action:'welcome', uid, name, initData}   — ilovaga kirgan har bir foydalanuvchiga bir martalik «Minnatdorchilik» sertifikati
import { json, parseBody, verifyInitData, makeDb, issueCertificate, statsFromLb } from '../lib/tg.mjs';

const ID_RE = /^[A-Za-z0-9_\-]{3,40}$/;
const MILESTONES = { 100: 'bronze', 250: 'silver', 500: 'gold', 750: 'platinum', 1000: 'champion' };
const DEFAULT_TEXT = {
  bronze: ["100 ta so'z yodlandi", "Ajoyib boshlanish — 100 ta inglizcha so'z mustahkam yodlandi"],
  silver: ["250 ta so'z yodlandi", "Yarim yo'ldan oshdingiz — 250 ta so'z yodlandi"],
  gold: ["500 ta so'z yodlandi", 'Lug\'atingiz 500 ta so\'zga yetdi — tabriklaymiz!'],
  platinum: ["750 ta so'z yodlandi", "Maqsadga oz qoldi — 750 ta so'z yodlandi"],
  champion: ["1000 ta so'z — VocaBoost ustasi", "1000 ta so'zni to'liq yodlagan chempion"],
};

// «Minnatdorchilik» sertifikati (standart matn, admin paneldan tahrirlanadi)
const WELCOME_TITLE = '"Vocaboost" ilovamizga tashrif buyurganizdan bag\'oyatda mamnunmiz!!!';
const WELCOME_REASON = 'Hali oldinda sizni ko‘p sertifikat va sovrinlar kutmoqda...';

/** Yo'l bo'sh bo'lsagina band qiladi (ETag "null_etag"): ikki qurilma bir vaqtda so'rasa ham sertifikat bitta beriladi */
async function reserveOnce(path) {
  const { FIREBASE_DB_URL, FIREBASE_DB_SECRET } = process.env;
  const url = `${FIREBASE_DB_URL.replace(/\/$/, '')}/${path}.json?auth=${encodeURIComponent(FIREBASE_DB_SECRET)}`;
  const r = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'if-match': 'null_etag' }, body: JSON.stringify({ pending: true, ts: Date.now() }) });
  if (r.ok) return true;
  if (r.status === 412) return false;
  throw new Error(`DB xatosi ${r.status}`);
}

export const handler = async event => {
  const db = makeDb();
  if (!db) return json(503, { error: 'Baza sozlanmagan' });

  try {
    if (event.httpMethod === 'GET') {
      const id = String(event.queryStringParameters?.id || '').trim().toUpperCase();
      if (!ID_RE.test(id)) return json(400, { found: false, error: 'Raqam xato' });

      // Telegram Stories uchun to'g'ridan-to'g'ri sertifikat rasmi (JPEG)
      if (event.queryStringParameters?.image) {
        try {
          const imgData = await db('GET', `certImages/${id}`);
          if (imgData?.b64) {
            const cleanB64 = String(imgData.b64).replace(/^data:image\/[a-z]+;base64,/, '');
            return {
              statusCode: 200,
              headers: {
                'Content-Type': 'image/jpeg',
                'Cache-Control': 'public, max-age=604800',
                'Netlify-CDN-Cache-Control': 'public, s-maxage=604800, stale-while-revalidate=86400',
                'Access-Control-Allow-Origin': '*',
              },
              body: cleanB64,
              isBase64Encoded: true,
            };
          }
        } catch {
          /* fallback */
        }
        return {
          statusCode: 302,
          headers: { Location: '/og.png', 'Cache-Control': 'no-cache' },
        };
      }

      const idx = await db('GET', `certIndex/${id}`);
      if (!idx?.userId) return json(200, { found: false }, { 'Cache-Control': 'no-store' });
      const c = await db('GET', `certs/${idx.userId}/${id}`);
      if (!c) return json(200, { found: false });
      return json(200, {
        found: true,
        cert: { id, tpl: c.tpl, title: c.title || '', reason: c.reason || '', name: c.name || '', date: c.date || '', special: !c.auto, fmt: c.fmt || (c.tpl === 'thanks' ? 'story' : 'wide'), stats: c.stats || null },
      }, { 'Netlify-CDN-Cache-Control': 'public, s-maxage=120' });
    }

    if (event.httpMethod !== 'POST') return json(405, { error: 'POST yoki GET kerak' });
    const body = parseBody(event);
    if (!body) return json(400, { error: "Noto'g'ri so'rov" });
    if (body.action === 'welcome') {
      const wuid = String(body.uid || '');
      if (!ID_RE.test(wuid)) return json(400, { error: "So'rov noto'g'ri" });
      if (wuid.startsWith('tg_') && process.env.BOT_TOKEN) {
        const user = verifyInitData(body.initData, process.env.BOT_TOKEN);
        if (!user || `tg_${user.id}` !== wuid) return json(401, { error: 'Telegram imzosi tasdiqlanmadi' });
      }
      const had = await db('GET', `welcomeIdx/${wuid}`);
      if (had && had.id) {
        const c = await db('GET', `certs/${wuid}/${had.id}`);
        return json(200, c ? { ok: true, id: had.id, date: c.date, existing: true } : { ok: true, revoked: true }); // bekor qilingan bo'lsa qayta berilmaydi
      }
      if (had && had.pending && Date.now() - Number(had.ts || 0) < 60000) return json(200, { ok: true, pending: true });
      if (had && had.pending) await db('DELETE', `welcomeIdx/${wuid}`); // oldingi urinish yarim qolgan edi
      if (!(await reserveOnce(`welcomeIdx/${wuid}`))) return json(200, { ok: true, pending: true });
      try {
        const lbw = await db('GET', `leaderboard/${wuid}`);
        const nm = String(body.name || lbw?.name || "O'quvchi").trim().slice(0, 40) || "O'quvchi";
        const cfg = (await db('GET', 'config/thanksCert')) || {};
        const title = String(cfg.title || WELCOME_TITLE).trim();
        const reason = String(cfg.reason || WELCOME_REASON).trim();
        const issued = await issueCertificate(db, { userId: wuid, tpl: 'thanks', title, reason, name: nm, auto: true, fmt: 'story', stats: statsFromLb(lbw) });
        await db('PUT', `welcomeIdx/${wuid}`, { id: issued.id, ts: Date.now() });
        return json(200, { ok: true, id: issued.id, date: issued.date });
      } catch (err) {
        await db('DELETE', `welcomeIdx/${wuid}`).catch(() => {});
        throw err;
      }
    }
    if (body.action === 'storeImage') {
      const certId = String(body.id || '').trim().toUpperCase();
      const b64 = String(body.image || '');
      if (ID_RE.test(certId) && b64.length > 500 && b64.length < 5_000_000) {
        if (await db('GET', `certImages/${certId}/ts`).catch(() => null)) return json(200, { ok: true, existing: true }); // allaqachon bor — qayta yozilmaydi
        const cleanB64 = b64.replace(/^data:image\/[a-z]+;base64,/, '');
        await db('PUT', `certImages/${certId}`, { b64: cleanB64, ts: Date.now() }).catch(() => {});
        return json(200, { ok: true });
      }
      return json(400, { error: 'Rasm formati xato' });
    }
    // Qo'shimcha avtomatik sertifikatlar: Barqaror (streak), Bilim donosi (daraja tugatildi), Tezkor (duel g'alabalari), Mutaxassis (mavzuli to'plam)
    if (body.action === 'award') {
      const kind = String(body.kind || '');
      const key = String(body.key || '').slice(0, 30);
      const auid = String(body.uid || '');
      if (!ID_RE.test(auid) || !/^[a-z0-9_\-]{1,30}$/i.test(key)) return json(400, { error: "So'rov noto'g'ri" });
      if (auid.startsWith('tg_') && process.env.BOT_TOKEN) {
        const user = verifyInitData(body.initData, process.env.BOT_TOKEN);
        if (!user || `tg_${user.id}` !== auid) return json(401, { error: 'Telegram imzosi tasdiqlanmadi' });
      }
      const n = Math.max(0, Math.min(100000, Number(body.n) || 0));
      const lb = await db('GET', `leaderboard/${auid}`);
      if (!lb) return json(409, { error: "Reyting yozuvi hali yo'q", retry: true });
      let tpl = '', title = '', reason = '';
      if (kind === 'streak' && [7, 14, 30].includes(n)) {
        if (Number(lb.streak) < n) return json(409, { error: 'Streak yetarli emas', retry: true });
        tpl = 'consistent';
        title = `${n} kunlik uzluksiz streak`;
        reason = `Har kuni mashq qilib, ${n} kun ketma-ket o'z maqsadingizdan chekinmadingiz`;
      } else if (kind === 'level' && ['A1', 'A2', 'B1', 'B2+'].includes(String(body.level))) {
        if (Number(lb.mastered) < 20) return json(409, { error: "Yodlangan so'zlar hali kam", retry: true });
        tpl = 'wisdom';
        title = `${body.level} darajasi to'liq yodlandi`;
        reason = `${body.level} darajasidagi barcha so'zlarni 100% o'zlashtirgan o'quvchi`;
      } else if (kind === 'duel' && [10, 25, 50].includes(n)) {
        tpl = 'speed';
        title = `Blitz duelda ${n} marta g'alaba`;
        reason = `Raqiblarni tezlikda ortda qoldirgan haqiqiy tezkor o'yinchi`;
      } else if (kind === 'pack') {
        if (Number(lb.mastered) < 5) return json(409, { error: "Yodlangan so'zlar hali kam", retry: true });
        tpl = 'expert';
        title = String(body.title || "Haftalik mavzuli to'plam").slice(0, 70) + " — to'liq o'zlashtirildi";
        reason = "Mavzuli lug'at to'plamidagi barcha so'zlar muvaffaqiyatli yodlandi";
      } else return json(400, { error: 'Mezon noto\'g\'ri' });
      const idxPath = `awardIdx/${auid}/${kind}_${key}`;
      const had = await db('GET', idxPath);
      if (had && had.id) {
        const c = await db('GET', `certs/${auid}/${had.id}`);
        return json(200, c ? { ok: true, id: had.id, existing: true } : { ok: true, revoked: true });
      }
      if (!(await reserveOnce(idxPath))) return json(200, { ok: true, pending: true });
      try {
        const issued = await issueCertificate(db, { userId: auid, tpl, title, reason, name: String(body.name || lb.name || "O'quvchi").slice(0, 40), auto: true, stats: statsFromLb(lb) });
        await db('PUT', idxPath, { id: issued.id, ts: Date.now() });
        return json(200, { ok: true, id: issued.id, date: issued.date });
      } catch (err) {
        await db('DELETE', idxPath).catch(() => {});
        throw err;
      }
    }
    if (body.action !== 'claim') return json(400, { error: "Noma'lum amal" });

    const uid = String(body.uid || '');
    const n = Number(body.n);
    if (!ID_RE.test(uid) || !MILESTONES[n]) return json(400, { error: "So'rov noto'g'ri" });

    // Telegram foydalanuvchisi imzo bilan tasdiqlanadi (boshqa odam nomidan sertifikat olib bo'lmaydi)
    if (uid.startsWith('tg_') && process.env.BOT_TOKEN) {
      const user = verifyInitData(body.initData, process.env.BOT_TOKEN);
      if (!user || `tg_${user.id}` !== uid) return json(401, { error: 'Telegram imzosi tasdiqlanmadi' });
    }

    const existing = await db('GET', `milestoneIdx/${uid}/${n}`);
    if (existing) {
      const c = await db('GET', `certs/${uid}/${existing}`);
      if (c) return json(200, { ok: true, id: existing, date: c.date, existing: true });
      // sertifikat admin tomonidan bekor qilingan — qayta berilmaydi
      return json(200, { ok: true, revoked: true });
    }

    // Haqiqatan ham shuncha so'z yodlanganmi (reytingdagi yozuv bo'yicha)
    const lb = await db('GET', `leaderboard/${uid}`);
    if (!lb || Number(lb.mastered) < n) return json(409, { error: "Yodlangan so'zlar soni hali yetarli emas", retry: true });

    const tpl = MILESTONES[n];
    const custom = (await db('GET', `config/certText/${tpl}`)) || {};
    const [defTitle, defReason] = DEFAULT_TEXT[tpl];
    const fill = s => String(s).replace(/\{n\}/g, String(n));
    const issued = await issueCertificate(db, {
      userId: uid,
      tpl,
      title: custom.title ? fill(custom.title) : defTitle,
      reason: custom.reason ? fill(custom.reason) : defReason,
      name: String(body.name || lb.name || "O'quvchi").slice(0, 40),
      auto: true,
      milestone: n,
      stats: statsFromLb(lb),
    });
    await db('PUT', `milestoneIdx/${uid}/${n}`, issued.id);
    return json(200, { ok: true, id: issued.id, date: issued.date });
  } catch (e) {
    return json(500, { error: String(e.message || e) });
  }
};
