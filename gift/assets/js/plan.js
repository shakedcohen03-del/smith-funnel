// Plan pages sent on WhatsApp: /gift/plan/<man|woman>-<weight-loss|mass>[-no-gym][-<height>-<weight>-<age>][/menu|/training]
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const app = $('#app');
  const m = location.pathname.match(/^\/gift\/plan\/(man|woman)-(weight-loss|mass)(-no-gym)?(?:-(\d{3})-(\d{2,3})-(\d{2}))?(?:\/(menu|training))?\/?$/);
  if (!m) { app.innerHTML = '<main class="wrap offer"><h1 class="h1">הקישור לא תקין</h1><a class="btn" href="/gift">לשאלון</a></main>'; return; }
  const V = { male: m[1] === 'man', cut: m[2] === 'weight-loss', gym: !m[3], page: m[7] || 'plan' };
  V.slug = `/gift/plan/${m[1]}-${m[2]}${m[3] || ''}${m[4] ? `-${m[4]}-${m[5]}-${m[6]}` : ''}`;
  const q = new URLSearchParams(location.search);
  const person = {
    h: Number(m[4] || q.get('h')) || (V.male ? 178 : 165),
    w: Number(m[5] || q.get('w')) || (V.male ? 85 : 68),
    a: Number(m[6] || q.get('a')) || 30,
  };
  const ico = id => `<svg class="ico" aria-hidden="true"><use href="#${id}"/></svg>`;
  const words = { who: V.male ? 'לגברים' : 'לנשים', goal: V.cut ? 'חיטוב' : 'מסה', place: V.gym ? 'עם חדר כושר' : 'בלי חדר כושר' };
  const chip = `${V.male ? 'גבר' : 'אישה'} · ${words.goal} · ${V.gym ? 'חדר כושר' : 'אימון בבית'}`;

  /* ---------- the plan itself is built by the CRM generator (/api/gift-plan, cached per profile) ---------- */
  const fetchSlug = `${m[1]}-${m[2]}${m[3] || ''}-${person.h}-${person.w}-${person.a}`;
  let planData = null;
  async function loadPlan() {
    if (planData) return planData;
    const r = await fetch('/api/gift-plan?slug=' + encodeURIComponent(fetchSlug)).catch(() => null);
    const j = r && r.ok ? await r.json().catch(() => null) : null;
    planData = j && j.ok ? j : null;
    return planData;
  }
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const WAIT = '<p class="doc__wait"><span class="spin" aria-hidden="true"></span>בונים לך את התוכנית...</p>';
  const FAIL = '<p class="doc__wait">לא הצלחנו לטעון את התוכנית כרגע. נסה/י לרענן את הדף בעוד רגע.</p>';
  const num = n => Number(n || 0).toLocaleString('he-IL');

  /* ---------- views ---------- */
  function offerForm() {
    return `<div class="gift"><svg class="ico"><use href="#i-gift"/></svg><b dir="ltr">+3</b><p><strong>חודשי ליווי מתנה</strong>לכל מי שמצטרף אחרי שיחת ההתאמה. ההטבה לא תופיע שוב.</p></div>
    <form class="formcard" id="offer-form" novalidate>
      <h2 id="form">רוצה ליווי אישי וצמוד? 3 חודשים נוספים עלינו${ico('i-down')}</h2>
      <p class="lead">הטופס הזה הוא רק למי שרוצה את הליווי הצמוד שלנו, <strong>כדי להגיע למטרה שלו בתוך חצי שנה ולשמור עליה גם אחרי.</strong></p>
      <input class="field" type="text" name="name" id="o-name" maxlength="20" autocomplete="name" placeholder="שם" aria-label="שם">
      <input class="field" type="tel" name="phone" id="o-phone" inputmode="numeric" autocomplete="tel" placeholder="טלפון" aria-label="טלפון">
      <p class="q">כמה זמן ניסית לשנות את הגוף שלך?</p>
      <div class="pills">${['מתחת ל-3 חודשים', 'חצי שנה', 'שנה ומעלה', 'כל החיים…'].map(t => `<label class="pill"><input type="radio" name="tried" value="${t}">${t}</label>`).join('')}</div>
      <p class="q">למה חשוב לך לעשות שינוי דווקא עכשיו?</p>
      <textarea class="field" name="now" id="o-now" maxlength="2000" placeholder="כתוב/כתבי במילים שלך..." aria-label="למה חשוב לך לעשות שינוי דווקא עכשיו?"></textarea>
      <label class="check"><input type="checkbox" name="paid" id="o-paid"><span><strong>אני מבין/ה שהליווי בתשלום</strong>, וההטבה היא 3 חודשים נוספים בליווי בהתאם למסלול שאבחר</span></label>
      <button class="btn is-off" type="submit" id="o-submit">לשיחת ייעוץ בחינם ומימוש 3 החודשים</button>
      <div class="faces" data-faces><p><strong>כמעט 4,000 מתאמנים</strong>כבר עשו את זה עם סמית'</p></div>
    </form>`;
  }

  function viewPlan() {
    document.title = `תוכנית ${words.goal} ${words.who} ${words.place} | SMITHFIT`;
    const qs = location.search;
    app.innerHTML = `<p class="notice">${ico('i-check')}תוכנית האימונים ותפריט התזונה שלך מוכנים</p>
    <main class="wrap offer">
      <p class="eyebrow">${chip}</p>
      <h1 class="h1">תוכנית ${words.goal} ${words.who} ${words.place}, <u>שנכנסת לחיים העמוסים שלך</u></h1>
      <div class="coach"><img src="/gift/assets/img/smith/coach-640.webp" alt="סמית'" width="44" height="44"><span><strong>הצוות של סמית'</strong> · התפריט והאימונים נבנו לפי התשובות שלך בשאלון. מתחילים היום.</span></div>
      <a class="doclink" href="${V.slug}/menu${qs}"><span class="doclink__ico">${ico('i-menu')}</span><span><strong>לתפריט התזונה שלך</strong>מחושב לפי הגובה, המשקל והגיל שלך</span>${ico('i-next')}</a>
      <a class="doclink" href="${V.slug}/training${qs}"><span class="doclink__ico">${ico('i-train')}</span><span><strong>לתוכנית האימונים שלך</strong>${V.gym ? '3 אימונים בשבוע בחדר הכושר' : '3 אימונים בשבוע בבית, בלי ציוד'}</span>${ico('i-next')}</a>
      ${offerForm()}
    </main>`;
    bindOffer();
  }

  const backBar = () => `<p class="notice"><a class="notice__back" href="${V.slug}${location.search}">${ico('i-back')}חזרה לתוכנית</a></p>`;

  function docShell(title, lead) {
    return `${backBar()}<main class="paper doc"><div class="wrap sec">
      <div class="sec__head"><p class="eyebrow">${chip}</p><h2>${title}</h2><p class="doc__lead" id="doc-lead">${lead}</p></div>
      <div id="doc-body">${WAIT}</div>
    </div></main>`;
  }

  function viewMenu() {
    document.title = `תפריט ${words.goal} ${words.who} | SMITHFIT`;
    app.innerHTML = docShell(`תפריט ${words.goal} ${words.who}`, `נבנה בשבילך לפי ${person.h} ס״מ, ${person.w} ק״ג וגיל ${person.a}`);
    loadPlan().then(d => { $('#doc-body').innerHTML = d && d.menu ? menuBody(d) : FAIL; });
  }

  const amount = f => (f.quantity == null || f.quantity === '' ? '' : `${f.quantity}${f.unit ? ' ' + f.unit : ''} `);
  function mealCard(meal) {
    const items = meal.items.map(f => `<li><strong>${esc(amount(f))}${esc(f.name)}</strong>${f.replacements.length ? `<small>או: ${f.replacements.map(esc).join(' / ')}</small>` : ''}</li>`).join('');
    return `<article class="meal"><header><h3>${esc(meal.title)}${meal.optional ? ' <small>(אופציונלי)</small>' : ''}</h3>${meal.calories ? `<span>כ-${num(meal.calories)} קלוריות · ${num(meal.protein)} גרם חלבון</span>` : ''}</header><ul class="foods">${items}</ul></article>`;
  }

  // Smith's own menu notes: "כותרת:" lines become headings, "- " lines become bullets
  function notesHtml(text) {
    const lines = String(text || '').split('\n').map(s => s.trim()).filter(Boolean);
    let html = '', open = false;
    for (const line of lines) {
      if (/:\s*$/.test(line) && line.length < 30) { if (open) html += '</ul>'; html += `<h4>${esc(line.replace(/:\s*$/, ''))}</h4><ul class="snacks">`; open = true; continue; }
      if (!open) { html += '<ul class="snacks">'; open = true; }
      html += `<li>${esc(line.replace(/^[-•]\s*/, ''))}</li>`;
    }
    return html ? `<article class="meal meal--tips">${html}${open ? '</ul>' : ''}</article>` : '';
  }

  function menuBody(d) {
    const t = d.targets;
    return `<div class="stats">
        <div><b>${num(t.kcal)}</b><span>קלוריות ביום</span></div>
        <div><b>${t.prot}</b><span>גרם חלבון</span></div>
        <div><b>${t.carb}</b><span>גרם פחמימה</span></div>
        <div><b>${t.fat}</b><span>גרם שומן</span></div>
      </div>
      <p class="doc__note">הגוף שלך שורף כ-${num(t.tdee)} קלוריות ביום. ${V.cut ? 'לחיטוב מורידים 25%' : 'לעלייה במסה מוסיפים 20%'}, וחלבון לפי 1.8 גרם לכל ק״ג.</p>
      ${d.menu.meals.map(mealCard).join('')}
      ${notesHtml(d.menu.notes)}
      <p class="doc__legal">התפריט נבנה אוטומטית לפי הנתונים שמילאת, ואינו מותאם להעדפות, למצב רפואי או לרגישויות. אינו מהווה ייעוץ רפואי או תזונתי.</p>
      ${ctaBlock()}`;
  }

  function viewTraining() {
    document.title = `תוכנית אימונים ${words.place} | SMITHFIT`;
    app.innerHTML = docShell(`תוכנית אימונים ${V.gym ? 'בחדר כושר' : 'בבית'}`, 'נבנתה בשבילך לפי המטרה והציוד שלך');
    loadPlan().then(d => {
      if (!d || !d.workout) { $('#doc-body').innerHTML = FAIL; return; }
      $('#doc-lead').textContent = `${d.workout.workouts.length} אימונים בשבוע, עם יום מנוחה ביניהם`;
      $('#doc-body').innerHTML = trainingBody(d.workout);
    });
  }

  function trainingBody(w) {
    const row = e => `<li><div><strong>${esc(e.name)}</strong></div><span class="ex__s">${e.sets != null && e.reps != null ? `${esc(e.sets)} × ${esc(e.reps)}` : e.sets != null ? `${esc(e.sets)} סטים` : ''}</span>${e.rest ? `<span class="ex__r">מנוחה ${esc(e.rest)}</span>` : ''}</li>`;
    const card = x => `<article class="meal"><header><h3>${esc(x.name)}</h3><span>${x.exercises.length} תרגילים</span></header><ol class="ex">${x.exercises.map(row).join('')}</ol></article>`;
    return `${w.workouts.map(card).join('')}
      <p class="doc__legal">התוכנית כללית ואינה מותאמת אישית. לפני תחילת פעילות גופנית מומלץ להתייעץ עם רופא, בעיקר אם יש מגבלה רפואית.</p>
      ${ctaBlock()}`;
  }

  function ctaBlock() {
    return `<div class="doc__cta"><div class="gift"><svg class="ico"><use href="#i-gift"/></svg><b dir="ltr">+3</b><p><strong>חודשי ליווי מתנה</strong>בליווי המלא התפריט והאימונים נבנים אישית בשבילך, עם בקרה כל שבוע.</p></div>
      <a class="btn" href="${V.slug}${location.search}#form">לשיחת התאמה ו-3 חודשים מתנה${ico('i-next')}</a></div>`;
  }

  /* ---------- offer form on the plan page ---------- */
  function bindOffer() {
    const form = $('#offer-form'), btn = $('#o-submit');
    const digits = s => s.replace(/\D/g, '');
    const ok = () => $('#o-name').value.trim().length > 1 && /^(05\d{8}|9725\d{8})$/.test(digits($('#o-phone').value)) &&
      !!form.querySelector('input[name=tried]:checked') && $('#o-now').value.trim().length > 1 && $('#o-paid').checked;
    const sync = () => btn.classList.toggle('is-off', !ok());
    $('#o-phone').addEventListener('input', e => { e.target.value = digits(e.target.value).slice(0, 13); });
    form.addEventListener('input', sync); form.addEventListener('change', sync);
    form.addEventListener('submit', e => {
      e.preventDefault(); if (!ok()) return;
      const label = btn.textContent, f = new FormData(form);
      btn.classList.add('is-off'); btn.textContent = 'רגע...';
      window.GiftApi.send({ stage: 'call', name: f.get('name'), phone: digits(f.get('phone')), call: { tried: f.get('tried'), now: f.get('now') } }).then(r => {
        if (r.ok) { location.href = '/gift/thanks'; return; }
        btn.classList.remove('is-off'); btn.textContent = label;
        let p = form.querySelector('.form-err');
        if (!p) { p = document.createElement('p'); p.className = 'form-err'; p.setAttribute('role', 'alert'); btn.after(p); }
        p.textContent = r.message;
      });
    });
    window.Proof && window.Proof.render(app);
    if (location.hash === '#form') setTimeout(() => $('#form').scrollIntoView({ block: 'start' }), 50);
  }

  ({ plan: viewPlan, menu: viewMenu, training: viewTraining })[V.page]();
  if (V.page !== 'plan') window.scrollTo(0, 0);
})();
