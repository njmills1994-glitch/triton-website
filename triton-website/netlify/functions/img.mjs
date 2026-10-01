// GET /api/img/:id – serves a photo uploaded in edit mode.
import { getStore } from '@netlify/blobs';

export default async (req, context) => {
  const id = context.params?.id || new URL(req.url).pathname.split('/').pop();
  if (!/^[\w.-]+$/.test(id)) return new Response('Not found', { status: 404 });
  const res = await getStore('site-images').getWithMetadata(id, { type: 'arrayBuffer' });
  if (!res) return new Response('Not found', { status: 404 });
  return new Response(res.data, {
    headers: {
      'content-type': res.metadata?.type || 'image/jpeg',
      'cache-control': 'public, max-age=31536000, immutable',
      'netlify-cdn-cache-control': 'public, max-age=31536000, immutable',
    },
  });
};

export const config = { path: '/api/img/:id' };
