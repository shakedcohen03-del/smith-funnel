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

  /* ---------- Smith's targets (same formula as the coach bot) ---------- */
  function targets(p) {
    const bmr = 10 * p.w + 6.25 * p.h - 5 * p.a + (V.male ? 5 : -161);
    const tdee = bmr * 1.375;
    const kcal = Math.round((V.cut ? Math.max(tdee * 0.85, V.male ? 1500 : 1200) : tdee * 1.2) / 10) * 10;
    const prot = Math.round(1.8 * p.w);
    const fat = Math.round(Math.max(0.8 * p.w, kcal * 0.22 / 9));
    const carb = Math.max(0, Math.round((kcal - prot * 4 - fat * 9) / 4));
    return { bmr: Math.round(bmr), tdee: Math.round(tdee), kcal, prot, fat, carb };
  }

  /* ---------- foods: per 100 g, or per unit when `u` is set ---------- */
  const F = {
    egg: { u: x => `${x} ביצים`, k: 70, p: 6.3, min: 2, max: 4, step: 1 },
    cottage: { n: 'קוטג׳ 5%', k: 95, p: 11, min: 100, max: 250, step: 25 },
    white: { n: 'גבינה לבנה 5%', k: 95, p: 9, min: 100, max: 250, step: 25 },
    yog: { u: () => 'גביע יוגורט חלבון', k: 140, p: 20, min: 1, max: 1, step: 1 },
    chicken: { n: 'חזה עוף (מבושל)', k: 165, p: 31, min: 100, max: 250, step: 10 },
    beef: { n: 'בשר בקר טחון 5% (מבושל)', k: 176, p: 26, min: 100, max: 220, step: 10 },
    fish: { n: 'פילה אמנון (מבושל)', k: 128, p: 26, min: 120, max: 250, step: 10 },
    thigh: { n: 'פרגית (צלויה)', k: 200, p: 25, min: 100, max: 220, step: 10 },
    tuna: { n: 'טונה במים (מסוננת)', k: 116, p: 26, min: 80, max: 160, step: 10 },
    turkey: { n: 'פסטרמה הודו', k: 105, p: 20, min: 60, max: 150, step: 10 },
    bread: { u: x => x === 1 ? 'פרוסת לחם מלא' : `${x} פרוסות לחם מלא`, k: 75, p: 3, min: 1, max: 4, step: 1 },
    rice: { n: 'אורז (מבושל)', k: 130, p: 2.7, min: 80, max: 350, step: 10 },
    sweet: { n: 'בטטה (אפויה)', k: 90, p: 2, min: 100, max: 450, step: 10 },
    potato: { n: 'תפוחי אדמה (מבושלים)', k: 87, p: 2, min: 100, max: 450, step: 10 },
    pasta: { n: 'פסטה (מבושלת)', k: 158, p: 5.8, min: 80, max: 300, step: 10 },
    oats: { n: 'שיבולת שועל', k: 380, p: 13, min: 30, max: 90, step: 5 },
    cakes: { u: x => `${x} פריכיות אורז`, k: 35, p: 0.7, min: 2, max: 6, step: 1 },
    pita: { u: x => `${String(x).replace(/^0?.5$/, '½').replace(/^(d).5$/, '$1½')} פיתה מלאה`, k: 180, p: 6, min: .5, max: 2, step: .5 },
  };
  const FIX = { oil: ['כפית שמן זית', 45], fruit: ['פרי אחד', 80], veg: ['ירקות חופשי (עד 250 גרם)', 0] };
  const MEALS = [
    { n: 'ארוחת בוקר', share: .25, opts: [['egg', 'bread', 'veg'], ['white', 'bread', 'veg'], ['yog', 'oats', 'fruit'], ['cottage', 'cakes', 'veg']] },
    { n: 'ארוחת צהריים', share: .35, opts: [['chicken', 'rice', 'veg', 'oil'], ['beef', 'sweet', 'veg'], ['fish', 'potato', 'veg', 'oil'], ['thigh', 'pasta', 'veg']] },
    { n: 'ארוחת ערב', share: .30, opts: [['tuna', 'bread', 'veg'], ['egg', 'pita', 'veg'], ['cottage', 'cakes', 'veg'], ['turkey', 'bread', 'veg']] },
  ];
  const SNACKS = ['פרי', 'יוגורט חלבון', 'חטיף חלבון', 'חופן קטן של אגוזים (20 גרם)'];

  const fit = (f, x) => Math.min(f.max, Math.max(f.min, Math.round(x / f.step) * f.step));
  const amountText = (f, x) => f.u ? f.u(x) : `${x} גרם ${f.n}`;

  function buildOption([pk, ck, ...extra], mealK, mealP) {
    const pf = F[pk], cf = F[ck];
    const per = f => f.u ? 1 : 100;
    const pAmt = fit(pf, (mealP * 0.8) / pf.p * per(pf));
    const fixK = extra.reduce((s, x) => s + FIX[x][1], 0);
    const cAmt = fit(cf, (mealK - pAmt / per(pf) * pf.k - fixK) / cf.k * per(cf));
    const kcal = pAmt / per(pf) * pf.k + cAmt / per(cf) * cf.k + fixK;
    const prot = pAmt / per(pf) * pf.p + cAmt / per(cf) * cf.p;
    const parts = [amountText(pf, pAmt), amountText(cf, cAmt), ...extra.map(x => FIX[x][0])];
    return { parts, kcal: Math.round(kcal / 10) * 10, prot: Math.round(prot) };
  }

  /* ---------- training ---------- */
  const T = {
    'gym-m': [
      ['אימון A', [['סקוואט עם מוט', '3 × 8-10', '2 דק׳', 'גב ישר, ירידה עד שהירך מקבילה לרצפה'], ['לחיצת חזה במוט', '3 × 8-10', '90 שנ׳', 'השכמות צמודות לספסל'], ['חתירה בכבל בישיבה', '3 × 10-12', '75 שנ׳', 'מושכים עם המרפקים, לא עם הידיים'], ['לחיצת כתפיים במשקולות', '3 × 10-12', '75 שנ׳', 'בטן אסופה, בלי לקשת את הגב'], ['כפיפת מרפקים במשקולות', '2 × 12', '60 שנ׳', 'מרפקים צמודים לגוף'], ['פלאנק', '3 × 30-45 שנ׳', '45 שנ׳', 'גוף בקו ישר מהראש לעקבים']]],
      ['אימון B', [['דדליפט רומני', '3 × 8-10', '2 דק׳', 'האגן זז אחורה, המוט קרוב לרגליים'], ['פולי עליון', '3 × 10-12', '75 שנ׳', 'מושכים לחזה העליון'], ['לחיצת חזה בשיפוע במשקולות', '3 × 10-12', '90 שנ׳', 'ירידה איטית ומבוקרת'], ['מכרעים עם משקולות', '3 × 10 לכל רגל', '75 שנ׳', 'הברך הקדמית מעל הקרסול'], ['פשיטת מרפקים בכבל', '2 × 12', '60 שנ׳', 'רק האמה זזה'], ['הרמות ברכיים בתלייה', '3 × 10-12', '60 שנ׳', 'בלי להתנדנד']]],
    ],
    'gym-f': [
      ['אימון A', [['סקוואט גביע', '3 × 10-12', '90 שנ׳', 'משקולת צמודה לחזה, ירידה עמוקה'], ['היפ טראסט', '3 × 10-12', '90 שנ׳', 'עוצרים שנייה למעלה'], ['פולי עליון', '3 × 10-12', '75 שנ׳', 'מושכים לחזה העליון'], ['לחיצת כתפיים במשקולות', '3 × 10-12', '75 שנ׳', 'בטן אסופה'], ['פלאנק', '3 × 30-45 שנ׳', '45 שנ׳', 'גוף בקו ישר']]],
      ['אימון B', [['דדליפט רומני במשקולות', '3 × 10-12', '90 שנ׳', 'האגן זז אחורה, גב ישר'], ['מכרעים לאחור', '3 × 10 לכל רגל', '75 שנ׳', 'צעד ארוך ויציב'], ['חתירה במשקולת ביד אחת', '3 × 10-12', '75 שנ׳', 'מושכים עם המרפק'], ['לחיצת חזה במשקולות', '3 × 10-12', '75 שנ׳', 'ירידה איטית'], ['כפיפות בטן על מזרן', '3 × 15', '45 שנ׳', 'עולים עם הבטן, לא עם הצוואר']]],
    ],
    'home-m': [
      ['אימון A', [['שכיבות סמיכה', '4 × מקסימום פחות 2', '60 שנ׳', 'אפשר על הברכיים בהתחלה'], ['סקוואט במשקל גוף', '4 × 15-20', '60 שנ׳', 'עקבים על הרצפה'], ['מכרעים לסירוגין', '3 × 12 לכל רגל', '60 שנ׳', 'גב זקוף'], ['גשר עכוז', '3 × 15-20', '45 שנ׳', 'עוצרים שנייה למעלה'], ['פלאנק', '3 × 30-45 שנ׳', '45 שנ׳', 'גוף בקו ישר']]],
      ['אימון B', [['שכיבות סמיכה צרות', '3 × מקסימום פחות 2', '60 שנ׳', 'מרפקים צמודים לגוף'], ['סקוואט בולגרי על כיסא', '3 × 10 לכל רגל', '60 שנ׳', 'רגל אחורית על הכיסא'], ['סופרמן', '3 × 12-15', '45 שנ׳', 'מרימים ידיים ורגליים יחד'], ['מטפסי הרים', '3 × 30 שנ׳', '45 שנ׳', 'קצב קבוע'], ['כפיפות בטן', '3 × 15-20', '45 שנ׳', 'עולים עם הבטן']]],
    ],
    'home-f': [
      ['אימון A', [['סקוואט במשקל גוף', '4 × 15-20', '60 שנ׳', 'עקבים על הרצפה'], ['גשר עכוז', '4 × 15-20', '45 שנ׳', 'עוצרים שנייה למעלה'], ['שכיבות סמיכה על הברכיים', '3 × 8-12', '60 שנ׳', 'גוף ישר מהברכיים לראש'], ['מכרעים לסירוגין', '3 × 12 לכל רגל', '60 שנ׳', 'גב זקוף'], ['פלאנק', '3 × 30 שנ׳', '45 שנ׳', 'גוף בקו ישר']]],
      ['אימון B', [['סקוואט בולגרי על כיסא', '3 × 10 לכל רגל', '60 שנ׳', 'רגל אחורית על הכיסא'], ['הרחקות רגל בשכיבה על הצד', '3 × 15 לכל צד', '45 שנ׳', 'תנועה איטית'], ['סופרמן', '3 × 12-15', '45 שנ׳', 'מרימים ידיים ורגליים יחד'], ['מטפסי הרים', '3 × 30 שנ׳', '45 שנ׳', 'קצב קבוע'], ['כפיפות בטן', '3 × 15', '45 שנ׳', 'עולים עם הבטן']]],
    ],
  };

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

  function mealsHtml(t) {
    return MEALS.map(meal => {
      const k = t.kcal * meal.share, p = t.prot * meal.share;
      const opts = meal.opts.map((o, i) => { const r = buildOption(o, k, p); return `<li><span class="opt__n">${i + 1}</span><span>${r.parts.join(' · ')}<small>כ-${r.kcal} קלוריות · ${r.prot} גרם חלבון</small></span></li>`; }).join('');
      return `<article class="meal"><header><h3>${meal.n}</h3><span>${Math.round(meal.share * 100)}% · כ-${Math.round(k / 10) * 10} קלוריות</span></header><p class="meal__pick">בוחרים אפשרות אחת:</p><ol class="opts">${opts}</ol></article>`;
    }).join('') + `<article class="meal"><header><h3>ארוחת ביניים</h3><span>10% · עד ${Math.round(t.kcal * .1 / 10) * 10} קלוריות</span></header><p class="meal__pick">בוחרים אחד:</p><ul class="snacks">${SNACKS.map(s => `<li>${s}</li>`).join('')}</ul></article>`;
  }

  function viewMenu() {
    document.title = `תפריט ${words.goal} ${words.who} | SMITHFIT`;
    app.innerHTML = `<p class="notice"><a class="notice__back" href="${V.slug}${location.search}">${ico('i-back')}חזרה לתוכנית</a></p>
    <main class="paper doc"><div class="wrap sec">
      <div class="sec__head"><p class="eyebrow">${chip}</p><h2>תפריט ${words.goal} ${words.who}</h2><p class="doc__lead">התפריט מחושב לפי הנתונים שלך. אפשר לשנות אותם כאן והכל מתעדכן לבד.</p></div>
      <div class="calc">
        <label>משקל (ק״ג)<input class="field" id="c-w" inputmode="numeric" value="${person.w}"></label>
        <label>גובה (ס״מ)<input class="field" id="c-h" inputmode="numeric" value="${person.h}"></label>
        <label>גיל<input class="field" id="c-a" inputmode="numeric" value="${person.a}"></label>
      </div>
      <div id="menu-body"></div>
    </div></main>`;
    const draw = () => {
      const p = { w: Number($('#c-w').value) || person.w, h: Number($('#c-h').value) || person.h, a: Number($('#c-a').value) || person.a };
      $('#menu-body').innerHTML = menuBody(targets(p));
    };
    ['#c-w', '#c-h', '#c-a'].forEach(s => $(s).addEventListener('input', draw));
    draw();
  }

  function menuBody(t) {
    return `<div class="stats">
        <div><b>${t.kcal.toLocaleString('he-IL')}</b><span>קלוריות ביום</span></div>
        <div><b>${t.prot}</b><span>גרם חלבון</span></div>
        <div><b>${t.carb}</b><span>גרם פחמימה</span></div>
        <div><b>${t.fat}</b><span>גרם שומן</span></div>
      </div>
      <p class="doc__note">איך הגענו לזה: הגוף שלך שורף כ-${t.tdee.toLocaleString('he-IL')} קלוריות ביום (${t.bmr.toLocaleString('he-IL')} במנוחה, כפול 1.375 לפעילות קלה). ${V.cut ? 'לחיטוב מורידים 15%' : 'לעלייה במסה מוסיפים 20%'}, וחלבון מחשבים 1.8 גרם לכל ק״ג משקל.</p>
      ${mealsHtml(t)}
      <article class="meal meal--tips"><header><h3>חשוב לדעת</h3></header><ul class="snacks">
        <li>שוקלים את האוכל אחרי בישול, לפי מה שכתוב בתפריט.</li>
        <li>ירקות חופשי, עד 250 גרם בארוחה. הם נותנים נפח ושובע כמעט בלי קלוריות.</li>
        <li>2.5 עד 3 ליטר מים ביום, ולפחות 8,000 צעדים.</li>
        <li>שיטת 90/10 של סמית': 90% מהזמן לפי התפריט, 10% מהזמן לחיים. ארוחת שישי לא הורסת כלום.</li>
      </ul></article>
      <p class="doc__legal">התפריט הוא דוגמה כללית שמחושבת לפי הנתונים שהזנת, ואינו מותאם אישית להעדפות, למצב רפואי או לרגישויות. אינו מהווה ייעוץ רפואי או תזונתי.</p>
      ${ctaBlock()}`;
  }

  function viewTraining() {
    document.title = `תוכנית אימונים ${words.place} | SMITHFIT`;
    const plan = T[(V.gym ? 'gym-' : 'home-') + (V.male ? 'm' : 'f')];
    const table = ([name, rows]) => `<article class="meal"><header><h3>${name}</h3><span>${rows.length} תרגילים · כ-45 דקות</span></header>
      <ol class="ex">${rows.map(([n, sets, rest, tip]) => `<li><div><strong>${n}</strong><small>${tip}</small></div><span class="ex__s">${sets}</span><span class="ex__r">מנוחה ${rest}</span></li>`).join('')}</ol></article>`;
    app.innerHTML = `<p class="notice"><a class="notice__back" href="${V.slug}${location.search}">${ico('i-back')}חזרה לתוכנית</a></p>
    <main class="paper doc"><div class="wrap sec">
      <div class="sec__head"><p class="eyebrow">${chip}</p><h2>תוכנית אימונים ${V.gym ? 'בחדר כושר' : 'בבית'}</h2><p class="doc__lead">3 אימונים בשבוע, עם יום מנוחה ביניהם. מחליפים בין אימון A לאימון B.</p></div>
      <div class="week"><div><b>שבוע 1</b><span>א׳ · A</span><span>ג׳ · B</span><span>ה׳ · A</span></div><div><b>שבוע 2</b><span>א׳ · B</span><span>ג׳ · A</span><span>ה׳ · B</span></div></div>
      <article class="meal meal--tips"><header><h3>חימום, 5 דקות</h3></header><ul class="snacks"><li>2 דקות הליכה מהירה או קפיצות במקום</li><li>10 סיבובי ידיים, 10 סקוואטים בלי משקל, 10 מכרעים</li></ul></article>
      ${plan.map(table).join('')}
      <article class="meal meal--tips"><header><h3>איך מתקדמים</h3></header><ul class="snacks">
        <li>כשמצליחים לבצע את כל החזרות בכל הסטים, מוסיפים מעט משקל או 2 חזרות בשבוע הבא.</li>
        <li>טכניקה לפני משקל. עדיף פחות חזרות ונקיות.</li>
        <li>כאב חד או בפרק? עוצרים. שרירים תפוסים למחרת זה תקין.</li>
      </ul></article>
      <p class="doc__legal">התוכנית כללית ואינה מותאמת אישית. לפני תחילת פעילות גופנית מומלץ להתייעץ עם רופא, בעיקר אם יש מגבלה רפואית.</p>
      ${ctaBlock()}
    </div></main>`;
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
