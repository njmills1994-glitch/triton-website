// POST /api/login  {password}  -> {token}      GET /api/login -> 200 if the saved login is still valid
import { checkPassword, isOwner, makeToken, passwordIsSet, json } from '../lib/auth.mjs';

export default async (req) => {
  if (req.method === 'GET') return isOwner(req) ? json({ ok: true }) : json({ ok: false }, 401);
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!passwordIsSet()) return json({ error: 'Editing isn’t set up yet: add EDIT_PASSWORD in Netlify (see the setup guide).' }, 500);
  let body = {};
  try { body = await req.json(); } catch {}
  if (!checkPassword(String(body.password || ''))) {
    await new Promise((r) => setTimeout(r, 1000)); // slow down guessing
    return json({ error: 'That password didn’t work. Please try again.' }, 401);
  }
  return json({ token: makeToken() });
};

export const config = { path: '/api/login' };
