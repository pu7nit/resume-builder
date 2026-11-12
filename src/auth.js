import crypto from 'node:crypto';

/**
 * Optional single-password gate. With APP_PASSWORD unset the app is open (the
 * sensible default for a personal instance on localhost). When it is set, an
 * HttpOnly, SameSite=Lax cookie carrying an HMAC-signed expiry is required.
 */
const PASSWORD = (process.env.APP_PASSWORD || '').trim();
const SECRET =
  process.env.APP_SECRET ||
  crypto.createHash('sha256').update(`resume-builder:${PASSWORD}`).digest('hex');

const COOKIE_NAME = 'rb_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export function isAuthEnabled() {
  return PASSWORD.length > 0;
}

function sign(payload) {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
}

export function verifyPassword(candidate) {
  if (!isAuthEnabled()) return true;
  if (typeof candidate !== 'string') return false;
  const given = Buffer.from(candidate);
  const expected = Buffer.from(PASSWORD);
  if (given.length !== expected.length) return false;
  return crypto.timingSafeEqual(given, expected);
}

export function sessionCookie() {
  const expiry = String(Date.now() + MAX_AGE_SECONDS * 1000);
  const value = `${expiry}.${sign(expiry)}`;
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}`;
}

export function clearCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function isAuthorized(req) {
  if (!isAuthEnabled()) return true;
  const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
  if (!token) return false;
  const [expiry, signature] = token.split('.');
  if (!expiry || !signature) return false;
  if (!/^\d{1,16}$/.test(expiry)) return false;

  const given = Buffer.from(signature);
  const expected = Buffer.from(sign(expiry));
  if (given.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(given, expected)) return false;
  return Number(expiry) > Date.now();
}

function parseCookies(header) {
  const cookies = {};
  if (!header) return cookies;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    if (!key) continue;
    cookies[key] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return cookies;
}
