/* ==========================================================================
   Shared layout — header, menu, cart drawer, footer.
   Edit the nav or footer HERE once and every page updates.
   Each page has <div id="site-top"></div> and <div id="site-bottom"></div>
   and sets <body data-page="home|shop|about|faq">.
   ========================================================================== */

(function () {
  // Menu: grouped for the left sidebar (desktop) and the menu drawer (phone).
  // desk: also shown in the top header on mid-size screens.
  const ICON = {
    home: '<path d="M3 9.5L10 3.5l7 6V17h-4.5v-4.5h-5V17H3z"/>',
    shop: '<path d="M3 7h14l-1 10.5H4z"/><path d="M7 7V5.5a3 3 0 0 1 6 0V7"/>',
    bakery: '<path d="M4.5 10.5h11l-1.4 7h-8.2z"/><path d="M4 10.5a3 3 0 0 1 1.5-5.6A4 4 0 0 1 10 3a4 4 0 0 1 4.5 1.9 3 3 0 0 1 1.5 5.6"/><path d="M8 13.5v2M12 13.5v2"/>',
    profile: '<circle cx="10" cy="7" r="3.3"/><path d="M3.5 17.5c.8-3.3 3.4-5 6.5-5s5.7 1.7 6.5 5"/>',
    myday: '<path d="M10 17.5s-6.5-4-6.5-8.3A3.6 3.6 0 0 1 10 7a3.6 3.6 0 0 1 6.5 2.2c0 4.3-6.5 8.3-6.5 8.3z"/>',
    recipes: '<path d="M4 3.5h9.5a2 2 0 0 1 2 2v11h-9.5a2 2 0 0 1-2-2z"/><path d="M4 14.5a2 2 0 0 1 2-2h9.5"/>',
    plan: '<path d="M10 2.5l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L2.8 7.8l5-.7z"/>',
    swap: '<path d="M4 7h11l-3-3M16 13H5l3 3"/>',
    about: '<circle cx="10" cy="10" r="7.5"/><path d="M10 9v5M10 6.2v.1"/>',
    faq: '<circle cx="10" cy="10" r="7.5"/><path d="M7.8 7.8a2.3 2.3 0 1 1 3.2 2.1c-.6.3-1 .8-1 1.5v.4M10 14.2v.1"/>',
  };
  const GROUPS = [
    { label: "Shop", items: [
      { id: "home", label: "Home", href: "index.html", desk: true },
      { id: "shop", label: "Shop", href: "shop.html", desk: true },
    ] },
    { label: "My NutriBae", items: [
      { id: "myday", label: "My Sweet Day", href: "my-day.html", desk: true },
      { id: "bakery", label: "Play To Win", href: "bakery.html" },
      { id: "recipes", label: "Recipes", href: "recipes.html", desk: true },
      { id: "plan", label: "Quiz Lab", href: "plan.html" },
      { id: "swap", label: "Sweet Swap", href: "swap.html" },
    ] },
    { label: "About", items: [
      { id: "about", label: "About us", href: "about.html", desk: true },
      { id: "faq", label: "FAQ", href: "faq.html", desk: true },
    ] },
  ];
  const NAV = GROUPS.flatMap((g) => g.items);
  const svg = (id) => `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[id]}</svg>`;
  const groupedLinks = () => GROUPS.map((g) => `
      <p class="side-nav__label">${g.label}</p>
      <ul class="side-nav__list">
        ${g.items.map((n) => `<li><a href="${n.href}"${current(n.id)}>${svg(n.id)}<span>${n.label}</span></a></li>`).join("")}
      </ul>`).join("");

  // App tab bar (phones): on the app pages, and on every page when NutriBae
  // is installed to the home screen.
  const TABS = [
    { id: "myday", label: "Today", href: "my-day.html", icon: '<path d="M10 17.5s-6.5-4-6.5-8.3A3.6 3.6 0 0 1 10 7a3.6 3.6 0 0 1 6.5 2.2c0 4.3-6.5 8.3-6.5 8.3z"/>' },
    { id: "recipes", label: "Recipes", href: "recipes.html", icon: '<path d="M4 3.5h9.5a2 2 0 0 1 2 2v11h-9.5a2 2 0 0 1-2-2z"/><path d="M4 14.5a2 2 0 0 1 2-2h9.5"/>' },
    { id: "bakery", label: "Play To Win", href: "bakery.html", icon: '<path d="M4.5 10.5h11l-1.4 7h-8.2z"/><path d="M4 10.5a3 3 0 0 1 1.5-5.6A4 4 0 0 1 10 3a4 4 0 0 1 4.5 1.9 3 3 0 0 1 1.5 5.6"/><path d="M8 13.5v2M12 13.5v2"/>' },
    { id: "plan", label: "Quizzes", href: "plan.html", icon: '<path d="M10 2.5l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L2.8 7.8l5-.7z"/>' },
    { id: "shop", label: "Shop", href: "shop.html", icon: '<path d="M3 7h14l-1 10.5H4z"/><path d="M7 7V5.5a3 3 0 0 1 6 0V7"/>' },
  ];
  const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  const showTabs = document.body.hasAttribute("data-app") || standalone;

  const SOCIAL = {
    facebook: "#",  // TODO: your Facebook URL
    instagram: "#", // TODO
    youtube: "#",   // TODO
    tiktok: "#",    // TODO
  };

  // Stripe customer portal login link, so subscribers can skip, change or
  // cancel. Stripe Dashboard → Settings → Billing → Customer portal → copy the
  // login link and paste it here. The footer link stays hidden while empty.
  const STRIPE_PORTAL_URL = "";

  const page = document.body.dataset.page || "";

  // Bakery invite links (?ref=CODE) work on any page: remember the friend.
  try {
    const ref = new URLSearchParams(location.search).get("ref");
    if (ref) localStorage.setItem("nb_ref", ref.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8));
  } catch { /* ignore */ }
  const current = (id) => (id === page ? ' aria-current="page"' : "");

  const icons = {
    menu: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M3 6h14M3 14h14"/></svg>',
    search: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="8.5" cy="8.5" r="6"/><path d="M13 13l4.5 4.5"/></svg>',
    account: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="10" cy="6.5" r="3.8"/><path d="M3 18c0-4 3.2-6 7-6s7 2 7 6z"/></svg>',
    bag: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M3 7h14l-1 10.5H4z"/><path d="M7 7V5.5a3 3 0 0 1 6 0V7"/></svg>',
    panel: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="3.5" width="15" height="13" rx="2.5"/><path d="M7.5 3.5v13"/></svg>',
    close: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M2 2l12 12M14 2L2 14"/></svg>',
  };

  const top = `
    <aside class="sidebar" id="sidebar" aria-label="Main menu">
      <div class="sidebar__top">
        <a class="sidebar__logo" href="index.html" aria-label="NutriBae home">
          <img src="assets/images/logo.png" alt="NutriBae" width="130" height="38">
        </a>
        <button class="sidebar__toggle" type="button" aria-label="Close menu" aria-controls="sidebar" aria-expanded="true" data-sidebar-toggle>${icons.panel}</button>
      </div>
      <nav class="side-nav">${groupedLinks()}</nav>
    </aside>

    <div class="announcement">Free shipping on all USA orders</div>
    <header class="site-header">
      <div class="container site-header__inner">
        <div class="site-header__left">
          <button class="icon-btn sidebar-open" type="button" aria-label="Open menu" aria-controls="sidebar" aria-expanded="false" data-sidebar-toggle>${icons.panel}</button>
          <button class="icon-btn menu-toggle" type="button" aria-label="Open menu" aria-controls="menu-drawer" aria-expanded="false" data-open="menu-drawer">${icons.menu}</button>
          <button class="icon-btn search-icon" type="button" aria-label="Search" data-search-open>${icons.search}</button>
          <form class="hsearch hsearch--desk" role="search" data-hsearch>${icons.search}<input type="search" placeholder="Search products, recipes…" aria-label="Search NutriBae" autocomplete="off" enterkeyhint="search"></form>
          <nav class="site-nav" aria-label="Main">
            ${NAV.filter((n) => n.desk).map((n) => `<a href="${n.href}"${current(n.id)}>${n.label}</a>`).join("")}
          </nav>
        </div>
        <a class="site-header__logo" href="index.html" aria-label="NutriBae home">
          <img src="assets/images/logo.png" alt="NutriBae" width="104" height="30">
        </a>
        <div class="site-header__right">
          <!-- TODO: customer accounts (step 3) -->
          <a class="icon-btn" href="${(() => { try { return localStorage.getItem("nb_auth") || localStorage.getItem("nb_guest") ? "profile.html" : "login.html"; } catch { return "login.html"; } })()}" aria-label="My profile" data-account-link${["profile", "login"].includes(document.body.dataset.page) ? ' aria-current="page"' : ""}>${icons.account}</a>
          <button class="icon-btn" type="button" aria-label="Open cart" aria-controls="cart-drawer" aria-expanded="false" data-open="cart-drawer">
            ${icons.bag}<span class="cart-count" data-cart-count hidden>0</span>
          </button>
        </div>
      </div>
    </header>
    <div class="hsearch-row"><form class="hsearch" role="search" data-hsearch>${icons.search}<input type="search" placeholder="Search products, recipes…" aria-label="Search NutriBae" autocomplete="off" enterkeyhint="search"></form></div>

    <div class="overlay" data-overlay></div>

    <aside class="drawer drawer--left" id="menu-drawer" aria-label="Menu" aria-hidden="true">
      <div class="drawer__head">
        <img src="assets/images/logo.png" alt="NutriBae" width="104" height="30" style="width:104px;height:auto">
        <button class="icon-btn" type="button" aria-label="Close menu" data-close>${icons.close}</button>
      </div>
      <nav class="drawer__body side-nav" aria-label="Mobile">${groupedLinks()}</nav>
    </aside>

    <aside class="drawer drawer--right" id="cart-drawer" aria-label="Your cart" aria-hidden="true">
      <div class="drawer__head">
        <h2 class="drawer__title">Your sweet stash</h2>
        <button class="icon-btn" type="button" aria-label="Close cart" data-close>${icons.close}</button>
      </div>
      <div class="drawer__body" data-cart-lines></div>
      <div class="drawer__foot">
        <div class="cart-subtotal"><span>Subtotal</span><span data-cart-subtotal>$0.00</span></div>
        <p class="cart-note">Free shipping in the USA. Taxes calculated at checkout.</p>
        <button class="btn btn--block" type="button" data-checkout>Check out</button>
        <p class="form-msg" role="alert" data-checkout-msg></p>
      </div>
    </aside>
  `;

  const bottom = `
    <footer class="site-footer">
      <nav class="footer-links" aria-label="Footer">
        ${NAV.filter((n) => n.desk).map((n) => `<a href="${n.href}">${n.label}</a>`).join("")}
        ${STRIPE_PORTAL_URL ? `<a href="${STRIPE_PORTAL_URL}">Manage subscription</a>` : ""}
        <a href="#">Terms and Policies</a> <!-- TODO: terms page -->
      </nav>
      <div>© ${new Date().getFullYear()} NutriBae</div>
      <div class="socials">
        <a href="${SOCIAL.facebook}" aria-label="Facebook"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="currentColor"/><path d="M13.3 23v-8.2h2.6l.4-3h-3V9.9c0-.9.3-1.5 1.5-1.5h1.6V5.7c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H7.6v3h2.6V23z" fill="#fff"/></svg></a>
        <a href="${SOCIAL.instagram}" aria-label="Instagram"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2.5" y="2.5" width="19" height="19" rx="5.5"/><circle cx="12" cy="12" r="4.3"/><circle cx="17.6" cy="6.4" r="1" fill="currentColor" stroke="none"/></svg></a>
        <a href="${SOCIAL.youtube}" aria-label="YouTube"><svg viewBox="0 0 24 18" aria-hidden="true"><rect x=".5" y="1" width="23" height="16" rx="4.5" fill="currentColor"/><path d="M9.5 5.2v7.6L16 9z" fill="#fff"/></svg></a>
        <a href="${SOCIAL.tiktok}" aria-label="TikTok"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16.5 2c.3 2.6 1.9 4.3 4.5 4.5v3.2c-1.6.1-3-.4-4.5-1.3v6.4c0 4.1-3.4 6.7-7 6.1-3.3-.5-5.4-3.8-4.6-7 .7-2.8 3.4-4.6 6.3-4.2v3.4c-1.5-.4-3 .5-3.2 2-.2 1.4.8 2.6 2.2 2.7 1.4.1 2.6-.9 2.6-2.4V2z" fill="currentColor"/></svg></a>
      </div>
    </footer>
    ${showTabs ? `<nav class="tabbar" aria-label="App">
      ${TABS.map((t) => `<a href="${t.href}"${current(t.id)}><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${t.icon}</svg><span>${t.label}</span></a>`).join("")}
    </nav>` : ""}
  `;

  document.getElementById("site-top").outerHTML = top;
  document.getElementById("site-bottom").outerHTML = bottom;
  if (showTabs) document.body.classList.add("has-tabbar");

  /* ---------- Desktop sidebar: open / close (remembered) ---------- */
  const SB_KEY = "nb_sidebar_closed";
  function setSidebar(closed, save = true) {
    document.body.classList.toggle("sidebar-closed", closed);
    document.querySelectorAll("[data-sidebar-toggle]").forEach((b) => b.setAttribute("aria-expanded", String(!closed)));
    const side = document.getElementById("sidebar");
    if (side) side.inert = closed && window.matchMedia("(min-width: 1024px)").matches;
    if (save) { try { localStorage.setItem(SB_KEY, closed ? "1" : "0"); } catch { /* ignore */ } }
  }
  let sbClosed = false;
  try { sbClosed = localStorage.getItem(SB_KEY) === "1"; } catch { /* ignore */ }
  setSidebar(sbClosed, false);
  requestAnimationFrame(() => document.body.classList.add("sidebar-ready")); // animate only after first paint
  document.addEventListener("click", (e) => {
    if (!e.target.closest("[data-sidebar-toggle]")) return;
    setSidebar(!document.body.classList.contains("sidebar-closed"));
    const target = document.body.classList.contains("sidebar-closed") ? ".site-header .sidebar-open" : ".sidebar__toggle";
    const t = document.querySelector(target); if (t) t.focus();
  });

  // Installable app + offline support (see sw.js).
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
  }

  /* ---------- Drawer open / close ---------- */
  const overlay = document.querySelector("[data-overlay]");
  let openDrawer = null;
  let lastFocus = null;

  function open(id) {
    const d = document.getElementById(id);
    if (!d) return;
    if (openDrawer) close();
    lastFocus = document.activeElement;
    d.classList.add("is-open");
    d.setAttribute("aria-hidden", "false");
    overlay.classList.add("is-open");
    document.querySelectorAll(`[aria-controls="${id}"]`).forEach((b) => b.setAttribute("aria-expanded", "true"));
    document.body.style.overflow = "hidden";
    openDrawer = d;
    const first = d.querySelector("button, a, input");
    if (first) first.focus();
  }

  function close() {
    if (!openDrawer) return;
    openDrawer.classList.remove("is-open");
    openDrawer.setAttribute("aria-hidden", "true");
    document.querySelectorAll(`[aria-controls="${openDrawer.id}"]`).forEach((b) => b.setAttribute("aria-expanded", "false"));
    overlay.classList.remove("is-open");
    document.body.style.overflow = "";
    openDrawer = null;
    if (lastFocus) lastFocus.focus();
  }

  document.addEventListener("click", (e) => {
    const opener = e.target.closest("[data-open]");
    if (opener) { open(opener.dataset.open); return; }
    if (e.target.closest("[data-close]") || e.target === overlay) close();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

  // Customer accounts (Google / Apple sign-in) on every page.
  if (!document.querySelector('script[src="js/auth.js"]')) {
    const as = document.createElement("script");
    as.src = "js/auth.js";
    document.head.appendChild(as);
  }
  const markSignedIn = () => {
    let signed = false; try { signed = !!localStorage.getItem("nb_auth"); } catch { /* ignore */ }
    document.querySelectorAll("[data-account-link]").forEach((a) => {
      a.classList.toggle("is-signed-in", signed);
      let guest = false; try { guest = !!localStorage.getItem("nb_guest"); } catch { /* ignore */ }
      a.href = signed || guest ? "profile.html" : "login.html";
    });
  };
  markSignedIn();
  window.addEventListener("nb:auth", markSignedIn);

  // Search: the bar in the header (and the magnifier) open the results panel.
  let searchLoading = null;
  function loadSearch() {
    if (window.NB_search) return Promise.resolve();
    if (!searchLoading) searchLoading = new Promise((res) => {
      const sc = document.createElement("script");
      sc.src = "js/search.js";
      sc.onload = res; sc.onerror = res;
      document.head.appendChild(sc);
    });
    return searchLoading;
  }
  // Ready before anyone taps, so the keyboard stays open on phones.
  (window.requestIdleCallback || ((f) => setTimeout(f, 800)))(loadSearch);
  function openSearch(q) {
    if (window.NB_search) return window.NB_search.open(q);
    loadSearch().then(() => window.NB_search && window.NB_search.open(q));
  }
  document.addEventListener("click", (e) => { if (e.target.closest("[data-search-open]")) openSearch(""); });
  document.addEventListener("focusin", (e) => {
    const inp = e.target.closest("[data-hsearch] input");
    if (inp) { const q = inp.value; inp.value = ""; inp.blur(); openSearch(q); }
  });
  document.addEventListener("submit", (e) => {
    const f = e.target.closest("[data-hsearch]");
    if (f) { e.preventDefault(); openSearch(f.querySelector("input").value); }
  });

  // Favorite products (saved on this device; shown in My profile → Favorites).
  const FAV_KEY = "nb_fav_products";
  const favList = () => { try { return JSON.parse(localStorage.getItem(FAV_KEY)) || []; } catch { return []; } };
  window.NB_favs = {
    list: favList,
    has: (id) => favList().includes(id),
    toggle(id) {
      const l = favList();
      const next = l.includes(id) ? l.filter((x) => x !== id) : [id, ...l];
      try { localStorage.setItem(FAV_KEY, JSON.stringify(next.slice(0, 50))); } catch { /* ignore */ }
      window.dispatchEvent(new Event("nb:favs"));
      return next.includes(id);
    },
  };
  const paintFavs = () => document.querySelectorAll("[data-fav-product]").forEach((b) => {
    const on = window.NB_favs.has(b.dataset.favProduct);
    b.setAttribute("aria-pressed", String(on));
    b.setAttribute("aria-label", on ? "Remove from favorites" : "Save to favorites");
  });
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-fav-product]");
    if (!b) return;
    e.preventDefault();
    const on = window.NB_favs.toggle(b.dataset.favProduct);
    paintFavs();
    if (window.NB_app && window.NB_app.toast) window.NB_app.toast(on ? "Saved to your favorites 💗" : "Removed from favorites");
  });
  window.NB_paintFavs = paintFavs;
  window.addEventListener("nb:favs", paintFavs);

  window.NB_openDrawer = open;
  window.NB_closeDrawer = close;
})();
