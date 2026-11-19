// (The email sign-up moved to the Spin to Win wheel; this section is now "Get the app".)
// Hero video: stay still for visitors who prefer reduced motion.
const heroVideo = document.querySelector("[data-hero-video]");
if (heroVideo && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  heroVideo.removeAttribute("autoplay");
  heroVideo.pause();
}

// "Plant based nutrition" video: plays on its own on a loop (still for reduced motion).
const loopVideo = document.querySelector("[data-split-video]");
if (loopVideo && window.matchMedia("(prefers-reduced-motion: reduce)").matches) { loopVideo.removeAttribute("autoplay"); loopVideo.pause(); }
else if (loopVideo) { loopVideo.muted = true; const go = () => loopVideo.play().catch(() => {}); loopVideo.readyState > 1 ? go() : loopVideo.addEventListener("loadeddata", go, { once: true }); go(); }
const splitVideo = document.querySelector("[data-split-video]");
const splitPlay = document.querySelector("[data-split-play]");
if (splitVideo && splitPlay) {
  splitPlay.addEventListener("click", () => {
    splitVideo.controls = true;
    splitVideo.play();
    splitPlay.hidden = true;
  });
}

// Real Judge.me rating under the hero button (hidden until there are reviews).
window.NB_reviewSummary.then((data) => {
  const badge = document.querySelector("[data-overall-rating]");
  if (badge && data && data.overall.total) {
    badge.innerHTML = `${window.NB_stars(data.overall.average, 16)} <span>${data.overall.average.toFixed(1)} from ${data.overall.total.toLocaleString("en-US")} happy customers</span>`;
    badge.hidden = false;
  }
});

// Cookbook promo: play (muted) only while on screen; stay still for reduced motion.
const promo = document.querySelector("[data-promo-video]");
if (promo && !window.matchMedia("(prefers-reduced-motion: reduce)").matches && "IntersectionObserver" in window) {
  promo.preload = "metadata";
  new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) promo.play().catch(() => {});
      else promo.pause();
    });
  }, { threshold: 0.35 }).observe(promo);
} else if (promo) {
  promo.controls = true; // let people press play themselves
}

/* ---------- All products carousel (live from Shopify) ---------- */
(function () {
  const track = document.querySelector("[data-pc-track]");
  if (!track) return;
  const dots = document.querySelector("[data-pc-dots]");
  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const thumb = (u) => (u && /cdn\.shopify\.com/.test(u) ? u + (u.includes("?") ? "&" : "?") + "width=600" : u);
  const TAGS = { protein: "Protein", energy: "Energy", hydration: "Hydration", probiotic: "Gut health" };
  const tagOf = (p) => { const k = Object.keys(TAGS).find((x) => p.id.includes(x) || (p.category || "").toLowerCase().includes(x)); return k ? TAGS[k] : p.category || ""; };
  const ORDER = ["vanilla", "chocolate", "strawberry", "cotton", "hydration", "probiotic"];
  const rank = (p) => { const i = ORDER.findIndex((k) => p.id.includes(k)); return i < 0 ? 99 : i; };

  function render() {
    const products = (window.NB_PRODUCTS || []).filter((p) => p.price != null).sort((a, b) => rank(a) - rank(b));
    const bundles = (window.NB_BUNDLES || []).map((b) => window.NB_findItem(b.id)).filter((b) => b && b.price != null);
    const cards = products.map((p) => `
      <article class="pc-card">
        <a class="pc-card__media" href="product.html?handle=${encodeURIComponent(p.id)}">
          ${p.image ? `<img src="${esc(thumb(p.image))}" alt="${esc(p.imageAlt || p.name)}" loading="lazy">` : ""}
          <span class="pc-card__tag">${esc(tagOf(p))}</span>
        </a>
        <button class="fav-btn fav-btn--card" type="button" data-fav-product="${esc(p.id)}" aria-pressed="false" aria-label="Save to favorites"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.9c0 5.4-7.5 10-7.5 10z"/></svg></button>
        <h3 class="pc-card__name"><a href="product.html?handle=${encodeURIComponent(p.id)}">${esc(p.shortName || p.name)}</a></h3>
        <p class="pc-card__rating" data-pc-rating="${esc(p.id)}" hidden></p>
        <p class="pc-card__price">${window.NB_formatPrice(p.price)} <small>or ${window.NB_formatPrice(window.NB_linePrice(p, "sub"))}/mo subscribed</small></p>
        ${p.available === false ? `<button class="btn btn--block" type="button" disabled>Sold out</button>` : `<button class="btn btn--block" type="button" data-add-to-cart="${esc(p.id)}">Add to cart</button>`}
      </article>`).concat(bundles.map((b) => `
      <article class="pc-card pc-card--bundle">
        <a class="pc-card__media pc-card__media--bundle" href="shop.html#bundles">
          ${b.parts.map((x) => (x.image ? `<img src="${esc(thumb(x.image))}" alt="" loading="lazy">` : "")).join("")}
          <span class="pc-card__tag pc-card__tag--save">Save ${Math.round(b.discount * 100)}%</span>
        </a>
        <h3 class="pc-card__name"><a href="shop.html#bundles">${esc(b.name)}</a></h3>
        <p class="pc-card__sub">${esc(b.tagline)}</p>
        <p class="pc-card__price">${window.NB_formatPrice(b.price)} <s>${window.NB_formatPrice(b.compareAt)}</s></p>
        ${b.available ? `<button class="btn btn--block" type="button" data-add-to-cart="${esc(b.id)}">Add bundle</button>` : `<button class="btn btn--block" type="button" disabled>Sold out</button>`}
      </article>`));
    track.innerHTML = cards.join("");
    window.NB_paintFavs && window.NB_paintFavs();
    dots.innerHTML = cards.map((_, i) => `<i class="${i === 0 ? "is-on" : ""}"></i>`).join("");
    window.NB_reviewSummary.then((data) => {
      if (!data) return;
      track.querySelectorAll("[data-pc-rating]").forEach((el) => {
        const r = data.products[el.dataset.pcRating];
        if (r && r.total) { el.innerHTML = `${window.NB_stars(r.average, 14)} <span>${r.average.toFixed(1)} (${r.total})</span>`; el.hidden = false; }
      });
    });
  }

  const step = () => { const c = track.querySelector(".pc-card"); return c ? c.getBoundingClientRect().width + 16 : 300; };
  document.querySelector("[data-pc-prev]").addEventListener("click", () => track.scrollBy({ left: -step(), behavior: "smooth" }));
  document.querySelector("[data-pc-next]").addEventListener("click", () => {
    const end = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
    track.scrollTo({ left: end ? 0 : track.scrollLeft + step(), behavior: "smooth" });
  });
  track.addEventListener("scroll", () => {
    const i = Math.round(track.scrollLeft / step());
    dots.querySelectorAll("i").forEach((d, n) => d.classList.toggle("is-on", n === i));
  }, { passive: true });

  // Gentle auto-advance; stops as soon as the visitor touches it.
  let auto = null;
  const stop = () => { clearInterval(auto); auto = null; };
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    auto = setInterval(() => {
      if (document.hidden) return;
      const end = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
      track.scrollTo({ left: end ? 0 : track.scrollLeft + step(), behavior: "smooth" });
    }, 4500);
    ["pointerdown", "wheel", "touchstart", "focusin"].forEach((ev) => track.addEventListener(ev, stop, { passive: true, once: true }));
    document.querySelectorAll("[data-pc-prev],[data-pc-next]").forEach((b) => b.addEventListener("click", stop, { once: true }));
  }

  if (window.NB_productsLoaded) render();
  window.addEventListener("nb:products", render);
})();


/* ---------- Get the app (add to home screen) ---------- */
(function () {
  const box = document.querySelector("[data-appdl]");
  if (!box) return;
  const show = (sel) => { const el = box.querySelector(sel); if (el) el.hidden = false; };
  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  if (standalone) return show("[data-appdl-done]");
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (ios) return show("[data-appdl-ios]");
  let prompt = null;
  const btn = box.querySelector("[data-appdl-install]");
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    prompt = e;
    btn.hidden = false;
    box.querySelector("[data-appdl-other]").hidden = true;
  });
  btn.addEventListener("click", async () => {
    if (!prompt) return;
    prompt.prompt();
    const choice = await prompt.userChoice.catch(() => null);
    prompt = null;
    btn.hidden = true;
    if (choice && choice.outcome === "accepted") show("[data-appdl-done]");
  });
  window.addEventListener("appinstalled", () => { btn.hidden = true; show("[data-appdl-done]"); });
  // Browsers without an install button (or on desktop): a short note.
  setTimeout(() => { if (!prompt) show("[data-appdl-other]"); }, 1500);
})();

/* ---------- Real reviews strip (only when Judge.me has reviews) ---------- */
(function () {
  const box = document.querySelector("[data-home-reviews]");
  if (!box) return;
  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  fetch("/api/reviews?recent=1").then((r) => (r.ok ? r.json() : null)).then((d) => {
    if (!d || !d.reviews || !d.reviews.length) return;
    box.querySelector("[data-rv-score]").innerHTML = d.overall && d.overall.total
      ? `${window.NB_stars(d.overall.average, 18)} <span><strong>${d.overall.average.toFixed(1)}</strong> from ${d.overall.total.toLocaleString("en-US")} reviews</span>` : "";
    box.querySelector("[data-rv-track]").innerHTML = d.reviews.map((r) => `
      <figure class="rv-card">
        ${r.picture ? `<img class="rv-card__pic" src="${esc(r.picture)}" alt="Photo from ${esc(r.name)}" loading="lazy">` : ""}
        <div class="rv-card__stars">${window.NB_stars(r.rating, 15)}</div>
        ${r.title ? `<strong class="rv-card__title">${esc(r.title)}</strong>` : ""}
        <blockquote>${esc(r.body.length > 220 ? r.body.slice(0, 220).replace(/\s+\S*$/, "") + "…" : r.body)}</blockquote>
        <figcaption>${esc(r.name)}${r.verified ? ' <span class="rv-card__badge">Verified buyer</span>' : ""}<br><a href="product.html?handle=${encodeURIComponent(r.handle)}#reviews">${esc(r.product)}</a></figcaption>
      </figure>`).join("");
    box.hidden = false;
  }).catch(() => {});
})();

/* ---------- Protein flavors carousel ---------- */
(function () {
  const box = document.querySelector("[data-pslide]");
  if (!box) return;
  const track = box.querySelector("[data-pslide-track]");
  const slides = [...track.children];
  const dots = [...box.querySelectorAll("[data-pslide-dot]")];
  let i = 0;
  const go = (n, smooth = true) => {
    i = (n + slides.length) % slides.length;
    dots.forEach((d, k) => d.setAttribute("aria-selected", String(k === i)));
    const target = track.clientWidth * i;
    track.scrollTo({ left: target, behavior: smooth ? "smooth" : "auto" });
    setTimeout(() => { if (Math.abs(track.scrollLeft - target) > 4) track.scrollLeft = target; }, 700);
  };
  track.addEventListener("scroll", () => {
    const n = Math.round(track.scrollLeft / track.clientWidth);
    if (n !== i) i = n;
    dots.forEach((d, k) => d.setAttribute("aria-selected", String(k === n)));
  }, { passive: true });
  box.querySelector("[data-pslide-prev]").addEventListener("click", () => { stop(); go(i - 1); });
  box.querySelector("[data-pslide-next]").addEventListener("click", () => { stop(); go(i + 1); });
  dots.forEach((d) => d.addEventListener("click", () => { stop(); go(Number(d.dataset.pslideDot)); }));
  window.addEventListener("resize", () => go(i, false));
  let auto = null;
  const stop = () => { clearInterval(auto); auto = null; };
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    auto = setInterval(() => { if (!document.hidden) go(i + 1); }, 6000);
    ["pointerdown", "touchstart", "wheel", "focusin"].forEach((ev) => track.addEventListener(ev, stop, { passive: true, once: true }));
  }
})();


// App promo video in the phone: plays on its own (still for reduced motion).
(function () {
  const v = document.querySelector("[data-app-promo]");
  if (!v) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { v.removeAttribute("autoplay"); v.pause(); return; }
  v.muted = true;
  v.play().catch(() => {});
})();
