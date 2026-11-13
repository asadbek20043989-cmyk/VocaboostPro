# v16 — Global Blitz «ochiq lobbi»

Kutish 12 s → 60 s. Kimdir navbatda kutayotganini boshqa o'yinchilar ko'radi va bosib shu odamga ulanadi.
Server: `bq.mjs` — `join` ga `prefer:<uid>` (bosilgan kutuvchi birinchi; daraja ±1 ichida bo'lishi shart, aks holda eski tartib). ETag poygasi o'zgarmagan. Botga hech narsa yuborilmaydi.
Mijoz: `realtime.ts` `dbReadMode()`; `globalBlitz.ts` — `peekWaiters` (bq ni o'qiydi: 5 s, proksi rejimida 20 s; o'zi va oxirgi 5 raqib chiqariladi; «tirik» = hb soat bo'yicha yangi yoki hb o'zgarib turibdi), `startWaiterWatch`/`setWaiterWatchPaused`, `useGbWaiters`/`useGbToast`, `openGlobalBlitz(prefer?)`, `findOpponent(..., prefer)`. Bildirishnoma `uid:ts` kaliti bilan bir marta, 10 s turadi, kutuvchi ketsa yo'qoladi.
UI: `GlobalBlitz.tsx` — `GlobalBlitzHost` ichida kuzatuvchi va bosiladigan toast («Kimdir Global Blitz da raqib kutyapti!»; Global Blitz oynasi yoki duel ochiq bo'lsa chiqmaydi, kuzatuv ham to'xtaydi), qidiruv oynasida «ochiq lobbi» izohi. `HomeTab.tsx` va `DuelTab` kartasida «(N) raqib kutyapti» (bosilsa eng mos kutuvchiga ulanadi). `index.css` — toast progress animatsiyasi.
Qidiruv oynasida «Kutmasdan, saqlangan natija bilan boshlash» tugmasi (`signal.skip`, 3 s dan keyin ko'rinadi). Toast bir nechta kutuvchi bo'lsa «N kishi Global Blitz da raqib kutyapti!» deydi.
Tuzatish: «Yangi raqib» bosilganda oldingi o'yinning eski xonasi qayta ochilardi — `bq.mjs` `join` yangi qidiruvda (`first:true`) band qilingan eski yozuvni qaytarmaydi.
Jonli o'yinda raqib chiqarib tashlanmaydi: oldin o'ynagan odam bilan ham istalgan marta o'ynash mumkin, bildirishnoma/kartochka ham unga boradi (server `join` va `peekWaiters` dan `recent` olib tashlandi; faqat «ruh» raqib uchun qoladi). Kuniga bir raqibdan XP olish qoidasi (`same`) o'zgarmagan.
Test: `node test/blitz/run.mjs` — `prefer` testlari qo'shildi.

---

# v15 — Global Blitz (tugallandi)

Server: ismlar filtri, ball/mukofot/limit/haftalik reyting serverda, `bq.mjs` (join, ghost, saveghost+vs, submit), `db.mjs` global xonada `res/players/meta` yozuvini bloklaydi, `remind` tozalaydi, `admin.mjs` (getBlitz/setBlitz).
Mijoz: `globalBlitz.ts` (submitLive, saveGhost vs, info, haftalik reyting), `FriendDuel.tsx` (javoblar `a`, yaxlitlangan `m`, serverdan natija/mukofot, RewardLine, walkover matni), `GlobalBlitz.tsx` (limit/mukofot, haftalik reyting), `AppContext` (refreshGrants, «Global Blitz» xabari).
Admin: 🌍 Global Blitz bo'limi. Qoidalar: `database.rules.json` yangilandi (qayta joylang!). Hujjat: ADMIN.md (v15).

Sinalgan: `node test/blitz/run.mjs` (6 test, o'tdi). Sinalmagan: `vite build` / to'liq `tsc` (bu muhitda node_modules va tarmoq yo'q) — deploydan oldin `npm install && npm run lint && npm run build` ishga tushiring.
