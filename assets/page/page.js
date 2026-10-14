// Variant B page behaviors: reveals and photo wipes, counters, marquee control, before/after slider,
// results carousel, sticky mobile CTA, header state, smooth FAQ and a magnetic CTA on fine pointers.
// No app data is stored anywhere. The quiz itself lives in /assets/js/flow.js.
const d = document;
const H = d.documentElement;
const $ = (s, r = d) => r.querySelector(s);
const $$ = (s, r = d) => [...r.querySelectorAll(s)];
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
if (navigator.connection?.saveData) H.classList.add("save-data");

// a stable viewport unit for the hero: refreshed only when the width changes, never on toolbar moves
// (the first width comes from the head script, so nothing here forces a layout at load)
let lastW = window.__vw0 || 0;
addEventListener("resize", () => {
  if (innerWidth === lastW) return;
  lastW = innerWidth;
  H.style.setProperty("--vh", innerHeight / 100 + "px");
});

// ---------- reveals, wipes, counters ----------
// Content is hidden only under html.io, which this file adds itself. If this script never runs, or the
// observer never answers (watchdog below), the page simply stays fully visible.
const motion = !reduce && "IntersectionObserver" in window;
if (motion) H.classList.add("io");
for (const g of $$("[data-stagger]")) $$("[data-reveal]", g).forEach((el, i) => el.style.setProperty("--i", i));

// section headlines: each word rises out of its own mask (text only, the h1 is never touched)
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
if (motion) {
  for (const h of $$(".display, .final__title")) {
    let i = 0;
    const out = [];
    for (const n of [...h.childNodes]) {
      if (n.nodeType === 3) {
        for (const w of n.textContent.split(/(\s+)/)) {
          if (/^\s+$/.test(w)) out.push(" ");
          else if (w) out.push(`<span class="w"><span class="wi" style="--wi:${i++}">${esc(w)}</span></span>`);
        }
      } else if (n.nodeType === 1) {
        // a marked word keeps its markup and rises without a mask, so its green block is never clipped
        out.push(`<span class="w w--el"><span class="wi" style="--wi:${i++}">${n.outerHTML}</span></span>`);
      }
    }
    h.innerHTML = out.join("");
    h.classList.add("split");
  }
}

// counters below the fold start from 0 (the real value stays in the markup for screen readers); asked
// through an observer so the load never forces a layout of the skipped sections
const counters = $$("[data-count]");
if (motion) {
  const zero = new IntersectionObserver((es) => {
    for (const e of es) if (!e.isIntersecting) e.target.textContent = "0";
    zero.disconnect();
  });
  counters.forEach((c) => zero.observe(c));
}

function countUp(el) {
  const to = Number(el.dataset.count);
  if (reduce || el.textContent === String(to)) { el.textContent = to; return; }
  const t0 = performance.now();
  const tick = (t) => {
    const k = Math.min(1, (t - t0) / 1600);
    el.textContent = k === 1 ? to : Math.round(to * (1 - Math.pow(2, -10 * k)));
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

if (motion) {
  let alive = false;
  const io = new IntersectionObserver((entries) => {
    alive = true;
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add("in");
      io.unobserve(e.target);
      if (e.target.dataset.count !== undefined) countUp(e.target);
    }
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
  $$("[data-reveal], .wipe, .label, .steps, .split, [data-count]").forEach((el) => io.observe(el));
  // watchdog: an observer that never reports back must not leave the page hidden
  setTimeout(() => { if (!alive) H.classList.remove("io"); }, 3000);

  // keyboard focus reveals a block at once, without its stagger delay (no invisible focus near the bottom edge)
  addEventListener("focusin", (e) => {
    const el = e.target.closest?.("[data-reveal]");
    if (!el) return;
    el.classList.add("in");
    // also ends a reveal that is still waiting out its stagger delay
    el.getAnimations?.().forEach((a) => a.finish());
  });

  // the pain lines light up one by one as they pass the upper two thirds of the screen
  const lit = new IntersectionObserver((es) => {
    for (const e of es) if (e.isIntersecting) { e.target.classList.add("on"); lit.unobserve(e.target); }
  }, { rootMargin: "0px 0px -32% 0px", threshold: 0.6 });
  $$(".pain__list li").forEach((el) => lit.observe(el));

  // how it works (phones): the line fills as you read and each step lights up when the line reaches it
  const steps = $(".steps");
  const narrow = matchMedia("(max-width: 1023px)");
  if (steps) {
    const items = $$(".step", steps);
    let queued = false;
    const fillSteps = () => {
      queued = false;
      if (!narrow.matches) return items.forEach((it) => it.classList.add("on"));
      const r = steps.getBoundingClientRect(), mid = innerHeight * 0.62;
      const p = Math.max(0, Math.min(1, (mid - r.top - 10) / Math.max(1, r.height - 50)));
      steps.style.setProperty("--p", p.toFixed(4));
      for (const it of items) it.classList.toggle("on", it.getBoundingClientRect().top + 28 <= mid);
    };
    const onScroll = () => { if (!queued) { queued = true; requestAnimationFrame(fillSteps); } };
    let watching = false;
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting === watching) return;
      watching = e.isIntersecting;
      if (watching) addEventListener("scroll", onScroll, { passive: true });
      else removeEventListener("scroll", onScroll);
      onScroll();
    }, { rootMargin: "20% 0px 20% 0px" }).observe(steps);
  }
}

// ---------- marquee: visible pause button, and no work while off screen ----------
const mq = $("#mq");
if (mq) {
  const b = $(".mq__pause", mq);
  b.addEventListener("click", () => b.setAttribute("aria-pressed", String(mq.classList.toggle("is-paused"))));
  new IntersectionObserver(([e]) => mq.classList.toggle("is-off", !e.isIntersecting)).observe(mq);
}

// ---------- before/after drag compare (before on the right, after on the left) ----------
const ba = $("[data-ba]");
if (ba) {
  const range = $(".ba__range", ba);
  let touched = false, down = false, drag = false, sx = 0, sy = 0;
  const set = (p) => {
    p = Math.max(0, Math.min(100, p));
    ba.style.setProperty("--pos", p + "%");
    range.value = Math.round(p);
  };
  const at = (x) => {
    const r = ba.getBoundingClientRect();
    return ((x - r.left) / r.width) * 100;
  };
  const grab = (e) => {
    drag = true;
    ba.setPointerCapture(e.pointerId);
    ba.classList.add("is-drag");
  };
  ba.addEventListener("pointerdown", (e) => {
    if (e.button > 0) return;
    touched = down = true;
    sx = e.clientX; sy = e.clientY; drag = false;
    // touch waits for a clearly sideways move, so a vertical scroll never jumps the line
    if (e.pointerType === "mouse") { grab(e); set(at(e.clientX)); }
  });
  ba.addEventListener("pointermove", (e) => {
    if (!down) return;
    if (!drag) {
      const dx = Math.abs(e.clientX - sx), dy = Math.abs(e.clientY - sy);
      if (dx < 6 || dx < dy) return;
      grab(e);
    }
    set(at(e.clientX));
  });
  const end = (e) => {
    if (down && !drag && e.type === "pointerup") set(at(e.clientX));
    down = drag = false;
    ba.classList.remove("is-drag");
  };
  ba.addEventListener("pointerup", end);
  ba.addEventListener("pointercancel", end);
  range.addEventListener("input", () => { touched = true; set(Number(range.value)); });

  // one gentle nudge the first time it is on screen, so people see it moves
  if (!reduce) {
    new IntersectionObserver(([e], o) => {
      if (!e.isIntersecting) return;
      o.disconnect();
      const keys = [50, 35, 63, 50], seg = 560;
      const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
      let t0 = 0;
      const step = (t) => {
        if (touched) return;
        t0 = t0 || t;
        const pos = (t - t0) / seg, i = Math.floor(pos);
        if (i >= keys.length - 1) return set(50);
        set(keys[i] + (keys[i + 1] - keys[i]) * ease(pos - i));
        requestAnimationFrame(step);
      };
      setTimeout(() => requestAnimationFrame(step), 500);
    }, { threshold: 0.55 }).observe(ba);
  }
}

// ---------- results carousel (RTL: scrollLeft runs from 0 to negative) ----------
const track = $(".car__track");
if (track) {
  const prev = $(".car__prev"), next = $(".car__next"), thumb = $(".car__prog i");
  const stepW = () => {
    const a = track.children[0], b = track.children[1];
    return a && b ? Math.abs(b.getBoundingClientRect().left - a.getBoundingClientRect().left) : track.clientWidth * 0.8;
  };
  const go = (dir) => track.scrollBy({ left: dir * stepW(), behavior: reduce ? "auto" : "smooth" });
  prev.addEventListener("click", () => go(1));
  next.addEventListener("click", () => go(-1));
  let raf = 0;
  const update = () => {
    raf = 0;
    // a tab stop only while there is something to scroll (desktop shows the whole grid)
    if (track.scrollWidth - track.clientWidth > 4) track.tabIndex = 0;
    else track.removeAttribute("tabindex");
    const max = Math.max(1, track.scrollWidth - track.clientWidth);
    const x = Math.min(max, Math.abs(track.scrollLeft));
    prev.disabled = x < 4;
    next.disabled = x > max - 4;
    const vis = Math.min(1, track.clientWidth / track.scrollWidth);
    thumb.style.transform = `translateX(${-(x / max) * (1 - vis) * 100}%) scaleX(${vis})`;
  };
  track.addEventListener("scroll", () => { raf = raf || requestAnimationFrame(update); }, { passive: true });
  // fires once at start, again when page.css (loaded async) turns the list into a row, and on every resize
  new ResizeObserver(() => update()).observe(track);
}

// ---------- sticky mobile CTA: after the hero CTA, hidden once the final CTA button itself and the footer are on screen ----------
const bar = $("#sticky");
const heroCta = $(".hero__cta");
if (bar && heroCta) {
  let past = false;
  const atEnd = new Map();
  const update = () => bar.classList.toggle("is-on", past && ![...atEnd.values()].some(Boolean));
  new IntersectionObserver(([e]) => {
    past = !e.isIntersecting && e.boundingClientRect.top < 0;
    update();
  }).observe(heroCta);
  const endIo = new IntersectionObserver((es) => {
    for (const e of es) atEnd.set(e.target, e.isIntersecting);
    update();
  }, { rootMargin: "0px 0px -8% 0px" });
  for (const el of [$(".final__cta"), $("#ftr")]) if (el) endIo.observe(el);
}

// ---------- desktop header gets a solid background once the page moves ----------
const hdr = $("#hdr");
let ticking = false;
const onScroll = () => {
  ticking = false;
  hdr.classList.toggle("is-scrolled", scrollY > 30);
};
addEventListener("scroll", () => {
  if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
}, { passive: true });
onScroll();

// ---------- FAQ: smooth open and close ----------
for (const q of $$(".qa")) {
  const sum = $("summary", q), ans = $(".qa__a", q);
  sum.addEventListener("click", (e) => {
    if (reduce || !ans.animate) return;
    e.preventDefault();
    if (q.dataset.busy) return;
    q.dataset.busy = "1";
    const opening = !q.open;
    if (opening) q.open = true;
    const h = ans.scrollHeight;
    const frames = [{ height: "0px", opacity: 0 }, { height: h + "px", opacity: 1 }];
    const anim = ans.animate(opening ? frames : frames.reverse(), {
      duration: opening ? 460 : 340, easing: "cubic-bezier(.2,.7,.2,1)", fill: "forwards",
    });
    anim.onfinish = () => {
      if (!opening) q.open = false;
      anim.cancel();
      delete q.dataset.busy;
    };
  });
}

// ---------- magnetic CTA (mouse only): drifts up to 6px toward a cursor within 80px ----------
if (fine && !reduce) {
  const mags = $$(".btn--magnet");
  let mx = 0, my = 0, queued = false;
  const pull = () => {
    queued = false;
    for (const b of mags) {
      const r = b.getBoundingClientRect();
      if (r.bottom < -100 || r.top > innerHeight + 100) continue;
      const rx = r.width / 2 + 80, ry = r.height / 2 + 80;
      const dx = mx - (r.left + r.width / 2), dy = my - (r.top + r.height / 2);
      b.style.transform = Math.abs(dx) < rx && Math.abs(dy) < ry ? `translate(${((dx / rx) * 6).toFixed(2)}px, ${((dy / ry) * 6).toFixed(2)}px)` : "";
    }
  };
  addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    mx = e.clientX; my = e.clientY;
    if (!queued) { queued = true; requestAnimationFrame(pull); }
  }, { passive: true });
}
