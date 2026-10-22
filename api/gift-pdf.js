// GET /api/gift-pdf?slug=<man|woman>-<weight-loss|mass>[-no-gym]-<height>-<weight>-<age>[&kind=training][&t=<token>]
// The free plan PDFs (SMITHFIT copy of Niro's DIY decks, built by smith-quiz/pdf/build.mjs).
// kind=menu (default): the menu with the person's daily calories stamped into the empty slot on the cover. Same formula
// as the CRM (src/lib/landing-gift-plan.ts giftTargets): Mifflin x1.375, cut -25% (floor 1500 men / 1200 women), mass +20%.
// kind=training: the full-body plan for the person's sex and place (gym / home).
// t: the lead's token from the WhatsApp link; the CRM notes the first open of each PDF on the lead's card (owner 21.10).
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { forward } from './_lib.js';

const SLUG_RE = /^(man|woman)-(weight-loss|mass)(-no-gym)?-(\d{3})-(\d{2,3})-(\d{2})$/;
const TOKEN_RE = /^[a-z0-9]{10}$/;

function dailyCalories(male, cut, h, w, a) {
  const tdee = (10 * w + 6.25 * h - 5 * a + (male ? 5 : -161)) * 1.375;
  const raw = cut ? Math.max(tdee * 0.75, male ? 1500 : 1200) : tdee * 1.2;
  return Math.round(raw / 10) * 10;
}

async function asset(origin, path) {
  const r = await fetch(origin + path);
  if (!r.ok) throw new Error(`${path} ${r.status}`);
  return path.endsWith('.json') ? r.json() : new Uint8Array(await r.arrayBuffer());
}

async function stampedMenu(origin, name, calories) {
  const [pdf, font, slot] = await Promise.all([
    asset(origin, `/gift/assets/pdf/${name}.pdf`), asset(origin, '/gift/assets/pdf/rubik-900.ttf'), asset(origin, '/gift/assets/pdf/menu-stamp.json'),
  ]);
  const doc = await PDFDocument.load(pdf);
  doc.registerFontkit(fontkit);
  const f = await doc.embedFont(font, { subset: true });
  const text = calories.toLocaleString('en-US');
  const size = slot.h * 1.05;
  const width = f.widthOfTextAtSize(text, size);
  doc.getPage(slot.page).drawText(text, {
    x: slot.x + (slot.w - width) / 2, y: slot.y + (slot.h - size * 0.72) / 2, size, font: f, color: rgb(2 / 255, 28 / 255, 66 / 255),
  });
  return doc.save();
}

export default async function handler(req, res) {
  const q = new URL(req.url, 'http://x').searchParams;
  const m = String(q.get('slug') || '').match(SLUG_RE);
  const [h, w, a] = m ? [m[4], m[5], m[6]].map(Number) : [];
  const kind = q.get('kind') === 'training' ? 'training' : 'menu';
  if (!m || h < 130 || h > 230 || w < 35 || w > 250 || a < 14 || a > 90) {
    res.statusCode = 400;
    return res.end('invalid link');
  }
  const male = m[1] === 'man', cut = m[2] === 'weight-loss';
  const token = String(q.get('t') || '');
  try {
    const origin = `https://${req.headers.host}`;
    const name = kind === 'menu' ? `menu-${m[1]}-${cut ? 'cut' : 'mass'}` : `training-${m[1]}-${m[3] ? 'home' : 'gym'}`;
    const [out] = await Promise.all([
      kind === 'menu' ? stampedMenu(origin, name, dailyCalories(male, cut, h, w, a)) : asset(origin, `/gift/assets/pdf/${name}.pdf`),
      // the open is noted on the lead's card (first time only); a CRM hiccup never blocks the PDF
      TOKEN_RE.test(token) && process.env.API_BASE_URL
        ? forward('/api/landing/gift/opened', { token, kind }, 5000).catch((e) => console.error(`[gift-pdf] open note: ${e?.name || e}`))
        : null,
    ]);
    res.statusCode = 200;
    res.setHeader('content-type', 'application/pdf');
    res.setHeader('content-disposition', `inline; filename="smithfit-${name}.pdf"`);
    // a link with a token belongs to one lead: the browser may keep it, the CDN must not (each open has to reach us)
    res.setHeader('cache-control', token ? 'private, max-age=3600' : 'public, max-age=86400, s-maxage=2592000');
    res.end(Buffer.from(out));
  } catch (err) {
    console.error(`[gift-pdf] ${err?.message || err}`);
    res.statusCode = 502;
    res.end('the plan is not available right now, try again in a minute');
  }
}
