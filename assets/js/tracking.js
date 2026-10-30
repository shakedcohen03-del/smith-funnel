// מעקב לממומן: פרמטרים מהכתובת, עוגיות של מטא, ופיקסל. הכל בזיכרון בלבד (בלי localStorage).
const PIXEL_ID = "1368937164234363";
const KEYS = ["ref", "ad_id", "adset_id", "campaign_id", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "placement", "site_source_name"];
const firstSeen = Date.now();

// מאקרו של מטא שלא הוחלף ({{ad.id}}) הוא זבל, לא ערך
const clean = (v) => {
  const s = (v || "").trim();
  return s && !/^\{\{.*\}\}$/.test(s) ? s.slice(0, 200) : null;
};
const params = (() => {
  const p = new URLSearchParams(location.search);
  const out = {};
  for (const k of KEYS) {
    const v = clean(p.get(k));
    if (v) out[k] = v;
  }
  return out;
})();

const digitsOnly = (v) => (v && /^\d{6,25}$/.test(v) ? v : undefined);
const cookie = (n) => {
  const c = document.cookie.split("; ").find((x) => x.startsWith(n + "="));
  return c ? decodeURIComponent(c.slice(n.length + 1)) : null;
};

/** שדות הייחוס לליד: ref ומזהי מטא ברמה העליונה, השאר בתוך tracking */
export function attribution() {
  return {
    ref: params.ref,
    ad_id: digitsOnly(params.ad_id),
    adset_id: digitsOnly(params.adset_id),
    campaign_id: digitsOnly(params.campaign_id),
  };
}

export function tracking(extra) {
  const id = params.fbclid;
  const c = cookie("_fbc");
  const fbc = id ? (c && c.endsWith("." + id) ? c : `fb.1.${firstSeen}.${id}`) : c;
  const t = {
    fbclid: id,
    fbc: fbc || undefined,
    fbp: cookie("_fbp") || undefined,
    utm_source: params.utm_source,
    utm_medium: params.utm_medium,
    utm_campaign: params.utm_campaign,
    utm_content: params.utm_content,
    utm_term: params.utm_term,
    placement: params.placement,
    site_source_name: params.site_source_name,
    landing_url: (location.origin + location.pathname + location.search).slice(0, 300),
    ...extra,
  };
  for (const k of Object.keys(t)) if (t[k] == null || t[k] === "") delete t[k];
  return t;
}

// בתצוגה מקומית הפיקסל כבוי, כדי לא ללכלך את הדאטה של הקמפיינים
const local = location.protocol === "file:" || /^(localhost|127\.|0\.0\.0\.0|\[::1\]|192\.168\.)/.test(location.hostname);
export const pixelOn = !local;

// בדף הנחיתה הפיקסל נטען כבר ב-<head> (הקוד הרגיל של מטא), ואז זה לא עושה כלום. נשאר לדפים בלי הקוד הזה
export function pixelBoot() {
  if (!pixelOn || window.fbq) return;
  const n = (window.fbq = function () {
    n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
  });
  if (!window._fbq) window._fbq = n;
  n.push = n;
  n.loaded = true;
  n.version = "2.0";
  n.queue = [];
  // השאלון משתמש ב-pushState לכפתור חזרה: בלי זה כל שלב נספר כ-PageView
  n.disablePushState = true;
  // בלי האירועים האוטומטיים של מטא: אחרת כל לחיצה על תשובה בשאלון נשלחת למטא כ-SubscribedButtonClick עם הטקסט של הכפתור.
  // חייב לבוא לפני init. ה-init השני ב-pixelLead לא מחזיר אותם
  window.fbq("set", "autoConfig", false, PIXEL_ID);
  window.fbq("init", PIXEL_ID);
  window.fbq("track", "PageView");
  const load = () => {
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(s);
  };
  if (document.readyState === "complete") setTimeout(load, 300);
  else addEventListener("load", () => setTimeout(load, 300), { once: true });
}

// Lead אחד לביקור: מי שהשאיר פרטים וגם לחץ על הוואטסאפ הוא ליד אחד
let leadSent = false;
let whatsappSent = false;

export function pixelLead(user, eventID) {
  if (!pixelOn || !window.fbq) return;
  const [fn, ...rest] = (user.name || "").trim().toLowerCase().split(/\s+/);
  const am = { country: "il" };
  if (user.email) am.em = user.email.trim().toLowerCase();
  if (user.phone) am.ph = "972" + user.phone.replace(/\D/g, "").replace(/^0/, "");
  if (fn) am.fn = fn;
  if (rest.length) am.ln = rest.join(" ");
  window.fbq("init", PIXEL_ID, am);
  window.fbq("track", "Lead", {}, { eventID });
  leadSent = true;
}

// לחיצה על כפתור הוואטסאפ: Lead, כי על זה הקמפיינים מתאפטמים (Contact תפוס: ה-CRM שולח אותו על שיחת מכירה שהתקיימה),
// ובנוסף WhatsAppClick, כדי שב-Events Manager יראו כמה לחצו
export function pixelWhatsApp() {
  if (!pixelOn || !window.fbq || whatsappSent) return;
  whatsappSent = true;
  if (!leadSent) window.fbq("track", "Lead", { content_name: "whatsapp_click" });
  leadSent = true;
  window.fbq("trackCustom", "WhatsAppClick");
}

export function pixelComplete(eventID) {
  if (!pixelOn || !window.fbq) return;
  window.fbq("track", "CompleteRegistration", {}, { eventID });
}

export function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
