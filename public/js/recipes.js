/* ==========================================================================
   Sweet Kitchen — recipe book, recipe detail, cook mode, "buy what's missing".
   Data: js/recipes-data.js (window.NB_RECIPES), photos in assets/recipes/.
   Deep links: recipes.html?r=<id>  ·  recipes.html?r=<id>&cook=1
   ========================================================================== */
(function () {
  const R = window.NB_RECIPES || [];
  const app = window.NB_app;
  const { esc } = app;
  const S = app.state;

  const FLAVORS = {
    vanilla: "vanilla-birthday-cake-plant-based-protein-powder",
    chocolate: "chocolate-brownie-delight-plant-based-protein-powder",
  };
  const TYPES = ["All", "Smoothie", "Shake", "Breakfast", "Dessert", "Snack"];

  const grid = document.querySelector("[data-rb-grid]");
  const count = document.querySelector("[data-rb-count]");
  const search = document.querySelector("[data-rb-search]");
  const dialog = document.querySelector("[data-rb-dialog]");
  const detail = document.querySelector("[data-rb-detail]");
  const cookEl = document.querySelector("[data-cook]");

  const f = { type: "All", flavor: "any", favs: false, q: "" };

  /* ---------- Cookbook access ----------
     Everyone can browse the recipes. Ingredients, steps and cook mode unlock
     for customers who got the free cookbook with a purchase (token saved by
     the success page or the cookbook link in the order email). */
  let token = null;
  try { token = localStorage.getItem("nb_cookbook"); } catch { /* ignore */ }
  let unlocked = false;
  const banner = document.querySelector("[data-rb-banner]");
  const lockIcon = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="4" y="9" width="12" height="8.5" rx="2"/><path d="M7 9V6.5a3 3 0 0 1 6 0V9"/></svg>';

  function drawBanner() {
    banner.innerHTML = unlocked
      ? `<div class="rb-banner rb-banner--open"><span>🎉 Your cookbook is unlocked. Enjoy all 25 recipes!</span><a class="btn btn--outline" href="/api/cookbook?t=${encodeURIComponent(token)}&get=pdf">Download PDF</a></div>`
      : `<div class="rb-banner"><span class="rb-banner__icon">${lockIcon}</span><div><strong>Unlock all 25 recipes free with any purchase</strong><span>You also get the Wellness Made Sweet PDF. Already ordered? Open the cookbook link in your order email.</span></div><a class="btn" href="shop.html">Shop now</a></div>`;
  }

  async function unlock() {
    if (!token) return false;
    try {
      const res = await fetch(`/api/cookbook?t=${encodeURIComponent(token)}&get=recipes`);
      if (!res.ok) { if (res.status === 403) { try { localStorage.removeItem("nb_cookbook"); } catch {} } return false; }
      const { recipes } = await res.json();
      recipes.forEach((full) => { const i = R.findIndex((r) => r.id === full.id); if (i >= 0) R[i] = { ...R[i], ...full }; });
      unlocked = true;
      return true;
    } catch { return false; }
  }

  // "Vanilla or Chocolate" recipes: either powder works.
  function either(r) {
    if (!r.ingredients) return r.products.length > 1 && /\bor\b/i.test(r.title);
    const p = (r.ingredients.find((i) => /protein/i.test(i.label)) || {}).text || "";
    return r.products.length > 1 && /\bor\b/i.test(p + " " + r.title);
  }

  const icon = {
    heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.2 3.2 4.5 6.9 4.5c2.1 0 3.6 1.1 5.1 3 1.5-1.9 3-3 5.1-3 3.7 0 6 3.7 4.5 7.2C19.5 16.4 12 21 12 21z"/></svg>',
    clock: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="10" cy="10" r="7.5"/><path d="M10 6v4.3l2.8 1.7" stroke-linecap="round"/></svg>',
    close: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M2 2l12 12M14 2L2 14"/></svg>',
  };

  /* ---------- Filters ---------- */
  function chips(el, items, key) {
    el.innerHTML = items.map(([v, label]) =>
      `<button type="button" class="chip" data-k="${key}" data-v="${v}" aria-pressed="${f[key] === v}">${label}</button>`).join("");
  }
  chips(document.querySelector("[data-rb-types]"), TYPES.map((t) => [t, t === "All" ? "All recipes" : t + (t === "Breakfast" || t === "Snack" ? "" : "s").replace("Snacks", "Snacks")]), "type");
  document.querySelector("[data-rb-flavors]").innerHTML =
    ["any", "vanilla", "chocolate"].map((v) =>
      `<button type="button" class="chip chip--soft" data-k="flavor" data-v="${v}" aria-pressed="${f.flavor === v}">${{ any: "Any flavor", vanilla: "Vanilla Birthday Cake", chocolate: "Chocolate Brownie" }[v]}</button>`).join("") +
    `<button type="button" class="chip chip--soft" data-k="favs" aria-pressed="false">${icon.heart} Favorites</button>`;

  document.querySelector(".rb-controls").addEventListener("click", (e) => {
    const c = e.target.closest(".chip");
    if (!c) return;
    if (c.dataset.k === "favs") f.favs = !f.favs;
    else f[c.dataset.k] = c.dataset.v;
    document.querySelectorAll(`.rb-controls .chip`).forEach((b) => {
      b.setAttribute("aria-pressed", b.dataset.k === "favs" ? String(f.favs) : String(f[b.dataset.k] === b.dataset.v));
    });
    render();
  });
  search.addEventListener("input", () => { f.q = search.value.trim().toLowerCase(); render(); });

  function matches(r) {
    if (f.type !== "All" && r.type !== f.type) return false;
    if (f.flavor !== "any" && !r.products.includes(FLAVORS[f.flavor])) return false;
    if (f.favs && !S.favs.includes(r.id)) return false;
    if (f.q) {
      const hay = (r.title + " " + r.type + " " + r.ingredients.map((i) => i.text).join(" ")).toLowerCase();
      if (!f.q.split(/\s+/).every((w) => hay.includes(w))) return false;
    }
    return true;
  }

  function card(r) {
    const fav = S.favs.includes(r.id);
    return `<li class="rb-card">
      <a class="rb-card__link" href="?r=${r.id}" data-open-recipe="${r.id}">
        <img class="rb-card__img" src="${r.image}" alt="" loading="lazy" width="800" height="1056">
        <span class="rb-card__type">${esc(r.type)}${unlocked ? "" : `<span class="rb-lock" aria-label="Locked">${lockIcon}</span>`}</span>
        <h3 class="rb-card__title">${esc(r.title)}</h3>
        <p class="rb-card__meta"><span>${icon.clock}${r.minutes} min</span><span><strong>${r.macros.protein}g</strong> protein</span><span>${r.macros.kcal} cal</span></p>
      </a>
      <button class="rb-fav" type="button" data-fav="${r.id}" aria-pressed="${fav}" aria-label="${fav ? "Remove from" : "Save to"} favorites: ${esc(r.title)}">${icon.heart}</button>
    </li>`;
  }

  function render() {
    const list = R.filter(matches);
    grid.innerHTML = list.map(card).join("") ||
      `<li class="rb-empty">No recipes match yet. ${f.favs ? "Tap the heart on a recipe to save it here." : "Try another filter."}</li>`;
    count.textContent = `${list.length} recipe${list.length === 1 ? "" : "s"}`;
  }

  function toggleFav(id) {
    const i = S.favs.indexOf(id);
    if (i >= 0) S.favs.splice(i, 1); else S.favs.push(id);
    app.save();
    document.querySelectorAll(`[data-fav="${id}"]`).forEach((b) => b.setAttribute("aria-pressed", String(i < 0)));
    if (f.favs) render();
  }

  /* ---------- Detail ---------- */
  let current = null;

  function productBlock(r) {
    const ids = r.products;
    const any = either(r);
    const owned = ids.filter((id) => S.pantry.includes(id));
    const missing = any ? (owned.length ? [] : [ids[0]]) : ids.filter((id) => !S.pantry.includes(id));
    const rows = ids.map((id) => {
      const p = window.NB_findItem && window.NB_findItem(id);
      const name = p ? p.shortName || p.name : id.includes("vanilla") ? "Vanilla Birthday Cake protein" : "Chocolate Brownie Delight protein";
      const img = p && p.image ? p.image : id.includes("vanilla") ? "assets/images/vanilla-birthday-cake.jpg" : "assets/images/chocolate-brownie-delight.jpg";
      const have = S.pantry.includes(id);
      return `<li class="rd-prod">
        <img src="${esc(img)}" alt="" width="56" height="56">
        <div class="rd-prod__txt">
          <a href="product.html?handle=${id}">${esc(name)}</a>
          <span>${p && p.price != null ? window.NB_formatPrice(window.NB_linePrice(p, "sub")) + " with Subscribe &amp; save" : ""}</span>
        </div>
        <label class="rd-have"><input type="checkbox" data-have="${id}" ${have ? "checked" : ""}> I have it</label>
      </li>`;
    }).join("");
    return `
      <section class="rd-made" aria-labelledby="rd-made-title">
        <h3 id="rd-made-title">Made with${any ? " (either one works)" : ""}</h3>
        <ul class="rd-prods">${rows}</ul>
        ${missing.length
          ? `<button class="btn btn--block" type="button" data-buy-missing="${missing.join(",")}">Buy what’s missing · Subscribe &amp; save 15%</button>
             <button class="rd-link" type="button" data-buy-once="${missing.join(",")}">or buy once</button>`
          : `<p class="rd-ready">✓ You have everything for this one. Happy baking, bae!</p>`}
      </section>`;
  }

  function openLocked(r) {
    const m = r.macros;
    detail.innerHTML = `
      <button class="icon-btn sheet__close" type="button" data-close-recipe aria-label="Close recipe">${icon.close}</button>
      <img class="rd-img" src="${r.image}" alt="${esc(r.title)}" width="800" height="1056">
      <div class="rd-body">
        <p class="app-eyebrow">${esc(r.type)} · ${r.minutes} min · serves ${m.servings}</p>
        <h2 class="rd-title" id="rb-title">${esc(r.title)}</h2>
        <ul class="macros" aria-label="Per serving">
          <li><strong>${m.protein}g</strong><span>protein</span></li>
          <li><strong>${m.carbs}g</strong><span>carbs</span></li>
          <li><strong>${m.fat}g</strong><span>fat</span></li>
          <li><strong>${m.kcal}</strong><span>calories</span></li>
        </ul>
        <div class="rd-locked">
          <span class="rb-banner__icon">${lockIcon}</span>
          <h3>Unlock this recipe free</h3>
          <p>Ingredients, steps and cook mode for all 25 recipes come free with any NutriBae purchase, plus the Wellness Made Sweet PDF. Just keep “Add my free cookbook” ticked in your cart.</p>
          <a class="btn btn--block" href="shop.html">Shop NutriBae</a>
          <p class="rd-source">Already ordered? Open the cookbook link in your order confirmation email on this device.</p>
        </div>
        <div data-rd-products>${productBlock(r)}</div>
      </div>`;
  }

  function openRecipe(id, push = true) {
    const r = R.find((x) => x.id === id);
    if (!r) return;
    current = r;
    if (!unlocked) {
      openLocked(r);
      if (!dialog.open) dialog.showModal();
      if (push) history.replaceState(null, "", `?r=${r.id}`);
      return;
    }
    const fav = S.favs.includes(r.id);
    const m = r.macros;
    detail.innerHTML = `
      <button class="icon-btn sheet__close" type="button" data-close-recipe aria-label="Close recipe">${icon.close}</button>
      <img class="rd-img" src="${r.image}" alt="${esc(r.title)}" width="800" height="1056">
      <div class="rd-body">
        <p class="app-eyebrow">${esc(r.type)} · ${r.minutes} min · serves ${m.servings}</p>
        <h2 class="rd-title" id="rb-title">${esc(r.title)}</h2>
        <ul class="macros" aria-label="Per serving">
          <li><strong>${m.protein}g</strong><span>protein</span></li>
          <li><strong>${m.carbs}g</strong><span>carbs</span></li>
          <li><strong>${m.fat}g</strong><span>fat</span></li>
          <li><strong>${m.kcal}</strong><span>calories</span></li>
        </ul>
        <div class="rd-actions">
          <button class="btn" type="button" data-start-cook>Start cook mode</button>
          <button class="btn btn--ghost rd-favbtn" type="button" data-fav="${r.id}" aria-pressed="${fav}">${icon.heart}<span>Favorite</span></button>
        </div>
        <div data-rd-products>${productBlock(r)}</div>
        <section>
          <h3>Ingredients</h3>
          <ul class="rd-ings">${r.ingredients.map((i) => `<li><span>${esc(i.label)}</span>${esc(i.text)}</li>`).join("")}</ul>
        </section>
        <section>
          <h3>Steps</h3>
          <ol class="rd-steps">${r.steps.map((s) => `<li>${s.h ? `<strong>${esc(s.h)}:</strong> ` : ""}${esc(s.t)}</li>`).join("")}</ol>
        </section>
        ${r.tip ? `<p class="rd-tip"><strong>Bae tip:</strong> ${esc(r.tip)}</p>` : ""}
        <p class="rd-source">From the Wellness Made Sweet cookbook. Nutrition per serving, as listed in the book.</p>
      </div>`;
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
    detail.scrollTop = 0;
    if (push) history.replaceState(null, "", `?r=${r.id}`);
  }

  function closeRecipe() {
    if (dialog.open) dialog.close();
  }
  dialog.addEventListener("close", () => { current = null; history.replaceState(null, "", location.pathname); });
  dialog.addEventListener("click", (e) => { if (e.target === dialog) closeRecipe(); });

  document.addEventListener("click", (e) => {
    const o = e.target.closest("[data-open-recipe]");
    if (o) { e.preventDefault(); openRecipe(o.dataset.openRecipe); return; }
    const fv = e.target.closest("[data-fav]");
    if (fv) { toggleFav(fv.dataset.fav); return; }
    if (e.target.closest("[data-close-recipe]")) { closeRecipe(); return; }
    if (e.target.closest("[data-start-cook]") && current) { startCook(current); return; }
    const bm = e.target.closest("[data-buy-missing],[data-buy-once]");
    if (bm) {
      const ids = (bm.dataset.buyMissing || bm.dataset.buyOnce).split(",");
      closeRecipe();
      app.addToCart(ids, bm.dataset.buyMissing ? "sub" : "once");
    }
  });
  document.addEventListener("change", (e) => {
    const h = e.target.closest("[data-have]");
    if (!h) return;
    const id = h.dataset.have;
    S.pantry = S.pantry.filter((x) => x !== id);
    if (h.checked) {
      S.pantry.push(id);
      if (!S.refill[id]) S.refill[id] = { servings: 30, opened: app.today() };
    }
    app.save();
    if (current) document.querySelector("[data-rd-products]").innerHTML = productBlock(current);
  });

  /* ---------- Cook mode ---------- */
  const ck = { r: null, i: 0, left: 0, total: 0, timer: null, running: false, lock: null, audio: null };

  async function keepAwake() {
    try { if ("wakeLock" in navigator) ck.lock = await navigator.wakeLock.request("screen"); } catch { /* not supported or denied */ }
  }
  document.addEventListener("visibilitychange", () => { if (!cookEl.hidden && document.visibilityState === "visible") keepAwake(); });

  function chime() {
    try {
      ck.audio = ck.audio || new (window.AudioContext || window.webkitAudioContext)();
      const t = ck.audio.currentTime;
      [0, 0.35, 0.7].forEach((d) => {
        const o = ck.audio.createOscillator(), g = ck.audio.createGain();
        o.frequency.value = 880; o.connect(g); g.connect(ck.audio.destination);
        g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.3, t + d + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.3);
        o.start(t + d); o.stop(t + d + 0.32);
      });
    } catch { /* audio blocked */ }
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  }

  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  function stopTimer() { clearInterval(ck.timer); ck.timer = null; ck.running = false; }

  function startCook(r) {
    if (!unlocked || !r.steps) { openRecipe(r.id); return; }
    ck.r = r; ck.i = 0;
    closeRecipe();
    cookEl.hidden = false;
    document.body.style.overflow = "hidden";
    keepAwake();
    history.replaceState(null, "", `?r=${r.id}&cook=1`);
    drawCook();
    cookEl.querySelector("[data-ck-next]").focus();
  }

  function endCook(done) {
    stopTimer();
    cookEl.hidden = true;
    document.body.style.overflow = "";
    if (ck.lock) { ck.lock.release().catch(() => {}); ck.lock = null; }
    history.replaceState(null, "", location.pathname);
    if (done) {
      S.cooked.push({ id: ck.r.id, at: Date.now() });
      app.save();
      app.award(`cook:${ck.r.id}:${app.today()}`, 10, `Cooked ${ck.r.title}`);
    }
  }

  function drawCook() {
    const r = ck.r, n = r.steps.length, s = r.steps[ck.i];
    stopTimer();
    ck.total = ck.left = s.timer || 0;
    const last = ck.i === n - 1;
    cookEl.innerHTML = `
      <div class="cook__top">
        <button class="icon-btn" type="button" data-ck-exit aria-label="Exit cook mode">${icon.close}</button>
        <p class="cook__name" id="cook-title">${esc(r.title)}</p>
        <button class="cook__ingbtn" type="button" data-ck-ings aria-expanded="false">Ingredients</button>
      </div>
      <div class="cook__bar"><span style="width:${((ck.i + 1) / n) * 100}%"></span></div>
      <div class="cook__ings" data-ck-inglist hidden>
        <ul>${r.ingredients.map((i) => `<li><span>${esc(i.label)}</span>${esc(i.text)}</li>`).join("")}</ul>
      </div>
      <div class="cook__main" aria-live="polite">
        <p class="cook__count">Step ${ck.i + 1} of ${n}</p>
        ${s.h ? `<p class="cook__h">${esc(s.h)}</p>` : ""}
        <p class="cook__step">${esc(s.t)}</p>
        ${s.timer ? `
          <div class="cook__timer" data-ck-timer>
            <span class="cook__time" data-ck-time>${fmt(ck.left)}</span>
            <div class="cook__tbtns">
              <button class="btn" type="button" data-ck-go>Start timer</button>
              <button class="rd-link" type="button" data-ck-reset>Reset</button>
            </div>
          </div>` : ""}
      </div>
      <div class="cook__nav">
        <button class="btn btn--ghost" type="button" data-ck-prev ${ck.i === 0 ? "disabled" : ""}>Back</button>
        <button class="btn" type="button" data-ck-next>${last ? "I’m done! 🎉" : "Next step"}</button>
      </div>`;
  }

  function tick() {
    ck.left = Math.max(0, ck.left - 1);
    const t = cookEl.querySelector("[data-ck-time]");
    if (t) t.textContent = fmt(ck.left);
    if (ck.left === 0) {
      stopTimer();
      chime();
      const go = cookEl.querySelector("[data-ck-go]");
      if (go) go.textContent = "Time’s up! Restart";
      cookEl.querySelector("[data-ck-timer]").classList.add("is-done");
    }
  }

  cookEl.addEventListener("click", (e) => {
    if (e.target.closest("[data-ck-exit]")) { endCook(false); return; }
    if (e.target.closest("[data-ck-prev]")) { ck.i = Math.max(0, ck.i - 1); drawCook(); return; }
    if (e.target.closest("[data-ck-next]")) {
      if (ck.i < ck.r.steps.length - 1) { ck.i++; drawCook(); } else endCook(true);
      return;
    }
    const ib = e.target.closest("[data-ck-ings]");
    if (ib) {
      const l = cookEl.querySelector("[data-ck-inglist]");
      l.hidden = !l.hidden;
      ib.setAttribute("aria-expanded", String(!l.hidden));
      return;
    }
    const go = e.target.closest("[data-ck-go]");
    if (go) {
      chime.unlocked || (function () { try { ck.audio = ck.audio || new (window.AudioContext || window.webkitAudioContext)(); ck.audio.resume(); } catch {} })();
      if (ck.running) { stopTimer(); go.textContent = "Resume"; return; }
      if (ck.left === 0) { ck.left = ck.total; cookEl.querySelector("[data-ck-timer]").classList.remove("is-done"); }
      ck.running = true;
      ck.timer = setInterval(tick, 1000);
      go.textContent = "Pause";
      return;
    }
    if (e.target.closest("[data-ck-reset]")) {
      stopTimer(); ck.left = ck.total;
      cookEl.querySelector("[data-ck-time]").textContent = fmt(ck.left);
      cookEl.querySelector("[data-ck-go]").textContent = "Start timer";
      cookEl.querySelector("[data-ck-timer]").classList.remove("is-done");
    }
  });
  document.addEventListener("keydown", (e) => {
    if (cookEl.hidden) return;
    if (e.key === "Escape") endCook(false);
    if (e.key === "ArrowRight") cookEl.querySelector("[data-ck-next]").click();
    if (e.key === "ArrowLeft" && ck.i > 0) cookEl.querySelector("[data-ck-prev]").click();
  });

  /* ---------- Start ---------- */
  drawBanner();
  render();
  window.addEventListener("nb:products", () => { if (current) document.querySelector("[data-rd-products]").innerHTML = productBlock(current); });
  unlock().then(() => {
    drawBanner();
    render();
    const qs = new URLSearchParams(location.search);
    const rid = qs.get("r");
    if (rid && R.some((r) => r.id === rid)) {
      if (qs.get("cook") === "1") startCook(R.find((r) => r.id === rid));
      else openRecipe(rid, false);
    }
  });
})();
