// השאלון של דף הנחיתה: פרטים (נוצר ליד ב-CRM) -> 8 שאלות (כל תשובה נשמרת מיד) -> מסך תודה.
// הדפדפן מדבר רק עם /api של האתר הזה. כל המצב בזיכרון בלבד.
// כל טריגר עם data-open-flow פותח את הדיאלוג. הטקסטים מגיעים מ-<script type="application/json" id="flow-copy">.
import { attribution, tracking, pixelBoot, pixelLead, pixelComplete, uuid } from "./tracking.js";

const C = JSON.parse(document.getElementById("flow-copy").textContent);
const D = C.details;
const Q = C.questions;
const T = C.thanks;
const DEF = { retry: "נסה שוב", close: "סגירה", back: "חזרה", skipped: "דילג על השאלה" };
const SKIP = C.skipped_answer || DEF.skipped;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = matchMedia("(pointer: fine)").matches;
// התקדמות מהירה בהתחלה ואיטית בסוף: פרטים, 8 שאלות, סיום
const PROGRESS = [0.06, 0.18, 0.3, 0.42, 0.52, 0.62, 0.71, 0.8, 0.9, 1, 1];
const FINISHING = Q.length + 1;
const THANKS = Q.length + 2;
const IG_URL = "https://www.instagram.com/mrsmith.fit/";

const S = {
  step: 0, session: null, visit: uuid(), leadKey: null, quizEventId: uuid(),
  answers: {}, name: "", phone: "", email: "", consent: false,
  busy: false, locked: false, done: false, ack: "",
};

const ICON = {
  back: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
  close: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  check: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  lock: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  ig: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>',
};

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const firstName = () => S.name.split(" ")[0] || "";
// {name} = שם פרטי, {pain} = התשובה לשאלה הראשונה
const pipe = (s) => String(s || "")
  .replace(/\{name\}/g, firstName())
  .replace(/\{(pain|Q1)\}/g, () => (typeof S.answers.pain === "string" ? S.answers.pain : ""))
  .replace(/\s*·\s*$/, "").replace(/:\s*$/, "").trim();

// ---------- טלפון ומייל ----------
export function normPhone(raw) {
  let d = String(raw || "").replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  if (d.startsWith("00972")) d = d.slice(5);
  else if (d.startsWith("972")) d = d.slice(3);
  if (d.startsWith("5") && d.length === 9) d = "0" + d;
  return d;
}
export const validPhone = (p) => /^05\d{8}$/.test(p);
export const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
const TYPO = {
  "gmial.com": "gmail.com", "gmai.com": "gmail.com", "gmail.co": "gmail.com", "gmail.co.il": "gmail.com", "gamil.com": "gmail.com",
  "gmal.com": "gmail.com", "gnail.com": "gmail.com", "hotmial.com": "hotmail.com", "hotmail.co": "hotmail.com", "hotmal.com": "hotmail.com",
  "walla.co": "walla.co.il", "walla.com": "walla.co.il", "wala.co.il": "walla.co.il", "yahoo.co": "yahoo.com", "outlok.com": "outlook.com",
};
const suggestEmail = (e) => {
  const at = e.lastIndexOf("@");
  if (at < 1) return null;
  const fix = TYPO[e.slice(at + 1)];
  return fix ? e.slice(0, at + 1) + fix : null;
};
const fmtPhone = (v) => {
  const p = normPhone(v);
  return validPhone(p) ? `${p.slice(0, 3)}-${p.slice(3)}` : v;
};

// ---------- רשת ----------
async function postJSON(url, data, ms) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  const json = JSON.stringify(data);
  try {
    const res = await fetch(url, {
      method: "POST", headers: { "content-type": "application/json" }, body: json,
      signal: ctl.signal, keepalive: json.length < 60000,
    });
    let b = null;
    try { b = await res.json(); } catch {}
    return { ok: res.ok && !!(b && b.ok), status: res.status, body: b };
  } finally {
    clearTimeout(t);
  }
}

// כל שמירה שולחת את כל מה שנענה עד עכשיו. שרשרת = סדר נשמר, האחרונה תמיד מנצחת.
// snapshot שכבר יש אחריו snapshot חדש יותר בתור מוותר לפני כל ניסיון: החדש מכיל את כל התשובות שלו
let chain = Promise.resolve(true);
let seq = 0;
const snapshot = () => Q.filter((q) => S.answers[q.id] !== undefined).map((q) => ({ id: q.id, q: q.q, a: S.answers[q.id] }));
async function sendWithRetry(body, my) {
  for (const wait of [0, 800, 2000, 4500]) {
    if (wait) await sleep(wait);
    if (my !== seq) return true;
    try {
      const r = await postJSON("/api/quiz", body, 9000);
      if (r.ok) return true;
      // 429: עוד ניסיון בתוך אותה דקה רק מאריך את החסימה
      if (r.status === 429) return false;
      if (r.status >= 400 && r.status < 500 && r.status !== 408) return false;
    } catch {}
  }
  return false;
}
function save(final) {
  if (!S.session) return Promise.resolve(false);
  const body = { session: S.session, answers: snapshot(), total: Q.length, completed: !!final };
  if (final) body.quiz_event_id = S.quizEventId;
  const my = ++seq;
  chain = chain.then(() => sendWithRetry(body, my));
  return chain;
}

// ---------- דיאלוג ----------
let dlg, body, fill, bar, count, backBtn, lastTrigger, rotate, ignorePop = false;

function build() {
  dlg = document.createElement("dialog");
  dlg.className = "f";
  dlg.setAttribute("aria-labelledby", "f-title");
  dlg.innerHTML = `
    <div class="f__frame">
      <header class="f__top">
        <button class="f__icon f__back" type="button" aria-label="${esc(C.back || DEF.back)}" hidden>${ICON.back}</button>
        <div class="f__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-label="${esc(C.progress_label || "התקדמות")}"><div class="f__fill"></div></div>
        <button class="f__icon f__close" type="button" aria-label="${esc(C.close || DEF.close)}">${ICON.close}</button>
      </header>
      <p class="f__count" aria-live="polite"></p>
      <div class="f__body"></div>
    </div>
    <canvas class="f__confetti" aria-hidden="true"></canvas>`;
  document.body.appendChild(dlg);
  body = dlg.querySelector(".f__body");
  fill = dlg.querySelector(".f__fill");
  bar = dlg.querySelector(".f__bar");
  count = dlg.querySelector(".f__count");
  backBtn = dlg.querySelector(".f__back");
  backBtn.addEventListener("click", back);
  dlg.querySelector(".f__close").addEventListener("click", close);
  dlg.addEventListener("cancel", (e) => { e.preventDefault(); close(); });
  body.addEventListener("click", onClick);
  body.addEventListener("input", onInput);
  body.addEventListener("submit", onSubmit);
  body.addEventListener("focusout", onBlur);
  body.addEventListener("keydown", onKey);
  render(S.step, 0);
}

export function open() {
  if (!dlg) build();
  if (dlg.open) return;
  dlg.showModal();
  document.documentElement.classList.add("f-open");
  history.pushState({ f: 1 }, "");
  if (S.step === 0 && finePointer) dlg.querySelector("#f-name")?.focus();
  else focusTitle();
}

function closeDialog() {
  clearInterval(rotate);
  dlg.close();
  document.documentElement.classList.remove("f-open");
  if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus({ preventScroll: true });
}

function close() {
  if (history.state && history.state.f) {
    ignorePop = true;
    history.back();
  }
  closeDialog();
}

// כפתור/מחוות חזרה של הטלפון: צעד אחורה בשאלון במקום לצאת מהדף
addEventListener("popstate", () => {
  if (ignorePop) { ignorePop = false; return; }
  if (!dlg || !dlg.open) return;
  // מסמך משפטי פתוח מעל השאלון: חזרה סוגרת רק אותו (בלי רשומת היסטוריה משלו, כדי שלא תיתקע אחת)
  const lg = document.querySelector("dialog.f-legal");
  if (lg && lg.open) { lg.close(); history.pushState({ f: 1 }, ""); return; }
  if (S.step === FINISHING || S.locked) { history.pushState({ f: 1 }, ""); return; }
  if (S.step > 0 && S.step <= Q.length) { back(); history.pushState({ f: 1 }, ""); return; }
  closeDialog();
});

function go(step, dir) {
  S.step = step;
  render(step, dir);
  focusTitle();
}

function back() {
  if (S.locked || S.step < 1 || S.step > Q.length) return;
  go(S.step - 1, -1);
}

function focusTitle() {
  const t = dlg.querySelector("#f-title");
  if (t) t.focus({ preventScroll: true });
  body.scrollTop = 0;
}

function render(step, dir) {
  clearInterval(rotate);
  const html = step === 0 ? detailsHTML() : step <= Q.length ? questionHTML(step - 1) : step === FINISHING ? finishingHTML() : thanksHTML();
  body.innerHTML = html;
  const el = body.firstElementChild;
  if (el && !reduce && dir) el.classList.add("f-in", dir < 0 ? "f-in--back" : "f-in--fwd");
  const p = PROGRESS[Math.min(step, PROGRESS.length - 1)];
  fill.style.transform = `scaleX(${p})`;
  bar.setAttribute("aria-valuenow", String(Math.round(p * 100)));
  backBtn.hidden = !(step > 0 && step <= Q.length);
  count.textContent = step > 0 && step <= Q.length ? C.progress.replace("{n}", step).replace("{total}", Q.length) : "";
  count.hidden = !count.textContent;
  dlg.dataset.step = step === 0 ? "details" : step <= Q.length ? "q" : step === FINISHING ? "finishing" : "thanks";
  if (step > 0 && step <= Q.length && Q[step - 1].type === "text") startRotate(Q[step - 1]);
  // נגיעה כפולה: הנגיעה השנייה נבלעת ולא עונה על שאלה שעוד לא נראתה
  S.guardUntil = performance.now() + 450;
}

// ---------- שלב 1: פרטים ----------
const field = (id, label, ph, attrs, extra = "") => `
  <div class="f__field">
    <label class="f__label" for="f-${id}">${esc(label)}</label>
    <input class="f__input" id="f-${id}" name="${id}" ${attrs} placeholder="${esc(ph || "")}" value="${esc(id === "phone" ? fmtPhone(S[id]) : S[id] || "")}" aria-describedby="f-${id}-err" required>
    <p class="f__err" id="f-${id}-err" hidden></p>${extra}
  </div>`;

function legalHTML() {
  const txt = esc(D.legal || "");
  const key = "מדיניות הפרטיות";
  return txt.includes(key) ? txt.replace(key, `<a href="/privacy" data-legal>${key}</a>`) : `${txt} <a href="/privacy" data-legal>${key}</a>`;
}

function detailsHTML() {
  return `<section class="f__step f__step--details">
    ${D.kicker ? `<p class="f__kicker">${esc(D.kicker)}</p>` : ""}
    <h2 class="f__title" id="f-title" tabindex="-1">${esc(D.title)}</h2>
    ${D.sub ? `<p class="f__sub">${esc(D.sub)}</p>` : ""}
    <form class="f__form" novalidate>
      ${field("name", D.name_label, D.name_ph, 'autocomplete="name" enterkeyhint="next" autocapitalize="words"')}
      ${field("phone", D.phone_label, D.phone_ph, 'type="tel" inputmode="tel" autocomplete="tel" enterkeyhint="next" dir="ltr"')}
      ${field("email", D.email_label, D.email_ph, 'type="email" inputmode="email" autocomplete="email" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go" dir="ltr"', '<button type="button" class="f__suggest" hidden></button>')}
      <div class="f__hp" aria-hidden="true"><label>Website <input name="website" tabindex="-1" autocomplete="off"></label></div>
      <label class="f__consent">
        <input type="checkbox" name="consent"${S.consent ? " checked" : ""}>
        <span class="f__box" aria-hidden="true">${ICON.check}</span>
        <span class="f__consent-text">${esc(D.consent)}</span>
      </label>
      <button class="f__btn" type="submit"><span class="f__btn-label">${esc(D.submit)}</span><span class="f__spin" aria-hidden="true"></span></button>
      <p class="f__formerr" role="alert" hidden></p>
      <p class="f__legal">${legalHTML()}</p>
      ${D.privacy_note ? `<p class="f__note">${ICON.lock}<span>${esc(D.privacy_note)}</span></p>` : ""}
    </form>
  </section>`;
}

function setErr(id, msg) {
  const inp = body.querySelector(`#f-${id}`);
  const e = body.querySelector(`#f-${id}-err`);
  if (!inp || !e) return;
  if (msg) {
    e.textContent = msg;
    e.hidden = false;
    inp.setAttribute("aria-invalid", "true");
    const f = inp.closest(".f__field");
    if (!reduce) { f.classList.remove("f-shake"); void f.offsetWidth; f.classList.add("f-shake"); }
  } else {
    e.hidden = true;
    inp.removeAttribute("aria-invalid");
  }
}

function formErr(msg) {
  const p = body.querySelector(".f__formerr");
  if (!p) return;
  p.textContent = msg || "";
  p.hidden = !msg;
}

function busy(on) {
  S.busy = on;
  const b = body.querySelector(".f__form .f__btn");
  if (b) { b.disabled = on; b.classList.toggle("is-busy", on); b.setAttribute("aria-busy", String(on)); }
}

async function onSubmit(e) {
  e.preventDefault();
  if (S.busy) return;
  const val = (n) => body.querySelector(`.f__form [name="${n}"]`);
  const name = val("name").value.trim().replace(/\s+/g, " ");
  const phone = normPhone(val("phone").value);
  const email = val("email").value.trim().toLowerCase();
  const errs = {
    name: name.length >= 2 ? "" : D.err_name,
    phone: validPhone(phone) ? "" : D.err_phone,
    email: validEmail(email) ? "" : D.err_email,
  };
  for (const k of Object.keys(errs)) setErr(k, errs[k]);
  formErr("");
  const firstBad = Object.keys(errs).find((k) => errs[k]);
  if (firstBad) { body.querySelector(`#f-${firstBad}`).focus(); return; }
  // שגיאת כתיב בדומיין שהמשתמש עוד לא ראה (גם Enter/Go): עוצרים פעם אחת ומראים את ההצעה.
  // לחיצה נוספת שולחת כמו שזה. הצ'יפ תופס מקום קבוע, אז שום דבר לא זז מתחת לאצבע
  const sug = suggestEmail(email);
  if (sug && S.sugStop !== email && !(S.sugFor === email && performance.now() - S.sugAt > 1000)) {
    S.sugStop = email;
    showSuggest(email, sug)?.focus({ preventScroll: true });
    return;
  }

  S.name = name; S.phone = phone; S.email = email; S.consent = val("consent").checked;
  const key = [name, phone, email, S.consent].join("|");
  if (S.leadKey === key) { document.activeElement?.blur(); go(1, 1); return; }

  busy(true);
  // מזהה אחד לכל ביקור: ניסיון חוזר ותיקון של הפרטים מגיעים ב-CRM לאותו ליד ולא נרשמים כליד קיים שחזר
  const session = S.visit;
  // גם אירוע ה-Lead אחד לכל ביקור: תיקון פרטים הוא אותו ליד, ולא Lead נוסף במטא
  const leadEventId = S.leadEventId || (S.leadEventId = uuid());
  const payload = {
    session, name, phone, email,
    marketing_consent: S.consent, consent_text: S.consent ? D.consent : null,
    website: val("website").value,
    ...attribution(),
    tracking: tracking({ lead_event_id: leadEventId }),
  };
  let r = null;
  try { r = await postJSON("/api/lead", payload, 12000); } catch {}
  busy(false);
  if (r && r.ok) {
    S.session = session;
    S.leadKey = key;
    if (!S.leadFired) { S.leadFired = true; pixelLead({ name, phone, email }, leadEventId); }
    // חזר לשלב הפרטים ותיקן אותם (אותו מזהה, ה-CRM מעדכן את הליד): התשובות שכבר ענה נשלחות שוב
    if (Object.keys(S.answers).length) save(false);
    document.activeElement?.blur();
    go(1, 1);
    return;
  }
  const code = r && r.body && r.body.error;
  if (r && r.status === 400 && /^invalid_(name|phone|email)$/.test(code || "")) {
    const id = code.slice(8);
    setErr(id, D["err_" + id]);
    body.querySelector(`#f-${id}`)?.focus();
  } else {
    formErr(D.err_generic);
  }
}

// הצעת תיקון למייל. הצ'יפ שמור במקום קבוע מתחת לשדה (visibility), כך שהופעה או היעלמות לא מזיזות את הטופס
function showSuggest(email, sug) {
  const b = body.querySelector(".f__suggest");
  if (!b) return null;
  if (!sug) { b.hidden = true; return null; }
  if (b.hidden || b.dataset.v !== sug) {
    b.textContent = (D.email_suggest || "התכוונת ל-{email}?").replace("{email}", sug);
    b.dataset.v = sug;
    b.hidden = false;
    S.sugFor = email;
    S.sugAt = performance.now();
  }
  return b;
}

function onBlur(e) {
  const t = e.target;
  if (t.id === "f-email") {
    const email = t.value.trim().toLowerCase();
    showSuggest(email, suggestEmail(email));
  }
  if (t.id === "f-phone" && t.value) t.value = fmtPhone(t.value);
}

// Enter בשם או בטלפון (גם "הבא" במקלדת של הטלפון) עובר לשדה הבא במקום לשלוח טופס חצי ריק
function onKey(e) {
  if (e.key !== "Enter" || e.isComposing) return;
  const next = { "f-name": "#f-phone", "f-phone": "#f-email" }[e.target.id];
  if (!next) return;
  e.preventDefault();
  body.querySelector(next)?.focus();
}

function onInput(e) {
  const t = e.target;
  if (t.matches(".f__input")) {
    if (t.getAttribute("aria-invalid")) setErr(t.name, "");
    formErr("");
  }
  if (t.id === "f-email") {
    const b = body.querySelector(".f__suggest");
    if (b && !b.hidden && suggestEmail(t.value.trim().toLowerCase()) !== b.dataset.v) b.hidden = true;
  }
  if (t.id === "f-text") {
    const btn = body.querySelector('[data-act="next"]');
    if (btn) btn.disabled = t.value.trim().length < 2;
    t.style.height = "auto";
    t.style.height = Math.min(t.scrollHeight + 2, 260) + "px";
  }
}

// ---------- שאלות ----------
function questionHTML(i) {
  const q = Q[i];
  const a = S.answers[q.id];
  const ack = S.ack ? `<p class="f__ack">${esc(S.ack)}</p>` : "";
  S.ack = "";
  let inner;
  if (q.type === "text") {
    const val = typeof a === "string" && a !== SKIP ? a : "";
    inner = `
      <textarea class="f__textarea" id="f-text" rows="3" maxlength="500" dir="auto" enterkeyhint="enter" placeholder="${esc((q.placeholders || [])[0] || "")}" aria-labelledby="f-title"${q.helper ? ' aria-describedby="f-helper"' : ""}>${esc(val)}</textarea>
      <div class="f__row">
        <button class="f__btn" type="button" data-act="next"${val.trim().length >= 2 ? "" : " disabled"}>${esc(C.next)}</button>
        <button class="f__skip" type="button" data-act="skip">${esc(C.skip)}</button>
      </div>`;
  } else {
    const multi = q.type === "multi";
    const sel = multi ? (Array.isArray(a) ? a : []) : a;
    const opts = q.options.map((o, k) => {
      const on = multi ? sel.includes(o) : sel === o;
      return `<button class="f__opt${on ? " is-on" : ""}" type="button" role="${multi ? "checkbox" : "radio"}" aria-checked="${on}" data-v="${esc(o)}" style="--i:${k}"><span class="f__mark" aria-hidden="true">${ICON.check}</span><span class="f__opt-label">${esc(o)}</span></button>`;
    }).join("");
    // בבחירה מרובה כפתור ההמשך דביק בתחתית, כך שהוא תמיד על המסך גם כשהרשימה ארוכה מהמסך
    inner = `<div class="f__opts${multi ? " f__opts--multi" : ""}" role="${multi ? "group" : "radiogroup"}" aria-labelledby="f-title">${opts}</div>
      ${multi ? `<div class="f__actions"><button class="f__btn" type="button" data-act="next"${sel.length ? "" : " disabled"}>${esc(C.next)}</button></div>` : ""}`;
  }
  return `<section class="f__step f__step--q" data-type="${q.type}" data-q="${esc(q.id)}">
    ${ack}
    ${q.kicker ? `<p class="f__kicker">${esc(pipe(q.kicker))}</p>` : ""}
    <h2 class="f__title" id="f-title" tabindex="-1">${esc(pipe(q.q))}</h2>
    ${q.helper ? `<p class="f__helper" id="f-helper">${esc(pipe(q.helper))}</p>` : ""}
    ${inner}
  </section>`;
}

function startRotate(q) {
  const ph = q.placeholders || [];
  if (ph.length < 2) return;
  let k = 0;
  rotate = setInterval(() => {
    const ta = body.querySelector("#f-text");
    if (!ta) return clearInterval(rotate);
    if (ta.value || document.activeElement === ta) return;
    k = (k + 1) % ph.length;
    ta.placeholder = ph[k];
  }, 3200);
}

function onClick(e) {
  const legal = e.target.closest("a[data-legal]");
  if (legal) { e.preventDefault(); return openLegal(legal.getAttribute("href")); }
  const sug = e.target.closest(".f__suggest");
  if (sug) {
    const inp = body.querySelector("#f-email");
    inp.value = sug.dataset.v;
    sug.hidden = true;
    setErr("email", "");
    return;
  }
  if (performance.now() < (S.guardUntil || 0)) return;
  const opt = e.target.closest(".f__opt");
  if (opt) return onOpt(opt);
  const act = e.target.closest("[data-act]");
  if (act) return onAct(act.dataset.act);
}

function onOpt(btn) {
  if (S.locked) return;
  const q = Q[S.step - 1];
  if (!q) return;
  const v = btn.dataset.v;
  if (q.type === "multi") {
    const cur = new Set(Array.isArray(S.answers[q.id]) ? S.answers[q.id] : []);
    const excl = q.exclusive_option;
    if (cur.has(v)) cur.delete(v);
    else {
      if (excl && v === excl) cur.clear();
      else if (excl) cur.delete(excl);
      cur.add(v);
    }
    const arr = q.options.filter((o) => cur.has(o));
    S.answers[q.id] = arr.length ? arr : undefined;
    if (!arr.length) delete S.answers[q.id];
    body.querySelectorAll(".f__opt").forEach((b) => {
      const on = cur.has(b.dataset.v);
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-checked", String(on));
    });
    const next = body.querySelector('[data-act="next"]');
    if (next) next.disabled = !arr.length;
    navigator.vibrate?.(6);
    return;
  }
  S.locked = true;
  body.querySelectorAll(".f__opt").forEach((b) => {
    const on = b === btn;
    b.classList.toggle("is-on", on);
    b.setAttribute("aria-checked", String(on));
  });
  btn.classList.add("is-pop");
  navigator.vibrate?.(8);
  setTimeout(() => { S.locked = false; commit(q, v); }, reduce ? 60 : 300);
}

function onAct(act) {
  if (act === "close") return close();
  if (act === "retry") return finish(true);
  const q = Q[S.step - 1];
  if (!q) return;
  if (act === "skip") return commit(q, SKIP);
  if (act === "next") {
    if (q.type === "text") {
      const v = body.querySelector("#f-text").value.trim().replace(/\n{3,}/g, "\n\n");
      if (v.length < 2) return;
      return commit(q, v);
    }
    if (q.type === "multi" && Array.isArray(S.answers[q.id]) && S.answers[q.id].length) return commit(q, S.answers[q.id]);
  }
}

function commit(q, value) {
  S.answers[q.id] = value;
  if (q.ack && value !== SKIP) S.ack = pipe(q.ack);
  if (S.step < Q.length) {
    save(false);
    go(S.step + 1, 1);
  } else {
    finish(false);
  }
}

// ---------- סיום ----------
function finishingHTML(failed) {
  const [head, ...rest] = C.finishing || [];
  const lines = rest.map((l, k) => `<li style="--i:${k}"><span class="f__tick" aria-hidden="true">${ICON.check}</span><span>${esc(pipe(l))}</span></li>`).join("");
  return `<section class="f__step f__step--finishing">
    <div class="f__orb" aria-hidden="true"></div>
    <h2 class="f__title" id="f-title" tabindex="-1">${esc(pipe(head || ""))}</h2>
    ${lines ? `<ul class="f__checks">${lines}</ul>` : ""}
    <div class="f__fail" ${failed ? "" : "hidden"}>
      <p role="alert">${esc(C.saving_error || "")}</p>
      <button class="f__btn" type="button" data-act="retry">${esc(C.retry || DEF.retry)}</button>
    </div>
  </section>`;
}

async function finish(retry) {
  S.locked = true;
  const step = () => body.querySelector(".f__step--finishing");
  if (retry) {
    const f = body.querySelector(".f__fail");
    if (f) f.hidden = true;
    // בזמן הניסיון החוזר חוזרים הספינר והכותרת "שומר"
    step()?.classList.remove("is-failed");
  } else {
    go(FINISHING, 1);
  }
  const t0 = performance.now();
  const ok = await save(true);
  await sleep(reduce || retry ? 0 : Math.max(0, 1500 - (performance.now() - t0)));
  S.locked = false;
  if (!ok) {
    // במצב כשל: בלי ספינר, בלי "שומר" ובלי וי ירוקים. רק ההודעה וכפתור "נסה שוב"
    step()?.classList.add("is-failed");
    const f = body.querySelector(".f__fail");
    if (f) { f.hidden = false; f.querySelector("button")?.focus(); }
    return;
  }
  S.done = true;
  pixelComplete(S.quizEventId);
  go(THANKS, 1);
  if (!reduce && !navigator.connection?.saveData) confetti();
}

function thanksHTML() {
  const dream = typeof S.answers.dream === "string" && S.answers.dream !== SKIP ? S.answers.dream : "";
  const short = dream.length > 160 ? dream.slice(0, 157).trimEnd() + "…" : dream;
  const title = T.title.replace("{name}", firstName()).replace(/\s+([,!.])/g, "$1").replace(/^\s*,\s*/, "");
  return `<section class="f__step f__step--thanks">
    <div class="f__done" aria-hidden="true"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24"/><path d="M15 27.5l7 7 15-16"/></svg></div>
    <h2 class="f__title" id="f-title" tabindex="-1">${esc(title)}</h2>
    ${T.sub ? `<p class="f__sub">${esc(pipe(T.sub))}</p>` : ""}
    ${short ? `<figure class="f__summary"><figcaption>${esc(T.summary_title)}</figcaption><blockquote dir="auto">${esc(short)}</blockquote></figure>` : ""}
    ${T.next_title ? `<h3 class="f__h3">${esc(T.next_title)}</h3>` : ""}
    <ol class="f__next">${(T.steps || []).map((s, k) => `<li style="--i:${k}"><span class="f__num">${k + 1}</span><span>${esc(pipe(s))}</span></li>`).join("")}</ol>
    ${T.follow ? `<a class="f__follow" href="${IG_URL}" target="_blank" rel="noopener">${ICON.ig}<span>${esc(T.follow)}</span></a>` : ""}
    <button class="f__btn f__btn--ghost" type="button" data-act="close">${esc(C.close || DEF.close)}</button>
  </section>`;
}

function confetti() {
  const cv = dlg.querySelector(".f__confetti");
  const ctx = cv.getContext("2d");
  const dpr = Math.min(devicePixelRatio || 1, 2);
  // הגודל האמיתי של הקנבס (בדסקטופ הוא בתוך הכרטיס), אחרת החלקיקים נמעכים
  const box = cv.getBoundingClientRect();
  const W = (cv.width = Math.round(box.width * dpr));
  const H = (cv.height = Math.round(box.height * dpr));
  const cols = ["#46F516", "#ffffff", "#46F516", "#b8ff9e"];
  const P = Array.from({ length: 72 }, () => ({
    x: W / 2 + (Math.random() - 0.5) * W * 0.2, y: H * 0.32,
    vx: (Math.random() - 0.5) * 18 * dpr, vy: (-Math.random() * 16 - 6) * dpr,
    w: (5 + Math.random() * 6) * dpr, h: (8 + Math.random() * 8) * dpr,
    r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4, c: cols[(Math.random() * cols.length) | 0],
  }));
  const t0 = performance.now();
  cv.style.opacity = "1";
  (function frame(t) {
    const k = (t - t0) / 1400;
    ctx.clearRect(0, 0, W, H);
    for (const p of P) {
      p.vy += 0.55 * dpr; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.globalAlpha = Math.max(0, 1 - k * k);
      ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (k < 1) requestAnimationFrame(frame);
    else { ctx.clearRect(0, 0, W, H); cv.style.opacity = "0"; }
  })(t0);
}

// ---------- מסמכים משפטיים בתוך הדף (בדפדפן של אינסטגרם אין לשוניות) ----------
async function openLegal(href) {
  let d = document.querySelector("dialog.f-legal");
  if (!d) {
    d = document.createElement("dialog");
    d.className = "f-legal";
    d.setAttribute("aria-labelledby", "f-legal-title");
    d.innerHTML = `<div class="f-legal__bar"><button class="f__icon" type="button" aria-label="${esc(C.close || DEF.close)}">${ICON.close}</button></div><div class="f-legal__body" tabindex="-1"></div>`;
    d.querySelector("button").addEventListener("click", () => d.close());
    document.body.appendChild(d);
  }
  const box = d.querySelector(".f-legal__body");
  box.textContent = "";
  d.showModal();
  try {
    const html = await (await fetch(href)).text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const main = doc.querySelector("main") || doc.body;
    main.querySelectorAll("script,style,link").forEach((n) => n.remove());
    // הכותרת של המסמך היא שם הדיאלוג, ובדף נשאר h1 אחד
    const h1 = main.querySelector("h1");
    if (h1) { const h2 = doc.createElement("h2"); h2.id = "f-legal-title"; h2.innerHTML = h1.innerHTML; h1.replaceWith(h2); }
    box.innerHTML = main.innerHTML;
  } catch {
    box.innerHTML = `<p><a href="${esc(href)}" target="_blank" rel="noopener">${esc(href)}</a></p>`;
  }
  box.focus();
}

// ---------- הפעלה ----------
pixelBoot();
document.addEventListener("click", (e) => {
  const t = e.target.closest && e.target.closest("[data-open-flow]");
  if (!t) return;
  e.preventDefault();
  lastTrigger = t;
  open();
});
window.SmithFlow = { open };
window.__flowReady = true;
if (window.__flowPending) open();
