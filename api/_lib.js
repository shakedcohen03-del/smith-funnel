// Shared code for /api/lead and /api/quiz. Vercel does not turn "_" files into functions.
// The browser only ever talks to this site. These functions call the upstream server to server
// and hand back nothing but {ok} or a known error code: no upstream text, status or address.

export const BODY_LIMIT = 32 * 1024;
export const UPSTREAM_TIMEOUT_MS = 8000;
const RATE_MAX = 12;
const RATE_WINDOW_MS = 60_000;

// Validation codes the upstream may answer with; passed to the browser as is
const UPSTREAM_CODES = new Set(['invalid_name', 'invalid_phone', 'invalid_email', 'invalid_session']);

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const MACRO_RE = /^\{\{.*\}\}$/;

class HttpError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

export function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

function parseJsonText(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new HttpError(400, 'invalid_body');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new HttpError(400, 'invalid_body');
  return data;
}

// Vercel's Node helpers may read the stream before the handler runs and expose req.body instead
function preParsedBody(req, limit) {
  let body;
  try {
    body = req.body;
  } catch {
    throw new HttpError(400, 'invalid_body');
  }
  if (body === undefined || body === null) return undefined;
  const text = typeof body === 'string' ? body : Buffer.isBuffer(body) ? body.toString('utf8') : JSON.stringify(body);
  if (Buffer.byteLength(text) > limit) throw new HttpError(413, 'payload_too_large');
  return parseJsonText(text);
}

export async function readJson(req, limit = BODY_LIMIT) {
  const pre = preParsedBody(req, limit);
  if (pre !== undefined) return pre;
  if (Number(req.headers['content-length'] || 0) > limit) throw new HttpError(413, 'payload_too_large');
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buf.length;
    if (size > limit) throw new HttpError(413, 'payload_too_large');
    chunks.push(buf);
  }
  return parseJsonText(Buffer.concat(chunks).toString('utf8'));
}

export const clip = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// Free text param from the ad URL: trimmed, clipped, unreplaced {{macro}} dropped
export function param(v, max) {
  const s = clip(v, max);
  return s && !MACRO_RE.test(s) ? s : '';
}

// Meta ids stay strings (18 digits do not fit a JS number)
export function metaId(v) {
  const s = clip(v, 30);
  return /^\d{6,25}$/.test(s) ? s : '';
}

const firstHop = (v) => String(v || '').split(',')[0].trim();

export function clientIp(req) {
  const h = req.headers;
  const ip = firstHop(h['x-vercel-forwarded-for']) || firstHop(h['x-forwarded-for']) || firstHop(h['x-real-ip']) || req.socket?.remoteAddress || '';
  return /^[0-9a-fA-F:.]{2,64}$/.test(ip) ? ip : '';
}

export const userAgent = (req) => clip(req.headers['user-agent'], 512);

// Best effort: memory lives per function instance, so this only stops a single noisy client
const hits = new Map();
// A refused request is not counted: a client that retries while limited does not extend its own block
export function rateLimited(key, max = RATE_MAX, now = Date.now()) {
  const recent = (hits.get(key) || []).filter((t) => now - t < RATE_WINDOW_MS);
  const limited = recent.length >= max;
  if (!limited) recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return limited;
}

export const honeypotFilled = (body) => String(body.website ?? '').trim() !== '';

// Same rules as the CRM: accepts 05X, +972 5X, +972 05X, 00972..., returns 05XXXXXXXX or null
export function normalizeIsraeliMobile(raw) {
  let digits = String(raw ?? '').replace(/\D/g, '');
  digits = digits.replace(/^0{0,2}972/, '972');
  if (digits.startsWith('972')) digits = '0' + digits.slice(3).replace(/^0+/, '');
  return /^05\d{8}$/.test(digits) ? digits : null;
}

export const sessionOf = (v) => {
  const s = clip(v, 64).toLowerCase();
  return UUID_V4_RE.test(s) ? s : '';
};

// [{id, q, a}] where a is a string or (multi select) an array of strings. null when not an array
export function parseAnswers(raw) {
  if (!Array.isArray(raw)) return null;
  const out = [];
  for (const item of raw.slice(0, 12)) {
    if (!item || typeof item !== 'object') continue;
    const id = clip(item.id, 40);
    const q = clip(item.q, 200);
    const a = Array.isArray(item.a) ? item.a.map((x) => clip(x, 200)).filter(Boolean).slice(0, 12) : clip(item.a, 600);
    if (id && q && a.length) out.push({ id, q, a });
  }
  return out;
}

function upstream() {
  const base = (process.env.API_BASE_URL || '').trim().replace(/\/+$/, '');
  const key = (process.env.API_KEY || '').trim();
  return base && key ? { base, key } : null;
}

export async function forward(path, payload, timeoutMs = UPSTREAM_TIMEOUT_MS) {
  const { base, key } = upstream() || {};
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(base + path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-landing-key': key },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
      redirect: 'error', // never replay the key to another address
    });
    const body = await res.json().catch(() => null);
    return { status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

export function sanitize({ status, body }) {
  if (status >= 200 && status < 300 && body?.ok === true) return [200, { ok: true }];
  if (status === 400 && UPSTREAM_CODES.has(body?.error)) return [400, { error: body.error }];
  return [502, { error: 'upstream_unavailable' }];
}

function previewLog(name, payload) {
  const shown = { ...payload };
  if (shown.phone) shown.phone = shown.phone.slice(0, 3) + '*****' + shown.phone.slice(-2);
  if (shown.email) shown.email = shown.email.replace(/^([^@]{0,2})[^@]*@/, '$1***@');
  console.log(`[preview] ${name} ${JSON.stringify(shown)}`);
}

async function deliver(res, name, path, payload) {
  if (!upstream()) {
    if (process.env.VERCEL) {
      console.error(`[${name}] API_BASE_URL or API_KEY is missing`);
      return send(res, 500, { error: 'server_misconfigured' });
    }
    previewLog(name, payload);
    return send(res, 200, { ok: true, preview: true });
  }
  const dryRun = process.env.DRY_RUN === '1' && !process.env.VERCEL;
  if (dryRun) payload = { ...payload, dry_run: true };
  let result;
  try {
    result = await forward(path, payload);
  } catch (err) {
    console.error(`[${name}] upstream unreachable: ${err?.name || 'Error'} ${err?.cause?.code || ''}`.trim());
    return send(res, 502, { error: 'upstream_unavailable' });
  }
  const [status, body] = sanitize(result);
  if (status === 502) console.error(`[${name}] upstream answered ${result.status}`);
  if (dryRun) console.log(`[dry-run] ${name} ${result.status} ${JSON.stringify(result.body)}`);
  return send(res, status, body);
}

// The whole request flow shared by both endpoints. build(body, req) returns {error} or {payload}
export async function proxy(req, res, { name, path, honeypot = false, rateMax = RATE_MAX, build }) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('allow', 'POST');
      return send(res, 405, { error: 'method_not_allowed' });
    }
    if (rateLimited(`${name}:${clientIp(req)}`, rateMax)) {
      res.setHeader('retry-after', '60');
      return send(res, 429, { error: 'rate_limited' });
    }
    const body = await readJson(req);
    if (honeypot && honeypotFilled(body)) return send(res, 200, { ok: true });
    const built = build(body, req);
    if (built.error) return send(res, 400, { error: built.error });
    return await deliver(res, name, path, built.payload);
  } catch (err) {
    if (err instanceof HttpError) return send(res, err.status, { error: err.code });
    console.error(`[${name}] unexpected ${err?.name || 'Error'}`);
    return send(res, 500, { error: 'server_error' });
  }
}
