// Quiz funnel: 7-step quiz -> offer -> thanks, one page with 3 views (state lives in memory only).
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const lead = {};

  // Shows the server's answer under the button and gives the button back
  function failed(btn, label, message) {
    btn.classList.remove('is-off'); btn.textContent = label;
    let p = btn.parentElement.querySelector('.form-err');
    if (!p) { p = document.createElement('p'); p.className = 'form-err'; p.setAttribute('role', 'alert'); btn.after(p); }
    p.textContent = message;
  }

  /* ---------- views ---------- */
  const VIEWS = { '/gift': 'quiz', '/gift/offer': 'offer', '/gift/thanks': 'thanks' };
  function show(name, push) {
    $$('[data-view]').forEach(v => { v.hidden = v.dataset.view !== name; });
    const view = $(`[data-view="${name}"]`);
    document.title = view.dataset.title;
    if (push) history.pushState({ view: name }, '', name === 'quiz' ? '/gift' : '/gift/' + name);
    if (name !== 'quiz') window.Proof && window.Proof.render(view);
    if (name === 'offer') { $('#o-name').value = lead.name || ''; $('#o-phone').value = lead.phone || ''; syncOffer(); }
    window.scrollTo(0, 0);
  }
  window.addEventListener('popstate', () => show(VIEWS[location.pathname.replace(/\/$/, '') || '/'] || 'quiz'));

  /* ---------- quiz ---------- */
  const form = $('#quiz-form');
  const steps = $$('[data-step]', form);
  const next = $('#q-next'), submit = $('#q-submit'), back = $('#q-back');
  const progress = $('#q-progress');
  progress.innerHTML = steps.map(() => '<span></span>').join('') + '<span></span>';
  let cur = 0;

  const PHONE = /^(05\d{8}|9725\d{8})$/;
  const digits = s => s.replace(/\D/g, '');
  const age = () => Number($('#q-age').value || 0);

  function valid(i = cur) {
    const step = steps[i];
    const radios = $$('input[type=radio]', step);
    if (radios.length) return radios.some(r => r.checked);
    if (step.dataset.step === 'why') return $('#why').value.trim().length > 1;
    if (step.dataset.step === 'contact') {
      const statusOk = age() < 25 || $('#q-status').value !== '';
      return $('#q-name').value.trim().length > 1 && PHONE.test(digits($('#q-phone').value)) &&
        /^\d{2}$/.test($('#q-age').value) && statusOk && $('#q-terms').checked && $('#q-consent').checked;
    }
    return true;
  }

  function sync() {
    const last = cur === steps.length - 1;
    next.hidden = last; submit.hidden = !last;
    (last ? submit : next).classList.toggle('is-off', !valid());
    back.hidden = cur === 0;
    $$('span', progress).forEach((s, i) => s.classList.toggle('on', i <= cur));
  }

  function go(i) {
    steps[cur].hidden = true;
    cur = Math.max(0, Math.min(steps.length - 1, i));
    steps[cur].hidden = false;
    if (steps[cur].dataset.step === 'bmi') bmi();
    sync();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  next.addEventListener('click', () => { if (valid()) go(cur + 1); });
  back.addEventListener('click', () => go(cur - 1));
  form.addEventListener('change', e => {
    if (e.target.matches('[data-auto]') && e.target.checked) setTimeout(() => go(cur + 1), 260);
    sync();
  });
  form.addEventListener('input', sync);

  // field hygiene
  $('#q-phone').addEventListener('input', e => { e.target.value = digits(e.target.value).slice(0, 13); });
  $('#o-phone').addEventListener('input', e => { e.target.value = digits(e.target.value).slice(0, 13); });
  $('#q-age').addEventListener('input', e => {
    e.target.value = digits(e.target.value).slice(0, 2);
    const s = $('#q-status'); s.hidden = age() < 25; if (s.hidden) s.value = '';
  });

  // sliders
  function slider(id, unit) {
    const el = $('#' + id), out = $('#' + id + '-val');
    const paint = () => {
      el.style.setProperty('--p', ((el.value - el.min) / (el.max - el.min) * 100) + '%');
      out.innerHTML = el.value + '<small>' + unit + '</small>';
    };
    el.addEventListener('input', paint); paint();
  }
  slider('height', 'ס״מ'); slider('weight', 'ק״ג');

  // BMI result, 5 levels
  const LEVELS = [
    { max: 18.5, label: 'תת משקל', color: '#8dc7ef', text: 'ה-BMI שלך נמצא בטווח תת־משקל. זה הזמן לבנות שגרת תזונה ואימונים שתעזור לך לעלות במסה בצורה נכונה, גם עם הלו״ז העמוס שלך!' },
    { max: 25, label: 'משקל תקין', color: '#9fd6b2', text: 'ה-BMI שלך בטווח התקין, וזה מעולה! עכשיו זה בדיוק הזמן לעבור לשלב הבא: לחטב, לחזק ולהגיע לגוף שתמיד רצית, גם עם הלו״ז העמוס שלך!' },
    { max: 30, label: 'עודף משקל', color: '#e9c46a', text: 'ה-BMI שלך נמצא בטווח עודף־משקל. זה הזמן לשנות את השגרה. עם מסגרת נכונה וליווי צמוד אפשר להגיע למטרה שלך, גם עם הלו״ז העמוס שלך!' },
    { max: 40, label: 'השמנה', color: '#ef9a7f', text: 'ה-BMI שלך נמצא בטווח השמנה. זה הזמן לקחת את המטרה שלך ברצינות ולבנות שגרה חדשה. הצעד הראשון יכול להתחיל כבר היום, גם עם הלו״ז העמוס שלך!' },
    { max: Infinity, label: 'השמנה קיצונית', color: '#ef9a7f', text: 'ה-BMI שלך נמצא בטווח השמנה קיצונית. אל תדחה את הצעד הראשון. זה הזמן להתחיל שינוי עם ליווי צמוד ומתאים, גם עם הלו״ז העמוס שלך!' },
  ];
  function bmi() {
    const h = $('#height').value / 100, w = Number($('#weight').value);
    const v = w / (h * h);
    const lv = LEVELS.find(l => v < l.max);
    $('#bmi-val').textContent = v.toFixed(1);
    $('#bmi-val').style.color = lv.color;
    $('#bmi-status span').textContent = lv.label;
    $('#bmi-status').style.color = lv.color;
    $('#bmi-msg').textContent = lv.text;
    $('#bmi-pin').style.left = Math.max(2, Math.min(98, (v - 15) / 25 * 100)) + '%';
    lead.bmi = v.toFixed(1);
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!valid()) return;
    const label = submit.textContent;
    submit.classList.add('is-off'); submit.textContent = 'רגע...';
    const f = new FormData(form);
    Object.assign(lead, Object.fromEntries(f.entries()), { phone: digits(f.get('phone')) });
    const quiz = { gender: lead.gender, goal: lead.goal, gym: lead.gym, height: lead.height, weight: lead.weight, age: lead.age, status: lead.status || '', why: lead.why };
    const ev = window.Px.uuid();
    const r = await window.GiftApi.send({ stage: 'quiz', name: lead.name, phone: lead.phone, quiz, plan_slug: window.GiftApi.planSlug(quiz) }, ev);
    if (!r.ok) return failed(submit, label, r.message);
    window.Px.track('Lead', lead, ev);
    show('offer', true);
  });

  /* ---------- offer ---------- */
  const offer = $('#offer-form'), oSubmit = $('#o-submit');
  function syncOffer() {
    const ok = $('#o-name').value.trim().length > 1 && PHONE.test(digits($('#o-phone').value)) &&
      $$('input[name=tried]', offer).some(r => r.checked) && $('#o-now').value.trim().length > 1 && $('#o-paid').checked;
    oSubmit.classList.toggle('is-off', !ok);
    return ok;
  }
  offer.addEventListener('input', syncOffer);
  offer.addEventListener('change', syncOffer);
  offer.addEventListener('submit', async e => {
    e.preventDefault();
    if (!syncOffer()) return;
    const label = oSubmit.textContent;
    oSubmit.classList.add('is-off'); oSubmit.textContent = 'רגע...';
    const f = new FormData(offer);
    const ev = window.Px.uuid(), who = { name: f.get('name'), phone: digits(f.get('phone')) };
    const r = await window.GiftApi.send({ stage: 'call', ...who, call: { tried: f.get('tried'), now: f.get('now'), from: 'offer' } }, ev);
    if (!r.ok) return failed(oSubmit, label, r.message);
    window.Px.track('CompleteRegistration', who, ev);
    show('thanks', true);
  });

  /* ---------- cookie note (closes for this visit only) ---------- */
  $('#cookie-x').addEventListener('click', () => { $('#cookie').hidden = true; });

  // boot
  go(0);
  const start = VIEWS[location.pathname.replace(/\/$/, '') || '/'] || 'quiz';
  if (start !== 'quiz') show(start, false);
})();
