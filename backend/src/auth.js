import crypto from 'node:crypto';

const SECRET = process.env.NEXO_SECRET || 'dev-secret-change-me';
const COOKIE_NAME = 'nexo_session';

// Password hashing (scrypt)
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored) return false;
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(test, 'hex'));
}

// Signed cookie: base64(payload).hmac
function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${mac}`;
}

function verify(token) {
  if (!token || !token.includes('.')) return null;
  const [body, mac] = token.split('.');
  const expected = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  if (mac.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// Parse cookie header
function parseCookies(header) {
  const out = {};
  (header || '').split(';').forEach(p => {
    const [k, ...v] = p.trim().split('=');
    if (k) out[k] = decodeURIComponent(v.join('='));
  });
  return out;
}

export function sessionMiddleware(req, res, next) {
  const cookies = parseCookies(req.headers.cookie);
  const payload = verify(cookies[COOKIE_NAME]);
  req.userId = payload?.userId || null;
  next();
}

export function setSessionCookie(res, userId) {
  const token = sign({ userId, exp: Date.now() + 7 * 24 * 3600 * 1000 });
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${7 * 24 * 3600}; SameSite=Lax`
  );
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
}

export function requireAuth(req, res, next) {
  if (!req.userId) return res.status(401).json({ error: 'unauthorized' });
  next();
}
