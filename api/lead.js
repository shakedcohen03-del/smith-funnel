// POST /api/lead: the details step (name, phone, email). Creates the lead upstream right away.
import { proxy, clip, param, metaId, sessionOf, normalizeIsraeliMobile, EMAIL_RE, clientIp, userAgent } from './_lib.js';

const QUIZ_TOTAL = 8;
const TRACKING_KEYS = [
  'fbclid', 'fbc', 'fbp',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
  'placement', 'site_source_name', 'landing_url', 'lead_event_id',
];

function trackingOf(raw, req) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const out = {};
  for (const key of TRACKING_KEYS) {
    const v = param(src[key], 1000);
    if (v) out[key] = v;
  }
  // Only the server knows these; whatever the browser sent under these names is ignored
  const ip = clientIp(req);
  const ua = userAgent(req);
  if (ip) out.client_ip_address = ip;
  if (ua) out.client_user_agent = ua;
  return out;
}

function buildLead(body, req) {
  const name = clip(body.name, 80);
  if (name.length < 2) return { error: 'invalid_name' };
  const phone = normalizeIsraeliMobile(body.phone);
  if (!phone) return { error: 'invalid_phone' };
  const email = clip(body.email, 120).toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: 'invalid_email' };
  const session = sessionOf(body.session);
  if (!session) return { error: 'invalid_session' };

  const consent = body.marketing_consent === true;
  const payload = {
    session,
    name,
    phone,
    email,
    marketing_consent: consent,
    consent_text: consent ? clip(body.consent_text, 500) || null : null,
    total: QUIZ_TOTAL,
  };
  const ref = param(body.ref, 200);
  if (ref) payload.ref = ref;
  for (const key of ['ad_id', 'adset_id', 'campaign_id']) {
    const id = metaId(body[key]);
    if (id) payload[key] = id;
  }
  payload.tracking = trackingOf(body.tracking, req);
  return { payload };
}

export default async function handler(req, res) {
  return proxy(req, res, { name: 'lead', path: '/api/landing/lead', honeypot: true, build: buildLead });
}
