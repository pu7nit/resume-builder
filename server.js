import http from 'node:http';
import path from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  isAuthEnabled,
  isAuthorized,
  verifyPassword,
  sessionCookie,
  clearCookie,
} from './src/auth.js';
import {
  initDb,
  closeDb,
  listResumes,
  getResume,
  createResume,
  duplicateResume,
  updateResume,
  deleteResume,
} from './src/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'resume-builder.db');

initDb(DB_FILE);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
};

/* ------------------------------- helpers -------------------------------- */

function sendJson(res, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  res.end(body);
}

function sendText(res, status, text) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(text);
}

async function sendFile(res, relativePath) {
  // Normalise to a path *inside* public/: on Windows a leading slash would
  // otherwise resolve against the drive root (C:\index.html).
  const relative = String(relativePath).replace(/^[/\\]+/, '');
  if (!relative || relative.includes('\0')) return false;

  const target = path.resolve(PUBLIC_DIR, relative);
  if (!target.startsWith(PUBLIC_DIR + path.sep)) return false;

  try {
    const info = await stat(target);
    if (!info.isFile()) return false;
    const body = await readFile(target);
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream',
      'Content-Length': body.length,
      'Cache-Control': 'no-cache',
    });
    res.end(body);
    return true;
  } catch {
    return false;
  }
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1024 * 1024) {
      throw Object.assign(new Error('Payload too large'), { status: 413 });
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('Invalid JSON body'), { status: 400 });
  }
}

function applySecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "img-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self'",
      "font-src 'self'",
      "connect-src 'self'",
      "base-uri 'none'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; ')
  );
}

/** Cheap CSRF guard: browsers send Origin on state-changing requests. */
function isSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

/* ----------------------------- login limiter ----------------------------- */

const FAILURE_LIMIT = 5;
const LOCKOUT_MS = 60_000;
const attempts = new Map();

function lockRemainingMs(ip) {
  const entry = attempts.get(ip);
  if (!entry) return 0;
  const remaining = entry.until - Date.now();
  return remaining > 0 ? remaining : 0;
}

function noteFailure(ip) {
  const entry = attempts.get(ip) || { count: 0, until: 0 };
  entry.count += 1;
  if (entry.count >= FAILURE_LIMIT) {
    entry.count = 0;
    entry.until = Date.now() + LOCKOUT_MS;
  }
  attempts.set(ip, entry);
}

/* -------------------------------- API ----------------------------------- */

const RESUME_ID = /^[A-Za-z0-9-]{8,64}$/;

async function handleApi(req, res, pathname) {
  const ip = req.socket.remoteAddress || 'unknown';

  if (pathname === '/api/session' && req.method === 'GET') {
    return sendJson(res, 200, { authEnabled: isAuthEnabled(), authenticated: isAuthorized(req) });
  }

  if (pathname === '/api/login' && req.method === 'POST') {
    if (!isAuthEnabled()) return sendJson(res, 200, { ok: true });
    if (!isSameOrigin(req)) return sendJson(res, 403, { error: 'Cross-origin request refused' });

    const locked = lockRemainingMs(ip);
    if (locked) {
      return sendJson(res, 429, { error: `Too many attempts. Try again in ${Math.ceil(locked / 1000)}s.` });
    }

    const body = await readJson(req);
    if (!verifyPassword(body.password)) {
      noteFailure(ip);
      return sendJson(res, 401, { error: 'Incorrect password' });
    }
    attempts.delete(ip);
    return sendJson(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie() });
  }

  if (pathname === '/api/logout' && req.method === 'POST') {
    return sendJson(res, 200, { ok: true }, { 'Set-Cookie': clearCookie() });
  }

  if (!isAuthorized(req)) {
    return sendJson(res, 401, { error: 'Unauthorized' });
  }

  if (req.method !== 'GET' && !isSameOrigin(req)) {
    return sendJson(res, 403, { error: 'Cross-origin request refused' });
  }

  if (pathname === '/api/resumes' && req.method === 'GET') {
    return sendJson(res, 200, { resumes: listResumes() });
  }

  if (pathname === '/api/resumes' && req.method === 'POST') {
    const body = await readJson(req);

    if (body.fromId) {
      if (!RESUME_ID.test(String(body.fromId))) return sendJson(res, 400, { error: 'Invalid resume id' });
      const copy = duplicateResume(body.fromId);
      if (!copy) return sendJson(res, 404, { error: 'Resume not found' });
      return sendJson(res, 201, { resume: copy });
    }

    const created = createResume({
      title: cleanTitle(body.title) || 'Untitled resume',
      data: isObject(body.data) ? body.data : undefined,
      settings: isObject(body.settings) ? body.settings : undefined,
    });
    return sendJson(res, 201, { resume: created });
  }

  const match = pathname.match(/^\/api\/resumes\/([^/]+)$/);
  if (match) {
    const id = match[1];
    if (!RESUME_ID.test(id)) return sendJson(res, 400, { error: 'Invalid resume id' });

    if (req.method === 'GET') {
      const resume = getResume(id);
      return resume ? sendJson(res, 200, { resume }) : sendJson(res, 404, { error: 'Resume not found' });
    }

    if (req.method === 'PUT' || req.method === 'PATCH') {
      const body = await readJson(req);
      const resume = updateResume(id, {
        title: typeof body.title === 'string' ? cleanTitle(body.title) : undefined,
        data: isObject(body.data) ? body.data : undefined,
        settings: isObject(body.settings) ? body.settings : undefined,
      });
      return resume ? sendJson(res, 200, { resume }) : sendJson(res, 404, { error: 'Resume not found' });
    }

    if (req.method === 'DELETE') {
      const removed = deleteResume(id);
      return removed ? sendJson(res, 200, { ok: true }) : sendJson(res, 404, { error: 'Resume not found' });
    }

    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  return sendJson(res, 404, { error: 'Not found' });
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cleanTitle(title) {
  return String(title ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
}

/* ------------------------------- static --------------------------------- */

async function handleStatic(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return sendText(res, 405, 'Method not allowed');
  }

  if (isAuthEnabled() && !isAuthorized(req)) {
    const wantsPage =
      pathname === '/' ||
      pathname.endsWith('.html') ||
      (req.headers.accept || '').includes('text/html');
    if (wantsPage && (await sendFile(res, 'login.html'))) return;
    return sendText(res, 401, 'Unauthorized');
  }

  const requested = pathname === '/' ? 'index.html' : pathname;
  if (await sendFile(res, requested)) return;

  return sendText(res, 404, 'Not found');
}

/* ------------------------------- server --------------------------------- */

const server = http.createServer(async (req, res) => {
  let pathname = '/';
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return sendText(res, 400, 'Bad request');
  }

  applySecurityHeaders(res);

  try {
    if (pathname === '/healthz') {
      return sendJson(res, 200, { ok: true, uptime: Math.round(process.uptime()) });
    }
    if (pathname.startsWith('/api/')) {
      return await handleApi(req, res, pathname);
    }
    return await handleStatic(req, res, pathname);
  } catch (err) {
    const status = Number(err?.status) || 500;
    if (status >= 500) console.error('[error]', req.method, pathname, err);
    if (!res.headersSent) {
      sendJson(res, status, { error: status >= 500 ? 'Internal server error' : err.message });
    } else {
      res.end();
    }
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[resume-builder] listening on http://localhost:${PORT}`);
  console.log(`[resume-builder] database: ${DB_FILE}`);
  console.log(
    `[resume-builder] password ${isAuthEnabled() ? 'required (APP_PASSWORD is set)' : 'not set — open access'}`
  );
});

function shutdown(signal) {
  console.log(`\n[resume-builder] ${signal} received, shutting down`);
  server.close(() => {
    closeDb();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
