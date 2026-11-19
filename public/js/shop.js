// Product cards: live from Shopify (falls back to js/products.js)
const grid = document.querySelector("[data-product-grid]");

function renderBundles() {
  const box = document.querySelector("[data-bundles]");
  const list = document.querySelector("[data-bundle-grid]");
  if (!box || !list || !window.NB_BUNDLES) return;
  const bundles = window.NB_BUNDLES.map((b) => window.NB_findItem(b.id)).filter((b) => b && b.price != null);
  box.hidden = !bundles.length;
  list.innerHTML = bundles.map((b) => `
    <li class="bundle-card">
      <div class="bundle-card__media" aria-hidden="true">
        ${b.parts.map((p) => p.image ? `<img src="${p.image}" alt="" loading="lazy">` : "").join("")}
      </div>
      <span class="bundle-card__save">Save ${Math.round(b.discount * 100)}%</span>
      <h3 class="bundle-card__name">${b.name}</h3>
      <p class="bundle-card__tag">${b.tagline}</p>
      <ul class="bundle-card__items">${b.parts.map((p) => `<li>${p.name}</li>`).join("")}</ul>
      <p class="bundle-card__price">${window.NB_formatPrice(b.price)} <s aria-label="Regular price ${window.NB_formatPrice(b.compareAt)}">${window.NB_formatPrice(b.compareAt)}</s></p>
      ${b.available ? `<button class="btn" type="button" data-add-to-cart="${b.id}">Add bundle to cart</button>` : `<button class="btn" type="button" disabled>Sold out</button>`}
    </li>`).join("");
}

/* ---------- Filters: category, goal, features, price + sort ----------
   Facts per product (by Shopify handle). Add a new product here so it shows
   up under the right filters; anything not listed still shows under "All". */
const FACETS = {
  "vanilla-birthday-cake-plant-based-protein-powder": { cat: "protein", goals: ["muscle", "cravings", "workout"], features: ["plant-based", "caffeine-free", "low-sugar", "dairy-free"], flavor: "Vanilla birthday cake", rank: 1 },
  "chocolate-brownie-delight-plant-based-protein-powder": { cat: "protein", goals: ["muscle", "cravings", "workout"], features: ["plant-based", "caffeine-free", "low-sugar", "dairy-free"], flavor: "Chocolate brownie", rank: 2 },
  "energy-powder-strawberry-shortcake": { cat: "energy", goals: ["energy", "workout"], features: ["sugar-free", "caffeine"], flavor: "Strawberry shortcake", rank: 3 },
  "energy-powder-cotton-candy": { cat: "energy", goals: ["energy", "workout"], features: ["sugar-free", "caffeine"], flavor: "Cotton candy", rank: 4 },
  "hydration-powder-peach-mango": { cat: "hydration", goals: ["hydration", "workout"], features: ["sugar-free", "caffeine-free", "keto"], flavor: "Peach mango", rank: 5 },
  "probiotic-20-billion": { cat: "gut", goals: ["gut"], features: ["caffeine-free"], flavor: "Unflavored capsules", rank: 6 },
};
const CATS = [
  { id: "all", label: "All" },
  { id: "protein", label: "Protein" },
  { id: "energy", label: "Energy" },
  { id: "hydration", label: "Hydration" },
  { id: "gut", label: "Gut health" },
  { id: "bundles", label: "Bundles" },
];
const GOALS = [
  { id: "muscle", label: "Build & tone" },
  { id: "energy", label: "Energy & focus" },
  { id: "hydration", label: "Hydration" },
  { id: "gut", label: "Gut health" },
  { id: "workout", label: "Workouts" },
  { id: "cravings", label: "Sweet cravings" },
];
const FEATURES = [
  { id: "plant-based", label: "Plant-based" },
  { id: "dairy-free", label: "Dairy-free" },
  { id: "caffeine-free", label: "Caffeine-free" },
  { id: "caffeine", label: "With caffeine" },
  { id: "sugar-free", label: "Sugar-free" },
  { id: "low-sugar", label: "Low sugar" },
  { id: "keto", label: "Keto-friendly" },
];
const PRICES = [
  { id: "u25", label: "Under $25", min: 0, max: 25 },
  { id: "25-40", label: "$25 – $40", min: 25, max: 40 },
  { id: "o40", label: "$40 & up", min: 40, max: Infinity },
];

const F = { cat: "all", goals: new Set(), features: new Set(), price: "", sort: "featured" };
(function readUrl() {
  const q = new URLSearchParams(location.search);
  if (CATS.some((c) => c.id === q.get("cat"))) F.cat = q.get("cat");
  (q.get("goal") || "").split(",").filter((g) => GOALS.some((x) => x.id === g)).forEach((g) => F.goals.add(g));
  (q.get("features") || "").split(",").filter((g) => FEATURES.some((x) => x.id === g)).forEach((g) => F.features.add(g));
  if (PRICES.some((p) => p.id === q.get("price"))) F.price = q.get("price");
  if (q.get("sort")) F.sort = q.get("sort");
})();
function writeUrl() {
  const q = new URLSearchParams(location.search);
  const put = (k, v) => (v ? q.set(k, v) : q.delete(k));
  put("cat", F.cat === "all" ? "" : F.cat);
  put("goal", [...F.goals].join(","));
  put("features", [...F.features].join(","));
  put("price", F.price);
  put("sort", F.sort === "featured" ? "" : F.sort);
  history.replaceState(null, "", location.pathname + (q.toString() ? `?${q}` : "") + location.hash);
}

let ratings = null;
const facet = (p) => FACETS[p.id] || { cat: (p.category || "").toLowerCase(), goals: [], features: [], rank: 99 };
const ratingOf = (p) => (ratings && ratings.products[p.id] ? ratings.products[p.id].average : 0);

function matches(p, skip) {
  const f = facet(p);
  if (skip !== "cat" && F.cat !== "all" && F.cat !== "bundles" && f.cat !== F.cat) return false;
  if (skip !== "goals" && F.goals.size && ![...F.goals].some((g) => f.goals.includes(g))) return false;
  if (skip !== "features" && [...F.features].some((x) => !f.features.includes(x))) return false;
  if (skip !== "price" && F.price) {
    const r = PRICES.find((x) => x.id === F.price);
    if (p.price == null || p.price < r.min || p.price >= r.max) return false;
  }
  return true;
}
function filtered() {
  if (F.cat === "bundles") return [];
  const list = (window.NB_PRODUCTS || []).filter((p) => matches(p));
  const by = {
    "price-asc": (a, b) => (a.price ?? 1e9) - (b.price ?? 1e9),
    "price-desc": (a, b) => (b.price ?? -1) - (a.price ?? -1),
    rating: (a, b) => ratingOf(b) - ratingOf(a),
    name: (a, b) => (a.shortName || a.name).localeCompare(b.shortName || b.name),
    featured: (a, b) => facet(a).rank - facet(b).rank,
  }[F.sort] || ((a, b) => facet(a).rank - facet(b).rank);
  return list.sort(by);
}
// How many products each option would show (with the other filters kept).
function countWith(key, apply) {
  const saved = { cat: F.cat, goals: new Set(F.goals), features: new Set(F.features), price: F.price };
  apply();
  const n = (window.NB_PRODUCTS || []).filter((p) => matches(p)).length;
  Object.assign(F, saved);
  return n;
}

function renderFilters() {
  const cats = document.querySelector("[data-sf-cats]");
  const panel = document.querySelector("[data-sf-panel]");
  if (!cats || !panel) return;
  const nBundles = (window.NB_BUNDLES || []).map((b) => window.NB_findItem(b.id)).filter((b) => b && b.price != null).length;
  cats.innerHTML = CATS.map((c) => {
    const n = c.id === "bundles" ? nBundles : c.id === "all" ? null : (window.NB_PRODUCTS || []).filter((p) => facet(p).cat === c.id).length;
    if (n === 0) return "";
    return `<button type="button" role="tab" aria-selected="${F.cat === c.id}" class="sf__cat ${F.cat === c.id ? "is-on" : ""}" data-sf-cat="${c.id}">${c.label}${n != null ? ` <small>${n}</small>` : ""}</button>`;
  }).join("");

  const group = (title, key, opts, multi) => `
    <fieldset class="sf__group"><legend>${title}</legend><div class="sf__opts">
      ${opts.map((o) => {
        const on = multi ? F[key].has(o.id) : F[key] === o.id;
        const n = countWith(key, () => { if (multi) { F[key] = new Set(F[key]); F[key].add(o.id); } else F[key] = o.id; });
        return `<button type="button" class="sf__opt ${on ? "is-on" : ""}" aria-pressed="${on}" data-sf-${multi ? "multi" : "one"}="${key}" data-val="${o.id}" ${!on && !n ? "disabled" : ""}>${o.label} <small>${n}</small></button>`;
      }).join("")}
    </div></fieldset>`;
  panel.innerHTML = group("Goal", "goals", GOALS, true) + group("Features", "features", FEATURES, true) + group("Price", "price", PRICES, false)
    + `<div class="sf__panel-foot"><button type="button" class="link-btn" data-sf-clear>Clear all</button><button type="button" class="btn" data-sf-done>Show ${filtered().length} products</button></div>`;

  const active = [
    ...[...F.goals].map((g) => ({ key: "goals", val: g, label: GOALS.find((x) => x.id === g).label })),
    ...[...F.features].map((g) => ({ key: "features", val: g, label: FEATURES.find((x) => x.id === g).label })),
    ...(F.price ? [{ key: "price", val: F.price, label: PRICES.find((x) => x.id === F.price).label }] : []),
  ];
  document.querySelector("[data-sf-active]").innerHTML = active.length
    ? active.map((a) => `<button type="button" class="sf__chip" data-sf-remove="${a.key}" data-val="${a.val}" aria-label="Remove filter ${a.label}">${a.label} ✕</button>`).join("") + `<button type="button" class="link-btn sf__clear" data-sf-clear>Clear all</button>`
    : "";
  const badge = document.querySelector("[data-sf-badge]");
  badge.hidden = !active.length; badge.textContent = active.length;
  const sortSel = document.querySelector("[data-sf-sort]");
  const rOpt = sortSel.querySelector('option[value="rating"]');
  rOpt.hidden = rOpt.disabled = !(ratings && ratings.overall && ratings.overall.total);
  if (rOpt.disabled && F.sort === "rating") F.sort = "featured";
  sortSel.value = F.sort;
}

function applyFilters() {
  writeUrl();
  renderShop();
  window.NB_paintFavs && window.NB_paintFavs();
  if (ratings) showRatings(ratings);
}

document.addEventListener("click", (e) => {
  const t = e.target;
  const cat = t.closest("[data-sf-cat]");
  if (cat) { F.cat = cat.dataset.sfCat; return applyFilters(); }
  const multi = t.closest("[data-sf-multi]");
  if (multi) { const set = F[multi.dataset.sfMulti]; set.has(multi.dataset.val) ? set.delete(multi.dataset.val) : set.add(multi.dataset.val); return applyFilters(); }
  const one = t.closest("[data-sf-one]");
  if (one) { const k = one.dataset.sfOne; F[k] = F[k] === one.dataset.val ? "" : one.dataset.val; return applyFilters(); }
  const rm = t.closest("[data-sf-remove]");
  if (rm) { const k = rm.dataset.sfRemove; if (k === "price") F.price = ""; else F[k].delete(rm.dataset.val); return applyFilters(); }
  if (t.closest("[data-sf-clear]")) { F.cat = "all"; F.goals.clear(); F.features.clear(); F.price = ""; return applyFilters(); }
  const tg = t.closest("[data-sf-toggle]");
  if (tg) { const panel = document.querySelector("[data-sf-panel]"); panel.hidden = !panel.hidden; tg.setAttribute("aria-expanded", String(!panel.hidden)); return; }
  if (t.closest("[data-sf-done]")) {
    document.querySelector("[data-sf-panel]").hidden = true;
    document.querySelector("[data-sf-toggle]").setAttribute("aria-expanded", "false");
    document.querySelector("[data-shop-filters]").scrollIntoView({ behavior: "smooth", block: "start" });
  }
});
document.addEventListener("change", (e) => {
  if (e.target.matches("[data-sf-sort]")) { F.sort = e.target.value; applyFilters(); }
});

function renderShop() {
renderFilters();
const showBundles = F.cat === "all" || F.cat === "bundles";
renderBundles();
const bbox = document.querySelector("[data-bundles]");
if (bbox && !showBundles) bbox.hidden = true;
const list = filtered();
const count = document.querySelector("[data-sf-count]");
if (count) count.textContent = F.cat === "bundles" ? "" : `${list.length} product${list.length === 1 ? "" : "s"}`;
const empty = document.querySelector("[data-sf-empty]");
if (empty) empty.hidden = !(F.cat !== "bundles" && !list.length);
grid.innerHTML = list.map((p) => `
  <li class="product-card" id="${p.id}">
    <a class="product-card__media" href="product.html?handle=${encodeURIComponent(p.id)}" aria-label="${p.name}">
      ${p.image
        ? `<img src="${p.image}" alt="${p.imageAlt || p.name}" loading="lazy">`
        : `<div class="ph">Add photo: assets/images/${p.id}.jpg</div>`}
    </a>
    <button class="fav-btn fav-btn--card" type="button" data-fav-product="${p.id}" aria-pressed="false" aria-label="Save to favorites"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.9c0 5.4-7.5 10-7.5 10z"/></svg></button>
    <span class="tag">${CATS.find((c) => c.id === facet(p).cat)?.label || p.category}</span>
    <h2 class="product-card__name"><a href="product.html?handle=${encodeURIComponent(p.id)}">${p.name}</a></h2>
    <a class="card-rating" href="product.html?handle=${encodeURIComponent(p.id)}#reviews" data-rating-for="${p.id}" hidden></a>
    ${p.size ? `<p class="product-card__meta">${p.size}</p>` : ""}
    <p class="product-card__meta">${shortText(p.description)}</p>
    <a class="product-card__link" href="product.html?handle=${encodeURIComponent(p.id)}">View details &amp; reviews</a>
    <p class="product-card__price">${window.NB_formatPrice(p.price)}</p>
    ${p.price != null ? `<p class="product-card__sub">or <strong>${window.NB_formatPrice(window.NB_linePrice(p, "sub"))}</strong>/mo with Subscribe &amp; save 15%</p>` : ""}
    ${p.available === false
      ? `<button class="btn" type="button" disabled>Sold out</button>`
      : `<button class="btn" type="button" data-add-to-cart="${p.id}">Add to cart</button>`}
  </li>`).join("");
}

// Keep the card short; the full text sits under "Full description".
function shortText(text) {
  if (!text) return "";
  return text.length > 220 ? text.slice(0, 220).replace(/\s+\S*$/, "") + "…" : text;
}

// Wait for the live products so the old local list never flashes on screen.
function showProducts() {
  renderShop();
  window.NB_paintFavs && window.NB_paintFavs();
  // Jump to a product when arriving from a "Shop now" link (shop.html#id)
  if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
}
if (window.NB_productsLoaded) {
  showProducts(); // products arrived before this script loaded
} else {
  grid.innerHTML = `<li class="product-card__meta">Loading products…</li>`;
  window.addEventListener("nb:products", showProducts, { once: true });
}

// Real Judge.me ratings: stars on each card + overall badge in the header.
function showRatings(data) {
  if (!data) return;
  document.querySelectorAll("[data-rating-for]").forEach((el) => {
    const r = data.products[el.dataset.ratingFor];
    if (r && r.total) {
      el.innerHTML = `${window.NB_stars(r.average, 15)} <span>${r.average.toFixed(1)} (${r.total.toLocaleString("en-US")})</span>`;
      el.hidden = false;
    }
  });
  const badge = document.querySelector("[data-overall-rating]");
  if (badge && data.overall.total) {
    badge.innerHTML = `${window.NB_stars(data.overall.average, 16)} <span>${data.overall.average.toFixed(1)} from ${data.overall.total.toLocaleString("en-US")} happy customers</span>`;
    badge.hidden = false;
  }
}
window.NB_reviewSummary.then((data) => {
  ratings = data;
  if (data && F.sort === "rating") renderShop();
  showRatings(data);
  window.addEventListener("nb:products", () => setTimeout(() => showRatings(data), 0));
});
