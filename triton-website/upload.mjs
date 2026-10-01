// POST /api/upload (owner only) – body is the photo. Returns {url}.
import { getStore } from '@netlify/blobs';
import { randomUUID } from 'node:crypto';
import { isOwner, json } from '../lib/auth.mjs';

const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX = 5 * 1024 * 1024;

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!isOwner(req)) return json({ error: 'Not logged in' }, 401);
  const type = (req.headers.get('content-type') || '').split(';')[0].trim();
  if (!TYPES[type]) return json({ error: 'Please upload a JPG, PNG or WebP photo' }, 415);
  const data = await req.arrayBuffer();
  if (!data.byteLength || data.byteLength > MAX) return json({ error: 'Photo is too large' }, 413);
  const id = `${Date.now()}-${randomUUID().slice(0, 8)}.${TYPES[type]}`;
  await getStore('site-images').set(id, data, { metadata: { type } });
  return json({ url: `/api/img/${id}` });
};

export const config = { path: '/api/upload' };
