// Owner login helpers. The password is set in Netlify as the EDIT_PASSWORD environment variable.
import { createHmac, createHash, timingSafeEqual } from 'node:crypto';

const DAYS = 30;
const env = (k) => (globalThis.Netlify?.env?.get(k)) ?? process.env[k] ?? '';
const password = () => env('EDIT_PASSWORD');
const sign = (exp) => createHmac('sha256', 'triton-edit:' + password()).update(String(exp)).digest('hex');
const same = (a, b) => {
  const x = createHash('sha256').update(String(a)).digest();
  const y = createHash('sha256').update(String(b)).digest();
  return timingSafeEqual(x, y);
};

export const passwordIsSet = () => password().length > 0;
export const checkPassword = (pw) => passwordIsSet() && same(pw, password());

export function makeToken() {
  const exp = Date.now() + DAYS * 24 * 60 * 60 * 1000;
  return `${exp}.${sign(exp)}`;
}

export function isOwner(req) {
  if (!passwordIsSet()) return false;
  const m = /^Bearer\s+(\d+)\.([a-f0-9]{64})$/.exec(req.headers.get('authorization') || '');
  if (!m) return false;
  const exp = Number(m[1]);
  return exp > Date.now() && same(m[2], sign(exp));
}

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } });
