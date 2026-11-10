// Streak xabarlari (cron: har soat, faqat kerakli soatlarda). v11: endi HAMMA streakli foydalanuvchilarga ishlaydi.
//   • risk     — kecha mashq qilgan, bugun hali yo'q, kech bo'ldi  -> «streak xavf ostida»
//   • lost     — 2 kun oldin mashq qilgan (streak uzildi)           -> «yangidan boshlaymiz» (muzlatishi borlarga: «streak muzladi»)
//   • milestone— bugun mashq qilgan va 7/14/30/60/100... kunlik marraga yetdi -> tabrik + sovg'a (ilova ochilganda avtomatik qo'shiladi)
// Sozlamalar: admin panel → 🚀 Retention (config/retention.streak). Bir foydalanuvchiga kuniga cap tadan ko'p avtomatik xabar bormaydi.
import { makeDb, tashkentDay, tashkentNow, fillTpl, giftText, grantUpdates } from '../lib/tg.mjs';
import { loadRt, capOK, capMark, sendAuto, inBatches, isBlockedErr, bump, SAVER_RISK_TEXT, SAVER_FROZEN_TEXT } from '../lib/engage.mjs';

// Kredit tejash: faqat kerakli soatlarda (UTC). Toshkent = UTC+5:
//   05:10-07:10 UTC = 10:10-12:10 (uzilgan/muzlagan streak), 14:10-17:10 UTC = 19:10-22:10 (xavf ogohlantirishi + marralar).
// Admin paneldan frozenHour/riskHour ni shu oraliqdan tashqariga qo'ysangiz, jadvalni (.github/workflows/cron.yml) ham moslang.
export const config = { schedule: '10 5-7,14-17 * * *' };

const addDays = (key, n) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * 86400000).toISOString().slice(0, 10);
};

export const handler = async () => {
  const token = process.env.BOT_TOKEN;
  const db = makeDb();
  if (!token || !db) return { statusCode: 200, body: 'not configured' };
  const rt = await loadRt(db);
  const cfg = rt.streak;
  if (!cfg.enabled) return { statusCode: 200, body: 'disabled' };
  const t0 = Date.now();
  const day = tashkentDay();
  const hour = tashkentNow().getUTCHours();
  if (hour < Math.min(cfg.frozenHour, cfg.riskHour)) return { statusCode: 200, body: 'early' };
  const yesterday = addDays(day, -1);
  const twoAgo = addDays(day, -2);

  const [lb, users] = await Promise.all([db('GET', 'leaderboard'), db('GET', 'tgusers')]);
  const jobs = [];
  for (const [uid, e] of Object.entries(lb || {})) {
    if (!uid.startsWith('tg_') || !e || e.hidden || e.deleted) continue;
    const id = uid.slice(3);
    const u = (users || {})[id];
    if (!u || u.blocked || u.remind === false) continue;
    const streak = Number(e.streak) || 0;
    const savers = Number(e.sv) || 0;
    const lr = String(e.lr || '');
    if (streak <= 0 || !lr) continue;

    // 1) Marra: bugun mashq qilgan va yangi marraga yetgan
    if (cfg.milestoneOn && lr === day) {
      let sm = Number(u.sm) || 0;
      if (streak < sm) sm = 0; // seriya uzilib qayta boshlangan
      let hit = null;
      for (const m of cfg.milestones) if (m.days <= streak && m.days > sm) hit = m;
      if (hit) jobs.push({ pri: 0, id, uid, u, e, kind: 'milestone', streak, hit });
      continue;
    }
    if (streak < cfg.minStreak) continue;
    // 2) Xavf: kecha mashq qilgan, bugun hali yo'q
    if (lr === yesterday && hour >= cfg.riskHour && u.swR !== day) jobs.push({ pri: 1, id, uid, u, e, kind: 'risk', streak, savers });
    // 3) Uzilgan / muzlagan: 2 kun oldin mashq qilgan
    else if (lr === twoAgo && hour >= cfg.frozenHour && u.swF !== day) jobs.push({ pri: 2, id, uid, u, e, kind: savers > 0 ? 'frozen' : 'lost', streak, savers });
  }
  // Muhimlik: marralar, keyin xavf (streak katta -> avval), keyin uzilganlar
  jobs.sort((a, b) => a.pri - b.pri || b.streak - a.streak);
  const todo = jobs.slice(0, cfg.maxPerRun);
  const res = { milestone: 0, risk: 0, lost: 0, frozen: 0, blocked: 0, capped: 0, failed: 0 };
  const pick = (arr, id) => arr[(Number(id) + Math.floor(Date.now() / 86400000)) % arr.length];

  const processed = await inBatches(todo, { t0, budgetMs: 45000 }, async part => {
    const upd = {};
    await Promise.all(part.map(async j => {
      if (!capOK(j.u, day, rt.cap)) { res.capped++; return; }
      const name = String(j.u.name || j.e.name || '').trim();
      let text;
      let label = '🚀 Mashq qilish';
      let style = 'success';
      if (j.kind === 'milestone') {
        text = fillTpl(cfg.milestoneText, { name, streak: j.streak, gift: giftText(j.hit.type, j.hit.amount) });
        label = "🎁 Sovg'ani olish";
      } else if (j.kind === 'risk') {
        text = fillTpl(j.savers > 0 ? SAVER_RISK_TEXT : pick(cfg.riskTexts, j.id), { name, streak: j.streak });
        style = 'danger';
      } else if (j.kind === 'frozen') {
        text = fillTpl(SAVER_FROZEN_TEXT, { name, streak: j.streak });
      } else {
        text = fillTpl(pick(cfg.lostTexts, j.id), { name, streak: j.streak });
      }
      try {
        await sendAuto(token, Number(j.id), text, label, style);
        res[j.kind]++;
        j.u.am = capMark(j.u, day);
        upd[`tgusers/${j.id}/am`] = j.u.am;
        if (j.kind === 'milestone') {
          upd[`tgusers/${j.id}/sm`] = j.hit.days;
          Object.assign(upd, grantUpdates(j.uid, { ...j.hit, note: `${j.streak} kunlik streak sovg'asi` }, { flag: true }));
        } else upd[`tgusers/${j.id}/${j.kind === 'risk' ? 'swR' : 'swF'}`] = day;
      } catch (err) {
        if (err.code === 429) { /* inBatches keyingi bo'lakda davom etadi */ }
        else if (isBlockedErr(err)) { res.blocked++; upd[`tgusers/${j.id}/blocked`] = true; }
        else res.failed++;
      }
    }));
    if (Object.keys(upd).length) await db('PATCH', '', upd).catch(() => {});
  });
  await bump(db, { streakRisk: res.risk, streakLost: res.lost + res.frozen, milestone: res.milestone, blocked: res.blocked });
  return { statusCode: 200, body: JSON.stringify({ due: jobs.length, processed, ...res }) };
};
