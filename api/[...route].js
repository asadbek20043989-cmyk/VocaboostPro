import { handler as admin } from '../netlify/functions/admin.mjs';
import { handler as ai } from '../netlify/functions/ai.mjs';
import { handler as bot } from '../netlify/functions/bot.mjs';
import { handler as broadcast } from '../netlify/functions/broadcast.mjs';
import { handler as cert } from '../netlify/functions/cert.mjs';
import { handler as db } from '../netlify/functions/db.mjs';
import { handler as grants } from '../netlify/functions/grants.mjs';
import { handler as inbox } from '../netlify/functions/inbox.mjs';
import { handler as remind } from '../netlify/functions/remind.mjs';
import { handler as streakWarning } from '../netlify/functions/streak-warning.mjs';
import { handler as tgWebhook } from '../netlify/functions/tg-webhook.mjs';
import { handler as tgavatar } from '../netlify/functions/tgavatar.mjs';
import { handler as tts } from '../netlify/functions/tts.mjs';
import { handleVercel } from './_bridge.js';

const routes = {
  admin,
  ai,
  bot,
  broadcast,
  cert,
  db,
  grants,
  inbox,
  remind,
  'streak-warning': streakWarning,
  'tg-webhook': tgWebhook,
  tgavatar,
  tts,
};

export default async function handler(req, res) {
  const routeParam = req.query.route;
  const target = Array.isArray(routeParam) ? routeParam[0] : (routeParam || req.url.split('?')[0].split('/').filter(Boolean).pop());
  const fn = routes[target];

  if (!fn) {
    return res.status(404).json({ error: `Funksiya '${target}' topilmadi` });
  }

  return handleVercel(fn, req, res);
}
