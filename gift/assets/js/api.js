// Sends each funnel stage to /api/gift (this site's own server, which forwards it to the CRM). Used by /gift and /lp.
(function () {
  const tracking = {};
  new URLSearchParams(location.search).forEach((v, k) => {
    if (/^(utm_[a-z]+|fbclid|ref)$/.test(k)) tracking[k] = v.slice(0, 300);
  });
  const ERRORS = { invalid_phone: 'מספר הטלפון לא תקין. בדוק/י ונסה/י שוב.', invalid_name: 'צריך למלא שם.', rate_limited: 'יותר מדי ניסיונות. נסה/י שוב בעוד דקה.' };

  // /gift/plan/<man|woman>-<weight-loss|mass>[-no-gym]-<height>-<weight>-<age>, the same link the WhatsApp button opens
  function planSlug(q) {
    const sex = q.gender === 'אישה' ? 'woman' : 'man';
    const goal = q.goal === 'לעלות במסה' ? 'mass' : 'weight-loss';
    const gym = /אין לי/.test(q.gym || '') ? '-no-gym' : '';
    return `${sex}-${goal}${gym}-${q.height}-${q.weight}-${q.age}`;
  }

  async function send(payload, eventId) {
    try {
      const r = await fetch('/api/gift', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...payload, tracking: eventId ? { ...tracking, lead_event_id: eventId } : tracking, website: '' }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) return { ok: true };
      return { ok: false, message: ERRORS[j.error] || 'משהו השתבש בשליחה. נסה/י שוב בעוד רגע.' };
    } catch {
      return { ok: false, message: 'אין חיבור לאינטרנט כרגע. נסה/י שוב בעוד רגע.' };
    }
  }

  window.GiftApi = { send, planSlug };
})();
