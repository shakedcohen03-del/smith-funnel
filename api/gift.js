// POST /api/gift: the "free gift" funnel (gift.yachadsmith.com/gift). stage=quiz creates the lead in the CRM
// (source "מתנה חינמית") and the CRM sends the WhatsApp link to the plan page; stage=call adds the call request.
// Same server-to-server flow as /api/lead: the browser never sees the CRM address or key (./_lib.js).
import { proxy, clip, param, normalizeIsraeliMobile } from './_lib.js';

const SLUG_RE = /^(man|woman)-(weight-loss|mass)(-no-gym)?-\d{3}-\d{2,3}-\d{2}$/;
const QUIZ_KEYS = ['gender', 'goal', 'gym', 'height', 'weight', 'age', 'status', 'why'];
const CALL_KEYS = ['tried', 'now'];
const TRACKING_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'ref'];

function pick(raw, keys, max) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const out = {};
  for (const k of keys) {
    const v = max === 'param' ? param(src[k], 300) : clip(src[k], 600);
    if (v) out[k] = v;
  }
  return out;
}

function buildGift(body) {
  const stage = body.stage === 'call' ? 'call' : body.stage === 'quiz' ? 'quiz' : null;
  if (!stage) return { error: 'invalid_stage' };
  const name = clip(body.name, 80);
  if (name.length < 2) return { error: 'invalid_name' };
  const phone = normalizeIsraeliMobile(body.phone);
  if (!phone) return { error: 'invalid_phone' };
  const payload = { stage, name, phone, tracking: pick(body.tracking, TRACKING_KEYS, 'param') };
  if (stage === 'quiz') {
    payload.quiz = pick(body.quiz, QUIZ_KEYS);
    const slug = clip(body.plan_slug, 60);
    if (SLUG_RE.test(slug)) payload.plan_slug = slug;
  } else {
    payload.call = pick(body.call, CALL_KEYS);
  }
  return { payload };
}

export default async function handler(req, res) {
  return proxy(req, res, { name: 'gift', path: '/api/landing/gift', honeypot: true, rateMax: 20, build: buildGift });
}
