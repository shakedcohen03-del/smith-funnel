// GET /api/gift-pdf?slug=<man|woman>-<weight-loss|mass>[-no-gym]-<height>-<weight>-<age>: the free menu PDF (SMITHFIT
// copy of Niro's DIY menu, built by smith-quiz/pdf/build.mjs) with the person's daily calories stamped into the empty
// slot on the cover. Same formula as the CRM (src/lib/landing-gift-plan.ts giftTargets): Mifflin x1.375, cut -25%
// (floor 1500 men / 1200 women), mass +20%. No personal data leaves the slug, so the answer is cached per slug.
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

const SLUG_RE = /^(man|woman)-(weight-loss|mass)(-no-gym)?-(\d{3})-(\d{2,3})-(\d{2})$/;

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

export default async function handler(req, res) {
  const m = String(new URL(req.url, 'http://x').searchParams.get('slug') || '').match(SLUG_RE);
  const [h, w, a] = m ? [m[4], m[5], m[6]].map(Number) : [];
  if (!m || h < 130 || h > 230 || w < 35 || w > 250 || a < 14 || a > 90) {
    res.statusCode = 400;
    return res.end('invalid link');
  }
  const male = m[1] === 'man', cut = m[2] === 'weight-loss';
  try {
    const origin = `https://${req.headers.host}`;
    const name = `menu-${m[1]}-${cut ? 'cut' : 'mass'}`;
    const [pdf, font, slot] = await Promise.all([
      asset(origin, `/gift/assets/pdf/${name}.pdf`), asset(origin, '/gift/assets/pdf/rubik-900.ttf'), asset(origin, '/gift/assets/pdf/menu-stamp.json'),
    ]);
    const doc = await PDFDocument.load(pdf);
    doc.registerFontkit(fontkit);
    const f = await doc.embedFont(font, { subset: true });
    const text = dailyCalories(male, cut, h, w, a).toLocaleString('en-US');
    const size = slot.h * 1.05;
    const width = f.widthOfTextAtSize(text, size);
    doc.getPage(slot.page).drawText(text, {
      x: slot.x + (slot.w - width) / 2, y: slot.y + (slot.h - size * 0.72) / 2, size, font: f, color: rgb(2 / 255, 28 / 255, 66 / 255),
    });
    const out = await doc.save();
    res.statusCode = 200;
    res.setHeader('content-type', 'application/pdf');
    res.setHeader('content-disposition', `inline; filename="smithfit-${name}.pdf"`);
    res.setHeader('cache-control', 'public, max-age=86400, s-maxage=2592000');
    res.end(Buffer.from(out));
  } catch (err) {
    console.error(`[gift-pdf] ${err?.message || err}`);
    res.statusCode = 502;
    res.end('the menu is not available right now, try again in a minute');
  }
}
