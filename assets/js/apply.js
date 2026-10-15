// הטופס בדף (#apply): שאלות, שם וטלפון בכרטיס אחד. שולח ליד ל-/api/lead, ואז את התשובות ל-/api/quiz.
import { attribution, tracking, pixelBoot, pixelLead, uuid } from "./tracking.js";

pixelBoot();

const form = document.getElementById("apply-form");
const body = document.getElementById("apply-body");
const statusEl = document.getElementById("form-status");
const submit = form?.querySelector(".form__submit");
const submitTxt = form?.querySelector(".form__submit-txt");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

// סדר השאלות כפי שהן נשלחות ל-CRM
const QUESTION_IDS = ["marital", "duration", "pain", "six_months", "four_months", "weight", "height", "ready"];
const TEXT = {
  choose: "בחר תשובה מהרשימה",
  ready: "בחר כן או לא",
  weight: 'משקל בק"ג, מספר בין 30 ל־300',
  height: 'גובה בס"מ, מספר בין 120 ל־230',
  name: "כתוב את השם שלך",
  phoneEmpty: "כתוב מספר טלפון נייד",
  phoneBad: "צריך מספר נייד ישראלי, לדוגמה 050-1234567",
  missing: "חסרים כמה פרטים. סימנו לך אותם בטופס.",
  failed: "משהו השתבש בשליחה והפרטים לא נקלטו. נסה שוב בעוד רגע, או כתוב לי ישירות בוואטסאפ.",
  limited: "היו כמה ניסיונות בזמן קצר. נסה שוב בעוד דקה.",
  sending: "שולח את הפרטים",
};

// אותם כללים כמו בשרת: 05X, +972, 972, 00972, מקפים ורווחים. מחזיר 05XXXXXXXX או null
export function normalizeIsraeliMobile(raw) {
  let digits = String(raw ?? "").replace(/\D/g, "");
  digits = digits.replace(/^0{0,2}972/, "972");
  if (digits.startsWith("972")) digits = "0" + digits.slice(3).replace(/^0+/, "");
  return /^05\d{8}$/.test(digits) ? digits : null;
}

const fieldById = (id) => form.querySelector(`.field[data-id="${id}"]`);
const controlOf = (field) => field.querySelector("select, textarea, input");
const errOf = (field) => field.querySelector(".field__err");

function setError(field, msg) {
  field.classList.add("is-invalid");
  const err = errOf(field);
  if (err) {
    err.textContent = msg;
    err.hidden = false;
  }
  field.querySelectorAll("select, textarea, input").forEach((c) => c.setAttribute("aria-invalid", "true"));
}

function clearError(field) {
  if (!field.classList.contains("is-invalid")) return;
  field.classList.remove("is-invalid");
  const err = errOf(field);
  if (err) err.hidden = true;
  field.querySelectorAll("[aria-invalid]").forEach((c) => c.removeAttribute("aria-invalid"));
}

const numberOf = (v) => {
  const s = String(v).trim().replace(",", ".");
  return /^\d{1,3}(\.\d)?$/.test(s) ? Number(s) : NaN;
};

// בודק שדה אחד. מחזיר הודעת שגיאה או ""
function problemOf(field) {
  const id = field.dataset.id;
  const c = controlOf(field);
  if (id === "ready") return form.querySelector('input[name="ready"]:checked') ? "" : TEXT.ready;
  if (c.tagName === "SELECT") return c.value ? "" : TEXT.choose;
  const v = c.value.trim();
  if (id === "weight") return !v || (numberOf(v) >= 30 && numberOf(v) <= 300) ? "" : TEXT.weight;
  if (id === "height") return !v || (/^\d{3}$/.test(v) && +v >= 120 && +v <= 230) ? "" : TEXT.height;
  if (c.name === "name") return v.length >= 2 ? "" : TEXT.name;
  if (c.name === "phone") return !v ? TEXT.phoneEmpty : normalizeIsraeliMobile(v) ? "" : TEXT.phoneBad;
  return "";
}

const checkedFields = () => [...form.querySelectorAll(".field[data-required], .field[data-id='weight'], .field[data-id='height']")];

function validateAll() {
  let first = null;
  for (const field of checkedFields()) {
    const msg = problemOf(field);
    if (msg) {
      setError(field, msg);
      first ||= field;
    } else clearError(field);
  }
  return first;
}

// שגיאה נעלמת ברגע שהשדה תקין
form?.addEventListener("input", (e) => {
  const field = e.target.closest(".field");
  if (field && field.classList.contains("is-invalid") && !problemOf(field)) clearError(field);
});
form?.addEventListener("change", (e) => {
  const field = e.target.closest(".field");
  if (field && field.classList.contains("is-invalid") && !problemOf(field)) clearError(field);
});

function questionOf(field) {
  const label = field.querySelector("[data-q]") || field.querySelector(".field__label");
  return label.textContent.trim().replace(/\s+/g, " ");
}

function answerOf(field) {
  const id = field.dataset.id;
  if (id === "ready") return form.querySelector('input[name="ready"]:checked')?.value || "";
  const v = controlOf(field).value.trim();
  if ((id === "weight" || id === "height") && v) return String(numberOf(v));
  return v;
}

function collectAnswers() {
  const out = [];
  for (const id of QUESTION_IDS) {
    const field = fieldById(id);
    const a = field ? answerOf(field) : "";
    if (a) out.push({ id, q: questionOf(field), a });
  }
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function postJson(url, payload, timeoutMs, keepalive = false) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
      keepalive,
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  } finally {
    clearTimeout(timer);
  }
}

// התשובות מגיעות לליד שכבר נוצר. ניסיון ועוד עד 3 ניסיונות חוזרים על תקלת רשת או 5xx
async function sendQuiz(payload) {
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) await sleep(500 * 2 ** (attempt - 1));
    try {
      const r = await postJson("/api/quiz", payload, 8000, true);
      if (r.status < 500) return r.status === 200 && r.data?.ok === true;
    } catch {
      // network error or timeout: try again
    }
  }
  return false;
}

function showStatus(msg) {
  statusEl.textContent = msg;
  statusEl.hidden = false;
}

function setBusy(on) {
  submit.disabled = on;
  submit.classList.toggle("is-busy", on);
  submit.setAttribute("aria-busy", on ? "true" : "false");
  submitTxt.textContent = on ? TEXT.sending : submitTxt.dataset.idle;
}

function focusField(field) {
  const c = field.querySelector("select, textarea, input:not([type=radio])") || field.querySelector("input");
  field.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
  c?.focus({ preventScroll: true });
}

function showThanks(name) {
  const first = name.trim().split(/\s+/)[0];
  body.innerHTML = `
    <div class="thanks" tabindex="-1" role="status">
      <span class="thanks__mark" aria-hidden="true"><svg viewBox="0 0 24 24" width="30" height="30"><path d="M5.5 12.5l4.2 4.2L18.5 8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
      <h3 class="thanks__title">תודה, <span data-first></span>. קיבלנו.</h3>
      <p>אני והצוות שלי נחזור אליך בהקדם.</p>
      <p>בינתיים, תעקוב אחריי באינסטגרם 💪</p>
      <a class="btn btn--outline thanks__ig" href="https://www.instagram.com/mrsmith.fit/" target="_blank" rel="noopener"><span dir="ltr">@mrsmith.fit</span><span class="btn__ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16"><path d="M19 12H5M11 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></span></a>
    </div>`;
  body.querySelector("[data-first]").textContent = first;
  const box = body.querySelector(".thanks");
  box.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
  box.focus({ preventScroll: true });
}

// מזהה גלישה ומזהה אירוע Lead אחד לכל ביקור: ניסיון חוזר אחרי תקלה מגיע לאותו ליד ב-CRM
let session = "";
let leadEventId = "";
let busy = false;

async function onSubmit(e) {
  e.preventDefault();
  if (busy) return;
  statusEl.hidden = true;

  const bad = validateAll();
  if (bad) {
    showStatus(TEXT.missing);
    focusField(bad);
    return;
  }

  busy = true;
  setBusy(true);
  session ||= uuid();
  leadEventId ||= uuid();
  const name = document.getElementById("f-name").value.trim().replace(/\s+/g, " ");
  const phone = normalizeIsraeliMobile(document.getElementById("f-phone").value);

  let res = null;
  try {
    res = await postJson(
      "/api/lead",
      {
        session,
        name,
        phone,
        marketing_consent: false,
        consent_text: null,
        website: document.getElementById("f-website").value,
        ...attribution(),
        tracking: tracking({ lead_event_id: leadEventId }),
      },
      15000
    );
  } catch {
    res = null;
  }

  if (!res || res.status !== 200 || res.data?.ok !== true) {
    busy = false;
    setBusy(false);
    const code = res?.data?.error;
    if (code === "invalid_phone") {
      setError(document.getElementById("f-phone").closest(".field"), TEXT.phoneBad);
      showStatus(TEXT.phoneBad);
    } else if (code === "invalid_name") {
      setError(document.getElementById("f-name").closest(".field"), TEXT.name);
      showStatus(TEXT.name);
    } else if (res?.status === 429) {
      showStatus(TEXT.limited);
    } else {
      showStatus(TEXT.failed);
    }
    return;
  }

  await sendQuiz({ session, total: QUESTION_IDS.length, completed: true, answers: collectAnswers() });
  pixelLead({ name, phone }, leadEventId);
  showThanks(name);
}

if (form) {
  submitTxt.dataset.idle = submitTxt.textContent;
  form.addEventListener("submit", onSubmit);
}
