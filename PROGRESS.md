# v15 — Global Blitz (tugallandi)

Server: ismlar filtri, ball/mukofot/limit/haftalik reyting serverda, `bq.mjs` (join, ghost, saveghost+vs, submit), `db.mjs` global xonada `res/players/meta` yozuvini bloklaydi, `remind` tozalaydi, `admin.mjs` (getBlitz/setBlitz).
Mijoz: `globalBlitz.ts` (submitLive, saveGhost vs, info, haftalik reyting), `FriendDuel.tsx` (javoblar `a`, yaxlitlangan `m`, serverdan natija/mukofot, RewardLine, walkover matni), `GlobalBlitz.tsx` (limit/mukofot, haftalik reyting), `AppContext` (refreshGrants, «Global Blitz» xabari).
Admin: 🌍 Global Blitz bo'limi. Qoidalar: `database.rules.json` yangilandi (qayta joylang!). Hujjat: ADMIN.md (v15).

Sinalgan: `node test/blitz/run.mjs` (6 test, o'tdi). Sinalmagan: `vite build` / to'liq `tsc` (bu muhitda node_modules va tarmoq yo'q) — deploydan oldin `npm install && npm run lint && npm run build` ishga tushiring.
