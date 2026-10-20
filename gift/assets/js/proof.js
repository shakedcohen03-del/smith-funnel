// Proof blocks shared by every page: before/after grid, client videos, messages, FAQ, faces row.
(function () {
  const RESULTS = ['p4', 't7', 'p6', 'daniel', 'p7', 't1', 't4', 't5', 't2', 't3', 't8', 't6'];
  const FACES = ['p4', 't7', 'p6', 'daniel', 'p7', 't1', 't4', 't5', 't2'];
  const VIDEOS = [
    { id: 'v2', cap: 'יניב · ירד 12 ק״ג בשלושה חודשים' },
    { id: 'v7', cap: '"ירדתי 20 קילו"' },
    { id: 'v3', cap: 'אורי · "הורדתי בסביבות 32 קילו"' },
    { id: 'v1', cap: '105 ק״ג ← 90 ק״ג בשלושה חודשים' },
    { id: 'v4', cap: '"סופר מקצועי"' },
    { id: 'v6', cap: '"זו לא עוד תוכנית אונליין"' },
    { id: 'v5', cap: 'עוד כמה מהשינויים' },
  ];
  const SHORTS = ['6Bv75odFMVw', 'MFsxB8JP1_s', 'hv9WOOuPMWw'];
  // real WhatsApp messages from clients, word for word (owner sent them 20.10). Never add invented ones.
  const WA = [
    "אז אחרי חצי שנה ו6.5 קילו פחות רציתי להגיד לכם קטי וסמיט תודה מכל הלב \nמבחינתי לקבל בתוכנית מאמן צמוד  ותזונאית צמודה זה שילוב מנצח להשגת תוצאות, נכון אי אפשר לאכול מה שרוצים מתי שרוצים חייב משמעת עצמית ולהקדיש זמן לאימונים, אבל גם לא צריך לאכול חסה כל היום לא עשיתי אף פעם תוכנית אונליין והיו לי חששות בהתחלה, אבל פשוט לא עזבתם אותי לרגע לבד ומהר מאוד תוצאות הגיעו. אין קיצורי קטי וסמיט אתכם בהחלט רואים משקל שיורד גוף שמתחזק ואורח חיים בריא❤️❤️❤️❤️",
    "רוצה לפרגן מכל הלב למאמן כושר ומלווה תזונאית אלופים! 💪❤️\n\nהצלחתי להגיע לתוצאות מדהימות ולרדת במשקל. קיבלתי ביטחון עצמי, כוח ורצון להתמיד .\n\nתודה על הליווי המקצועי, המוטיבציה והתמיכה לאורך כל הדרך. תודה על הסבלנות ועל הדחיפה קדימה, היה מאתגר אך שווה. אין ספק שההצלחה הזו היא גם בזכותך! 🙏🔥\n\nממליץ לכל מי שרוצה לעשות שינוי אמיתי ולהגיע לתוצאות! 🏆",
    "הייתי שוקל 95.20 וחלטתי לעשות שינוי אז סמית קפץ לי במודעות חלטתי לקחת את עצמי בשתי ידים לקחתי את הליוי בהתחלה הייתי מתקשה לעשות כל מיני דברים אם הזמן התחלתי להתחזק לאוכל נכון בזכות הליוי למדתי רבה דברים על עצמי ועל אוכל ממליץ בחום למי שרוצה לעשות שינוי 🙏🏽",
    "קודם כל הכי טוב התהליך זה המענה המהיר, לכל שאלה או תהייה יש מענה מיידי, התמיכה היא באמת מעולה.\n\nירדיתי קרוב מעל15 קילו (עדיין לא ביעד הקוביות) אבל זה כבר בדרך... \n\nהתפריט מאוד ברור"
  ];
  const FAQ = [
    ['כבר ניסיתי לרדת במשקל ולא הצלחתי, במה זה שונה?', 'כי עד היום עשית את זה לבד, עם תוכנית שלא נבנתה לחיים שלך. כאן מקבלים תפריט ותוכנית אימונים שנבנים בדיוק בשבילך, בקרה כל שבוע, וקו ישיר לסמית\' בוואטסאפ שמחזיק אותך דווקא כשקשה.'],
    ['באמת לא צריך לספור קלוריות?', 'באמת! התפריט כבר מחושב בשבילך, עם כמויות פשוטות של אוכל שאתה אוהב. אתה רק שולח לנו כל יום מה אכלת, ואנחנו רואים, מכוונים ומתקנים במקומך.'],
    ['מה אם אני עמוס ואין לי זמן?', 'בדיוק בשביל זה נבנה הליווי. אימונים קצרים ויעילים, אוכל פשוט שמכינים בכמה דקות, והכל מותאם לשבוע האמיתי שלך, עם העבודה, הילדים והאירועים. לא הפוך.'],
    ['זה מתאים גם למי שמתחיל מאפס?', 'ברור! רוב המתאמנים שלנו התחילו בלי שום ניסיון. התוכנית נבנית לפי הרמה שלך היום, ומתקדמת איתך מחודש לחודש.'],
    ['זה עובד גם אם אין לי חדר כושר?', 'כן! נבנה לך תוכנית אימונים לבית או לחדר כושר, לפי הציוד, המקום והזמן שיש לך באמת. ככה תמיד יהיה לך איך להתאמן, גם כשהשבוע משתבש.'],
    ['אני כבר לא צעיר. זה עדיין אפשרי?', 'בהחלט. חלק גדול מהמתאמנים של סמית\' הם בני 40 ו-50 פלוס, ויש מתאמן שהתחיל בגיל 80.'],
    ['איך הליווי עובד בפועל, מי עונה לי?', 'מתחילים בשיחת אבחון אישית ומקבלים תפריט ותוכנית אימונים אישיים. כל יום שולחים מה אכלת, כל שבוע עושים בקרה והתאמות, ויש קו ישיר לסמית\' בוואטסאפ. לא בוט ולא נציג.'],
    ['כמה זה עולה?', 'יש כמה מסלולים, ובשיחת ההתאמה נבחר יחד את המסלול שנכון לך. מי שמצטרף אחרי השיחה מקבל 3 חודשים נוספים בחינם, ובמסלולים של 6 חודשים ומעלה יש גם אחריות מלאה: עשית את העבודה ולא הגעת למטרה שלך, כל הכסף חוזר אליך.'],
  ];

  const PLAY = '<svg class="ico" aria-hidden="true"><use href="#i-play"/></svg>';
  const img = (src, alt, extra = '') => `<img src="${src}" alt="${alt}" loading="lazy"${extra}>`;

  function results(el) {
    const n = Number(el.dataset.results) || RESULTS.length;
    el.innerHTML = RESULTS.slice(0, n).map(id => `
      <figure class="ba__card">
        <div class="ba__pics">${img(`/gift/assets/img/results/${id}-before.webp`, 'לפני')}${img(`/gift/assets/img/results/${id}-after.webp`, 'אחרי')}</div>
        <span class="ba__badge">SMITH<b>FIT</b></span>
        <figcaption class="ba__bar"><span>לפני</span><i class="ba__line" aria-hidden="true"></i><span>אחרי</span></figcaption>
      </figure>`).join('');
  }

  function videos(el) {
    el.innerHTML = VIDEOS.map(v => `
      <figure class="vcard">
        <div class="vcard__box" data-src="/gift/assets/video/${v.id}.mp4">
          ${img(`/gift/assets/video/${v.id}.webp`, '')}
          <button class="play" type="button" aria-label="הפעלת הסרטון: ${v.cap.replace(/"/g, '')}"><span>${PLAY}</span></button>
        </div>
        <figcaption>${v.cap}</figcaption>
      </figure>`).join('');
  }

  function msgs(el) {
    el.innerHTML = `<figure class="msg">${img('/gift/assets/img/media/daniel-msg.webp', 'הודעה ממתאמן שמתאמן בחדרי כושר מעל 60 שנה וממליץ על סמית\'')}<figcaption>דניאל, מתאמן כבר מעל 60 שנה, על הליווי של סמית'</figcaption></figure>
      <div class="shorts">${SHORTS.map(id => `<a class="short" href="https://www.youtube.com/shorts/${id}" target="_blank" rel="noopener" aria-label="סיפור של מתאמן ביוטיוב">${img(`/gift/assets/img/media/short-${id}-540.webp`, '')}<span>${PLAY}</span></a>`).join('')}</div>`;
  }

  const esc = t => t.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  function wa(el) {
    el.innerHTML = WA.map(t => `<figure class="wa"><div class="wa__b">${esc(t)}</div><figcaption>הודעה ממתאמן בוואטסאפ</figcaption></figure>`).join('');
  }

  function faq(el) {
    el.innerHTML = FAQ.map(([q, a]) => `<details><summary>${q}<svg class="ico" aria-hidden="true"><use href="#i-plus"/></svg></summary><p>${a}</p></details>`).join('');
  }

  function faces(el) {
    el.insertAdjacentHTML('afterbegin', `<div class="faces__row">${FACES.slice(0, 6).map(id => `<img src="/gift/assets/img/media/av-${id}.webp" alt="" width="38" height="38" loading="lazy">`).join('')}</div>`);
  }

  // click-to-play: local videos and YouTube
  document.addEventListener('click', e => {
    const card = e.target.closest('.vcard__box .play');
    if (card) {
      const box = card.parentElement;
      document.querySelectorAll('video').forEach(v => v.pause());
      box.innerHTML = `<video src="${box.dataset.src}" controls autoplay playsinline></video>`;
      return;
    }
    const yt = e.target.closest('[data-yt] .play');
    if (yt) {
      const box = yt.parentElement;
      box.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${box.dataset.yt}?autoplay=1&rel=0" title="כתבה על סמית'" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
    }
  });
  document.addEventListener('play', e => {
    document.querySelectorAll('video').forEach(v => { if (v !== e.target) v.pause(); });
  }, true);

  window.Proof = {
    render(root = document) {
      root.querySelectorAll('[data-results]:not([data-done])').forEach(el => { results(el); el.dataset.done = 1; });
      root.querySelectorAll('[data-videos]:not([data-done])').forEach(el => { videos(el); el.dataset.done = 1; });
      root.querySelectorAll('[data-msgs]:not([data-done])').forEach(el => { msgs(el); el.dataset.done = 1; });
      root.querySelectorAll('[data-wa]:not([data-done])').forEach(el => { wa(el); el.dataset.done = 1; });
      root.querySelectorAll('[data-faq]:not([data-done])').forEach(el => { faq(el); el.dataset.done = 1; });
      root.querySelectorAll('[data-faces]:not([data-done])').forEach(el => { faces(el); el.dataset.done = 1; });
    },
  };
})();
