/* ==========================================================================
   Site search: opens from the magnifier in the header.
   Searches products, bundles, recipes and the main pages, all in the browser.
   ========================================================================== */
(function () {
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const thumb = (u) => (u && /cdn\.shopify\.com/.test(u) ? u + (u.includes("?") ? "&" : "?") + "width=160" : u);

  const PAGES = [
    { title: "Shop all", href: "shop.html", words: "shop store products buy all protein energy hydration probiotic tienda" },
    { title: "Play To Win · win free products", href: "bakery.html", words: "game play win free products stars coupons invite friends juego gratis" },
    { title: "Recipes", href: "recipes.html", words: "recipes cookbook desserts smoothies recetas" },
    { title: "Quiz Lab", href: "plan.html", words: "quiz quizzes sweet plan routine" },
    { title: "My Sweet Day", href: "my-day.html", words: "my sweet day tracker water protein streak habits" },
    { title: "Sweet Swap", href: "swap.html", words: "swap craving dessert alternative" },
    { title: "FAQ", href: "faq.html", words: "faq questions shipping returns refund orders tracking ingredients help" },
    { title: "About us", href: "about.html", words: "about founder story brand" },
  ];

  let recipes = window.NB_RECIPES || null;
  function loadRecipes() {
    if (recipes) return Promise.resolve(recipes);
    return new Promise((res) => {
      const sc = document.createElement("script");
      sc.src = "js/recipes-data.js";
      sc.onload = () => { recipes = window.NB_RECIPES || []; res(recipes); };
      sc.onerror = () => { recipes = []; res(recipes); };
      document.head.appendChild(sc);
    });
  }

  let el, input, list;
  function build() {
    el = document.createElement("div");
    el.className = "srch";
    el.hidden = true;
    el.innerHTML = `
      <div class="srch__panel" role="dialog" aria-modal="true" aria-label="Search">
        <form class="srch__bar" role="search">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="8.5" cy="8.5" r="6"/><path d="M13 13l4.5 4.5"/></svg>
          <input type="search" placeholder="Search products, recipes…" aria-label="Search" autocomplete="off" enterkeyhint="search">
          <button type="button" class="srch__close" data-srch-close>Cancel</button>
        </form>
        <div class="srch__results" aria-live="polite"></div>
      </div>`;
    document.body.appendChild(el);
    input = el.querySelector("input");
    list = el.querySelector(".srch__results");
    input.addEventListener("input", render);
    el.querySelector("form").addEventListener("submit", (e) => {
      e.preventDefault();
      const first = list.querySelector("a");
      if (first) location.href = first.href;
    });
    el.addEventListener("click", (e) => { if (e.target === el || e.target.closest("[data-srch-close]")) close(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !el.hidden) close(); });
    window.addEventListener("nb:products", () => { if (!el.hidden) render(); });
  }

  function score(text, terms) {
    const t = norm(text);
    let s = 0;
    for (const w of terms) { if (!t.includes(w)) return 0; s += t.startsWith(w) ? 3 : 1; }
    return s;
  }

  function items() {
    const prods = (window.NB_PRODUCTS || []).map((p) => ({
      kind: "Product", title: p.shortName || p.name, sub: window.NB_formatPrice ? window.NB_formatPrice(p.price) : "",
      href: `product.html?handle=${encodeURIComponent(p.id)}`, img: p.image, words: [p.name, p.category, p.description].join(" "),
    }));
    const bundles = (window.NB_BUNDLES || []).map((b) => window.NB_findItem && window.NB_findItem(b.id)).filter(Boolean).map((b) => ({
      kind: "Bundle", title: b.name, sub: b.price != null ? `${window.NB_formatPrice(b.price)} · save ${Math.round(b.discount * 100)}%` : "",
      href: "shop.html#bundles", img: b.image, words: [b.name, b.tagline, b.parts.map((p) => p.name).join(" "), "bundle kit set"].join(" "),
    }));
    const recs = (recipes || []).map((r) => ({
      kind: "Recipe", title: r.title, sub: `${r.type} · ${r.minutes} min`, href: `recipes.html?r=${encodeURIComponent(r.id)}`,
      img: r.image, words: [r.title, r.type, (r.tags || []).join(" "), "recipe receta"].join(" "),
    }));
    const pages = PAGES.map((p) => ({ kind: "Page", title: p.title, href: p.href, words: p.title + " " + p.words }));
    return [...prods, ...bundles, ...recs, ...pages];
  }

  const row = (r) => `<li><a class="srch__item" href="${esc(r.href)}">
      <span class="srch__img">${r.img ? `<img src="${esc(thumb(r.img))}" alt="" loading="lazy">` : "→"}</span>
      <span class="srch__txt"><strong>${esc(r.title)}</strong>${r.sub ? `<small>${esc(r.sub)}</small>` : ""}</span>
      <span class="srch__kind">${r.kind}</span></a></li>`;

  function render() {
    const q = norm(input.value).trim();
    if (!q) {
      const popular = items().filter((r) => r.kind === "Product").slice(0, 6);
      list.innerHTML = `<p class="srch__h">Popular</p><ul>${popular.map(row).join("")}</ul>
        <p class="srch__h">Try</p><div class="srch__chips">${["protein", "energy", "smoothie", "brownie", "free products", "shipping"].map((w) => `<button type="button" class="srch__chip" data-srch-q="${w}">${w}</button>`).join("")}</div>`;
      list.querySelectorAll("[data-srch-q]").forEach((b) => b.addEventListener("click", () => { input.value = b.dataset.srchQ; render(); input.focus(); }));
      return;
    }
    const terms = q.split(/\s+/).filter(Boolean);
    const found = items().map((r) => ({ r, s: score(r.title, terms) * 3 + score(r.words, terms) })).filter((x) => x.s > 0).map((x) => ({ ...x, s: x.s + (x.r.kind === "Product" ? 4 : x.r.kind === "Bundle" ? 2 : 0) })).sort((a, b) => b.s - a.s).slice(0, 14).map((x) => x.r);
    list.innerHTML = found.length
      ? `<ul>${found.map(row).join("")}</ul>`
      : `<p class="srch__empty">No results for “${esc(input.value)}”.</p><a class="btn" href="shop.html">Shop all products</a>`;
  }

  function open(q) {
    if (!el) build();
    el.hidden = false;
    document.body.classList.add("srch-open");
    if (typeof q === "string") input.value = q;
    render();
    input.focus(); // right away, so phones keep the keyboard open
    setTimeout(() => { if (document.activeElement !== input) input.focus(); }, 30);
    loadRecipes().then(() => { if (!el.hidden) render(); });
  }
  function close() {
    el.hidden = true;
    document.body.classList.remove("srch-open");
  }

  window.NB_search = { open, close };
})();
