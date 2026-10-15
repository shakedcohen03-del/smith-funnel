// דף הנחיתה: חשיפה עדינה בגלילה, ספירה של המספרים, וצל לפס העליון. בלי JS הכל גלוי וסופי.
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const root = document.documentElement;

// חשיפה בגלילה: רק transform ו-opacity. מה שכבר בתוך המסך או מעליו מוצג מיד
const items = [...document.querySelectorAll("[data-reveal]")];
if (!reduced && "IntersectionObserver" in window && items.length) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting && e.boundingClientRect.top > 0) continue;
        e.target.classList.add("is-in");
        io.unobserve(e.target);
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
  );
  const vh = innerHeight;
  for (const el of items) {
    if (el.getBoundingClientRect().top < vh * 0.92) el.classList.add("is-in");
    else io.observe(el);
  }
  root.classList.add("reveal-on");
}

// ספירה של הסטטיסטיקה. הערך הסופי כבר כתוב ב-HTML, כאן רק האנימציה
const counters = [...document.querySelectorAll("[data-count]")];
function countUp(el) {
  const final = el.textContent.trim();
  const m = final.match(/^(\D*)([\d,]+)(\D*)$/);
  if (!m) return;
  const [, pre, num, post] = m;
  const target = Number(num.replace(/,/g, ""));
  const fmt = (n) => pre + (num.includes(",") ? n.toLocaleString("en-US") : String(n)) + post;
  const dur = 1600;
  const t0 = performance.now();
  el.style.minWidth = el.offsetWidth + "px";
  const tick = (t) => {
    const p = Math.min(1, (t - t0) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = p < 1 ? fmt(Math.round(target * eased)) : final;
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
if (!reduced && "IntersectionObserver" in window && counters.length) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        countUp(e.target);
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0 }
  );
  counters.forEach((el) => io.observe(el));
}

// צל עדין לפס העליון אחרי שמתחילים לגלול
const top = document.getElementById("top");
if (top) {
  const onScroll = () => top.classList.toggle("is-scrolled", scrollY > 8);
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

// סרטוני העדויות: התמונה מתחלפת בנגן רק בלחיצה, כדי שהדף לא יטען וידאו מראש
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest("button.short[data-video]");
  if (!b) return;
  const v = document.createElement("video");
  v.src = b.dataset.video;
  v.poster = b.querySelector("img") ? b.querySelector("img").currentSrc || b.querySelector("img").src : "";
  v.controls = true;
  v.autoplay = true;
  v.playsInline = true;
  v.setAttribute("playsinline", "");
  v.className = "short__player";
  v.setAttribute("aria-label", b.getAttribute("aria-label") || "סרטון");
  b.replaceWith(v);
  const p = v.play();
  if (p && p.catch) p.catch(() => {});
});
