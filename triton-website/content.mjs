// GET /api/content -> saved edits (text, photos, links, gallery).  POST (owner only) saves them.
import { getStore } from '@netlify/blobs';
import { isOwner, json } from '../lib/auth.mjs';

const MAX_TEXT = 5000;
const okImg = (s) => typeof s === 'string' && (/^\/api\/img\/[\w.-]+$/.test(s) || /^images\/[\w.-]+$/.test(s));
const okLink = (s) => typeof s === 'string' && (s === '#' || /^https?:\/\/[^\s"<>]+$/i.test(s)) && s.length < 500;
const okKey = (k) => /^[\w.-]{1,60}$/.test(k);

function clean(body) {
  const out = { texts: {}, images: {}, links: {}, gallery: null };
  for (const [k, v] of Object.entries(body.texts || {})) if (okKey(k) && typeof v === 'string') out.texts[k] = v.slice(0, MAX_TEXT);
  for (const [k, v] of Object.entries(body.images || {})) if (okKey(k) && okImg(v)) out.images[k] = v;
  for (const [k, v] of Object.entries(body.links || {})) if (okKey(k) && okLink(v)) out.links[k] = v;
  if (Array.isArray(body.gallery)) {
    out.gallery = body.gallery.filter((p) => p && okImg(p.src)).slice(0, 500)
      .map((p) => ({ src: p.src, alt: typeof p.alt === 'string' ? p.alt.slice(0, 200) : '' }));
  }
  return out;
}

export default async (req) => {
  const store = getStore({ name: 'site-content', consistency: 'strong' });
  if (req.method === 'GET') {
    const data = await store.get('content', { type: 'json' });
    return json(data || {});
  }
  if (req.method === 'POST') {
    if (!isOwner(req)) return json({ error: 'Not logged in' }, 401);
    let body;
    try { body = await req.json(); } catch { return json({ error: 'Bad data' }, 400); }
    if (!body || typeof body !== 'object') return json({ error: 'Bad data' }, 400);
    const previous = await store.get('content', { type: 'json' });
    if (previous) await store.setJSON('content-previous', previous); // one-step backup
    await store.setJSON('content', clean(body));
    return json({ ok: true });
  }
  return json({ error: 'Method not allowed' }, 405);
};

export const config = { path: '/api/content' };
