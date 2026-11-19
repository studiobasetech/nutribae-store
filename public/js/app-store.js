/* ==========================================================================
   NutriBae app — shared state for My Sweet Day, Bae Points, Sweet Plan,
   recipes (favorites, pantry, cooked) and Sweet Swap.

   v1 keeps everything in this browser (localStorage). When customer accounts
   arrive, swap load()/save() for calls to the backend and nothing else changes.
   ========================================================================== */
(function () {
  const KEY = "nb_app_v1";
  const today = (d = new Date()) => d.toLocaleDateString("en-CA"); // YYYY-MM-DD, local time

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
  }
  const s = Object.assign(
    {
      days: {},      // "2026-11-17": { water, scoops:{handle:n}, activity:{steps,activeMin,source}, feel:{...} }
      points: 0,
      history: [],   // [{ key, pts, label, at }]
      badges: [],
      plan: null,    // Sweet Plan result
      waterGoal: 8,
      pantry: [],    // product handles the shopper has at home
      favs: [],      // recipe ids
      cooked: [],    // [{ id, at }]
      swaps: [],     // craving ids tried
      refill: {},    // handle: { servings, opened }
    },
    load()
  );

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode: lasts this visit */ }
    window.dispatchEvent(new Event("nb:app"));
  }

  function day(d = today()) {
    if (!s.days[d]) s.days[d] = { water: 0, scoops: {}, activity: null, feel: null };
    return s.days[d];
  }

  function active(d) {
    const x = s.days[d];
    return !!x && (x.water > 0 || x.feel || Object.values(x.scoops || {}).some((n) => n > 0) || (x.activity && x.activity.steps));
  }

  // Consecutive active days ending today (or yesterday, so a streak survives until tonight).
  function streak() {
    const d = new Date();
    if (!active(today(d))) d.setDate(d.getDate() - 1);
    let n = 0;
    while (active(today(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  const BADGES = [
    { id: "hello", name: "Hello, bae", desc: "Your first check-in", icon: "🌸" },
    { id: "streak-3", name: "Sweet streak", desc: "3 days in a row", icon: "🔥" },
    { id: "streak-7", name: "Week of sweetness", desc: "7 days in a row", icon: "🌈" },
    { id: "hydrated", name: "Hydration hero", desc: "Hit your water goal", icon: "💧" },
    { id: "chef", name: "Sweet chef", desc: "Cook your first recipe", icon: "🧁" },
    { id: "chef-5", name: "Kitchen bae", desc: "Cook 5 recipes", icon: "👩‍🍳" },
    { id: "planner", name: "Plan maker", desc: "Make your Sweet Plan", icon: "📝" },
    { id: "swapper", name: "Swap star", desc: "Try 3 Sweet Swaps", icon: "⭐" },
    { id: "mover", name: "On the move", desc: "Log 10,000 steps in a day", icon: "👟" },
  ];

  const LEVELS = [
    { min: 0, name: "Sugar Cube" },
    { min: 250, name: "Cupcake" },
    { min: 750, name: "Layer Cake" },
    { min: 1500, name: "Wedding Cake" },
  ];
  function level(points = s.points) {
    let i = 0;
    LEVELS.forEach((l, k) => { if (points >= l.min) i = k; });
    return { ...LEVELS[i], next: LEVELS[i + 1] || null };
  }

  function badge(id) {
    if (s.badges.includes(id)) return;
    const b = BADGES.find((x) => x.id === id);
    if (!b) return;
    s.badges.push(id);
    save();
    toast(`${b.icon} New badge: ${b.name}`);
  }

  function checkBadges() {
    const st = streak();
    if (Object.keys(s.days).some(active)) badge("hello");
    if (st >= 3) badge("streak-3");
    if (st >= 7) badge("streak-7");
    if (s.cooked.length >= 1) badge("chef");
    if (new Set(s.cooked.map((c) => c.id)).size >= 5 || s.cooked.length >= 5) badge("chef-5");
    if (s.plan) badge("planner");
    if (s.swaps.length >= 3) badge("swapper");
    if (Object.values(s.days).some((d) => d.water >= s.waterGoal)) badge("hydrated");
    if (Object.values(s.days).some((d) => d.activity && d.activity.steps >= 10000)) badge("mover");
  }

  // Each key earns points once (e.g. "checkin:2026-11-17").
  function award(key, pts, label) {
    if (s.history.some((h) => h.key === key)) { checkBadges(); return false; }
    s.points += pts;
    s.history.unshift({ key, pts, label, at: Date.now() });
    s.history = s.history.slice(0, 300);
    save();
    toast(`+${pts} Bae Points · ${label}`);
    checkBadges();
    return true;
  }

  /* ---------- Toast ---------- */
  let toastEl, toastTimer;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "nb-toast";
      toastEl.setAttribute("role", "status");
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("is-on"), 2600);
  }

  /* ---------- Small helpers shared by the app pages ---------- */
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // Live products (not bundles) once Shopify has loaded.
  function products() {
    return (window.NB_PRODUCTS || []).filter((p) => p && p.id && !String(p.id).startsWith("bundle-"));
  }
  function findByName(re) { return products().find((p) => re.test(p.name || "") || re.test(p.id)); }

  function addToCart(ids, plan = "sub") {
    if (!window.NB_cart) return;
    ids.forEach((id) => window.NB_cart.add(id, 1, plan));
    window.NB_openDrawer && window.NB_openDrawer("cart-drawer");
  }

  window.NB_app = {
    get state() { return s; },
    save, today, day, streak, award, badge, checkBadges, toast,
    BADGES, LEVELS, level, esc, products, findByName, addToCart,
  };
})();
