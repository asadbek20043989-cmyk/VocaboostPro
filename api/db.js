import { handler } from '../netlify/functions/db.mjs';
import { handleVercel } from './_bridge.js';

export default function (req, res) {
  return handleVercel(handler, req, res);
}
