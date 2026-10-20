// GET /api/gift-plan?slug=...: the free plan (menu + workout) the CRM generator builds for this profile.
// The slug holds no personal details (sex, goal, gym, height, weight, age), so the answer is cached at the edge per slug.
import { send, forward } from './_lib.js';

const SLUG_RE = /^(man|woman)-(weight-loss|mass)(-no-gym)?-\d{3}-\d{2,3}-\d{2}$/;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('allow', 'GET');
    return send(res, 405, { error: 'method_not_allowed' });
  }
  const slug = String(new URL(req.url, 'http://x').searchParams.get('slug') || '');
  if (!SLUG_RE.test(slug)) return send(res, 400, { error: 'invalid_slug' });
  if (!process.env.API_BASE_URL || !process.env.API_KEY) return send(res, 500, { error: 'server_misconfigured' });
  try {
    const { status, body } = await forward('/api/landing/gift/plan', { slug }, 45000);
    if (status !== 200 || body?.ok !== true) {
      console.error(`[gift-plan] upstream answered ${status}`);
      return send(res, 502, { error: 'plan_unavailable' });
    }
    const complete = Boolean(body.menu && body.workout);
    res.statusCode = 200;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('cache-control', complete ? 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400' : 'no-store');
    res.end(JSON.stringify({ ok: true, targets: body.targets, menu: body.menu, workout: body.workout }));
  } catch (err) {
    console.error(`[gift-plan] upstream unreachable: ${err?.name || 'Error'}`);
    return send(res, 502, { error: 'plan_unavailable' });
  }
}
