# VocaBoost — Vercel'ga deploy qilish

## 1. GitHub'ga yuklash
Papka ichidagi fayllarni (papkaning o'zini emas) repo ildiziga yuklang. `package.json` va `vercel.json` repo ildizida turishi kerak.

## 2. Vercel'da import
Vercel > Add New > Project > GitHub repo'ni tanlang. Framework: **Vite** (avtomatik aniqlanadi), Build: `npm run build`, Output: `dist`.

## 3. Environment Variables (Settings > Environment Variables)
Netlify'dagi qiymatlarning hammasini shu yerga ko'chiring:

| O'zgaruvchi | Izoh |
|---|---|
| ADMIN_CODE | admin panel kodi |
| FIREBASE_DB_URL, FIREBASE_DB_SECRET | Firebase |
| BOT_TOKEN | Telegram bot |
| GEMINI_API_KEY | AI (ixtiyoriy: GEMINI_MODEL) |
| VITE_FIREBASE_DB_URL, VITE_TELEGRAM_APP_LINK, VITE_BOT_USERNAME, VITE_SITE_URL | brauzer uchun (build vaqtida o'qiladi) |
| SITE_URL | `https://sizning-sayt.vercel.app` (yoki o'z domeningiz) |
| CRON_SECRET | istalgan uzun maxfiy satr (3-bosqich uchun) |
| TG_WEBHOOK_SECRET, ADMIN_CHAT_ID, BOT_USERNAME | ixtiyoriy |

Muhim: o'zgaruvchi qo'shgach yoki o'zgartirgach **Redeploy** qiling (VITE_* ham, serverdagilar ham shundan keyin ishlaydi).

## 4. Telegram bot
Admin paneldagi "webhook o'rnatish" tugmasini yangi domen ochiq turib qayta bosing (webhook manzili `/api/fn/tg-webhook` bo'ldi). BotFather'da Mini App/Menu Button havolasini ham yangi domenga almashtiring.

## 5. Rejalashtirilgan vazifalar (cron) — Hobby
`vercel.json` da `crons` YO'Q: Hobby'da kuniga 1 martadan ko'p cron deploy'ni to'xtatadi. Vazifalarni tashqaridan chaqiramiz.
Hammasi `CRON_SECRET` bilan himoyalangan (`Authorization: Bearer <CRON_SECRET>` yoki `?key=<CRON_SECRET>`).

**a) remind va streak-warn — GitHub Actions** (`.github/workflows/cron.yml`).
GitHub repo > Settings > Secrets and variables > Actions > New repository secret:
- `SITE_URL` = sayt manzili (oxirida `/` siz)
- `CRON_SECRET` = Vercel'dagidek bir xil qiymat
Keyin Actions > scheduled-bot-tasks > Run workflow bilan sinang (xato bo'lsa endi qizil bo'ladi).

**b) welcome-cron — cron-job.org** (har 1 daqiqa; GitHub bunga yaramaydi).
Yangi cronjob: URL `https://SAYT/api/fn/welcome-cron`, jadval: every 1 minute, Advanced > Headers: `Authorization: Bearer <CRON_SECRET>`.

**Tekshirish:** `curl -i -H "Authorization: Bearer SECRET" https://SAYT/api/fn/welcome-cron` -> 200; sarlavhasiz -> 401.
Pro rejaga o'tsangiz, `crons` blokini `vercel.json` ga qaytarish mumkin (Vercel Bearer'ni o'zi yuboradi).

**Telegram webhook xavfsizligi:** `TG_WEBHOOK_SECRET` ni albatta qo'ying va webhook'ni `secret_token` bilan qayta o'rnating, aks holda soxta update yuborish mumkin.

## 6. Firebase
Realtime Database qoidalari o'zgarmaydi (`database.rules.json`). Faqat Authorized domains kerak bo'lsa, yangi domenni qo'shing.

## Tuzilma
- `api/fn/[name].js` — barcha server funksiyalarini bitta Vercel funksiyasi qiladi (Hobby 12 funksiya limitiga tushmaydi)
- `server/functions`, `server/lib` — eski Netlify funksiyalari (kodi deyarli o'zgarmagan)
- `/.netlify/functions/*` eski manzillari ham `vercel.json` orqali ishlaydi
- Xabar yuborish (broadcast) funksiyasi bir chaqiruvda ~45 soniya ishlaydi (Hobby chegarasi 60 s), vaqt tugasa o'zini yangidan chaqirib qolganini davom ettiradi (ro'yxat va joriy o'rin bazada: `broadcastJobs/<id>`). Zanjir uzilsa, soatlik `remind` yoki paneldagi «▶️ Davom ettirish» tugmasi qolganini yuboradi. Bir chaqiruv hajmini `BROADCAST_BUDGET_MS` (ms) bilan o'zgartirish mumkin.
