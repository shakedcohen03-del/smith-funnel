// Main landing page (/lp, a copy of Niro Levy's /lp): long sales page, every button opens the name+phone popup
// (creates the lead) -> 10-step "prepare for the call" quiz (/lp/thanks) that ends with the free plan on WhatsApp
// -> done page (/lp/video). One page with 3 views, state lives in memory only.
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const lead = {};
  const PHONE = /^(05\d{8}|9725\d{8})$/;
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const digits = s => s.replace(/\D/g, '');

  // Shows the server's answer under the button and gives the button back
  function failed(btn, label, message) {
    btn.classList.remove('is-off'); btn.textContent = label;
    let p = btn.parentElement.querySelector('.form-err');
    if (!p) { p = document.createElement('p'); p.className = 'form-err'; p.setAttribute('role', 'alert'); btn.after(p); }
    p.textContent = message;
  }

  /* ---------- views ---------- */
  const VIEWS = { '/lp': 'sales', '/lp/thanks': 'quiz', '/lp/video': 'done' };
  const PATHS = { sales: '/lp', quiz: '/lp/thanks', done: '/lp/video' };
  function show(name, push) {
    $$('[data-view]').forEach(v => { v.hidden = v.dataset.view !== name; });
    const view = $(`[data-view="${name}"]`);
    document.title = view.dataset.title;
    if (push) history.pushState({ view: name }, '', PATHS[name] + location.search);
    window.Proof && window.Proof.render(view);
    if (name === 'quiz') { $('#q-name').value = lead.name || ''; $('#q-phone').value = lead.phone || ''; go(0); }
    window.scrollTo(0, 0);
  }
  window.addEventListener('popstate', () => show(VIEWS[location.pathname.replace(/\/$/, '')] || 'sales'));

  /* ---------- popup ---------- */
  const modal = $('#lead-modal'), mForm = $('#lp-form'), mSubmit = $('#m-submit');
  function open() {
    modal.hidden = false; document.body.classList.add('modal-open');
    window.Proof && window.Proof.render(modal);
    setTimeout(() => $('#m-name').focus(), 60);
  }
  function close() { modal.hidden = true; document.body.classList.remove('modal-open'); }
  document.addEventListener('click', e => {
    if (e.target.closest('[data-open]')) open();
    else if (e.target.closest('[data-close]') || e.target === modal) close();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) close(); });
  const mOk = () => $('#m-name').value.trim().length > 1 && PHONE.test(digits($('#m-phone').value)) && $('#m-terms').checked;
  const mSync = () => mSubmit.classList.toggle('is-off', !mOk());
  mForm.addEventListener('input', mSync); mForm.addEventListener('change', mSync);
  $('#m-phone').addEventListener('input', e => { e.target.value = digits(e.target.value).slice(0, 13); });
  mForm.addEventListener('submit', async e => {
    e.preventDefault();
    if (!mOk()) return;
    const label = mSubmit.textContent;
    mSubmit.classList.add('is-off'); mSubmit.textContent = 'רגע...';
    Object.assign(lead, { name: $('#m-name').value.trim(), phone: digits($('#m-phone').value) });
    const ev = window.Px.uuid();
    const r = await window.GiftApi.send({ stage: 'lp', name: lead.name, phone: lead.phone }, ev);
    if (!r.ok) return failed(mSubmit, label, r.message);
    window.Px.track('Lead', lead, ev);
    mSubmit.textContent = label;
    close();
    show('quiz', true);
  });

  /* ---------- prepare-for-the-call quiz ---------- */
  const form = $('#quiz-form');
  const steps = $$('[data-step]', form);
  const next = $('#q-next'), submit = $('#q-submit'), back = $('#q-back');
  const progress = $('#q-progress');
  progress.innerHTML = steps.map(() => '<span></span>').join('') + '<span></span>';
  let cur = 0;
  const age = () => Number($('#q-age').value || 0);

  function valid(i = cur) {
    const step = steps[i];
    const radios = $$('input[type=radio]', step);
    if (radios.length) return radios.some(r => r.checked);
    if (step.dataset.step === 'why') return $('#why').value.trim().length > 1;
    if (step.dataset.step === 'contact') {
      return $('#q-name').value.trim().length > 1 && PHONE.test(digits($('#q-phone').value)) && age() >= 14 &&
        EMAIL.test($('#q-email').value.trim()) && $('#q-terms').checked && $('#q-consent').checked;
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
  $('#q-phone').addEventListener('input', e => { e.target.value = digits(e.target.value).slice(0, 13); });
  $('#q-age').addEventListener('input', e => { e.target.value = digits(e.target.value).slice(0, 2); });

  function slider(id, unit) {
    const el = $('#' + id), out = $('#' + id + '-val');
    const paint = () => {
      el.style.setProperty('--p', ((el.value - el.min) / (el.max - el.min) * 100) + '%');
      out.innerHTML = el.value + '<small>' + unit + '</small>';
    };
    el.addEventListener('input', paint); paint();
  }
  slider('height', 'ס״מ'); slider('weight', 'ק״ג');

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!valid()) return;
    const label = submit.textContent;
    submit.classList.add('is-off'); submit.textContent = 'רגע...';
    const f = Object.fromEntries(new FormData(form).entries());
    Object.assign(lead, { name: f.name.trim(), phone: digits(f.phone), email: f.email.trim() });
    const quiz = { gender: f.gender, goal: f.goal, kg: f.kg, gym: f.gym, height: f.height, weight: f.weight, tried: f.tried, follow: f.follow, weekend: f.weekend, why: f.why, age: f.age };
    const ev = window.Px.uuid();
    const r = await window.GiftApi.send({ stage: 'lp_quiz', name: lead.name, phone: lead.phone, email: lead.email, quiz, plan_slug: window.GiftApi.planSlug(quiz) }, ev);
    if (!r.ok) return failed(submit, label, r.message);
    window.Px.track('CompleteRegistration', lead, ev);
    show('done', true);
  });

  /* ---------- VSL: no controls, so the length and the time left never show (owner 26.10, like Niro's player) ---------- */
  $$('[data-vsl]').forEach(box => {
    const v = $('video', box), btn = $('.play', box);
    box.addEventListener('click', () => (v.paused ? v.play() : v.pause()));
    box.addEventListener('contextmenu', e => e.preventDefault());
    v.addEventListener('play', () => { btn.hidden = true; });
    v.addEventListener('pause', () => { btn.hidden = false; });
  });

  /* ---------- cookie note (closes for this visit only) ---------- */
  $('#cookie-x').addEventListener('click', () => { $('#cookie').hidden = true; });

  // boot
  show(VIEWS[location.pathname.replace(/\/$/, '')] || 'sales', false);
})();
