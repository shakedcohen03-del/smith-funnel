// Meta pixel on every page (the same pixel as /start, "הפיקסל של סמית וקטי"): PageView on load, Lead when the
// lead is created, CompleteRegistration when the last form goes out. No automatic events (they send button texts
// to Meta) and no PageView per pushState step. Off on localhost so previews do not pollute campaign data.
(function () {
  const ID = '1368937164234363';
  const local = location.protocol === 'file:' || /^(localhost|127\.|0\.0\.0\.0|192\.168\.)/.test(location.hostname);
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(16) + Math.random().toString(16).slice(2));

  if (!local && !window.fbq) {
    const n = (window.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); });
    if (!window._fbq) window._fbq = n;
    n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
    n.disablePushState = true;
    window.fbq('set', 'autoConfig', false, ID);
    window.fbq('init', ID);
    window.fbq('track', 'PageView');
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(s);
  }

  // advanced matching from what the person typed, then the event (eventID is also sent to the CRM)
  function track(event, user, eventID) {
    if (!window.fbq) return;
    const am = { country: 'il' };
    const d = String(user.phone || '').replace(/\D/g, '');
    if (d) am.ph = d.startsWith('972') ? d : '972' + d.replace(/^0/, '');
    if (user.email) am.em = String(user.email).trim().toLowerCase();
    const [fn, ...rest] = String(user.name || '').trim().toLowerCase().split(/\s+/);
    if (fn) am.fn = fn;
    if (rest.length) am.ln = rest.join(' ');
    window.fbq('init', ID, am);
    window.fbq('track', event, {}, { eventID });
  }

  window.Px = { track, uuid };
})();
