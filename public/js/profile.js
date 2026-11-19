/* ==========================================================================
   My profile (profile.html): everything a shopper has with NutriBae on this
   device: orders, coupons, Play To Win, subscription, recipes, My Sweet Day
   and settings. Data comes from this browser plus /api/order, /api/spin
   and /api/bakery (no passwords; accounts can replace this later).
   ========================================================================== */
(function () {
  const root = document.querySelector("[data-profile]");
  if (!root) return;
  try {
    if (!localStorage.getItem("nb_auth") && !localStorage.getItem("nb_guest")) { location.replace(`login.html?next=profile.html${location.hash}`); return; }
  } catch { /* storage blocked: show the profile */ }
  const $ = (s) => root.querySelector(s);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const set = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* ignore */ } };
  const json = (k, d) => { try { return JSON.parse(get(k)) ?? d; } catch { return d; } };
  const money = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
  const short = (t) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const thumb = (u, w = 200) => (u && /cdn\.shopify\.com/.test(u) ? u + (u.includes("?") ? "&" : "?") + `width=${w}` : u);
  const app = window.NB_app;
  const S = app ? app.state : {};

  const data = { spin: null, game: null, orders: [] };

  /* ---------- Hello card ---------- */
  function drawHello() {
    const p = json("nb_spin_profile", {}) || {};
    const name = (p.firstName || (data.spin && data.spin.firstName) || (data.game && data.game.firstName) || "").trim();
    const shown = name && name !== "bae" ? name : "";
    $("[data-pf-avatar]").textContent = (shown || "B").charAt(0).toUpperCase();
    $("[data-pf-hello]").textContent = `Hi, ${shown || "bae"} 💗`;
    $("[data-pf-email]").textContent = p.email || "Spin the wheel or place an order to connect your email.";
    const lvl = app ? app.level() : null;
    const chips = [];
    if (lvl) chips.push(`<span class="pf-chip">🧁 ${esc(lvl.name)}</span>`);
    if (data.game) chips.push(`<span class="pf-chip">⭐ ${data.game.sprinkles.toLocaleString("en-US")} stars</span>`);
    if (app) chips.push(`<span class="pf-chip">💗 ${S.points || 0} Bae Points</span>`);
    if (p.mm && p.dd) chips.push(`<span class="pf-chip">🎂 ${new Date(2000, p.mm - 1, p.dd).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>`);
    $("[data-pf-chips]").innerHTML = chips.join("");
  }
  $("[data-pf-edit]").addEventListener("click", (e) => {
    const f = $("[data-pf-editform]");
    f.hidden = !f.hidden;
    e.currentTarget.setAttribute("aria-expanded", String(!f.hidden));
    if (!f.hidden) { f.firstName.value = (json("nb_spin_profile", {}) || {}).firstName || ""; f.firstName.focus(); }
  });
  $("[data-pf-editform]").addEventListener("submit", (e) => {
    e.preventDefault();
    const p = json("nb_spin_profile", {}) || {};
    p.firstName = e.target.firstName.value.trim().slice(0, 40);
    set("nb_spin_profile", JSON.stringify(p));
    e.target.hidden = true;
    $("[data-pf-edit]").setAttribute("aria-expanded", "false");
    drawHello();
    app && app.toast("Saved 💗");
  });

  /* ---------- Quick stats ---------- */
  function drawStats() {
    const coupons = activeCoupons().length;
    const stats = [
      ["⭐", data.game ? data.game.sprinkles.toLocaleString("en-US") : "0", "Stars", "bakery.html"],
      ["🎟️", String(coupons), coupons === 1 ? "Coupon" : "Coupons", "#coupons"],
      ["🔥", String(app ? app.streak() : 0), "Day streak", "my-day.html"],
      ["❤️", String((S.favs || []).length + (window.NB_favs ? window.NB_favs.list().length : 0)), "Favorites", "#favorites"],
    ];
    $("[data-pf-stats]").innerHTML = stats.map(([i, n, l, h]) => `<li><a href="${h}"><span class="pf-stats__icon">${i}</span><strong>${n}</strong><small>${l}</small></a></li>`).join("");
  }

  /* ---------- Orders ---------- */
  async function drawOrders() {
    const box = $("[data-pf-orders]");
    const saved = json("nb_orders", []) || [];
    if (!saved.length) {
      box.innerHTML = `<div class="pf-empty"><p><strong>No orders on this device yet.</strong> Your orders show up here after you check out, with live shipping status.</p><a class="btn" href="shop.html">Shop now</a></div>`;
      return;
    }
    box.innerHTML = `<p class="pf-muted">Loading your orders…</p>`;
    const results = await Promise.all(saved.slice(0, 10).map((o) => fetch(`/api/order?session_id=${encodeURIComponent(o.id)}`).then((r) => (r.ok ? r.json() : { id: o.id, at: o.at, error: true })).catch(() => ({ id: o.id, at: o.at, error: true }))));
    data.orders = results;
    box.innerHTML = `<ul class="pf-orders">${results.map((o) => {
      if (o.error) return `<li class="pf-order"><div class="pf-order__top"><strong>Order from ${short(o.at)}</strong><span class="pf-pill">Placed</span></div><p class="pf-muted pf-small">Details will show here soon.</p></li>`;
      const tone = /Shipped/.test(o.status) ? "is-good" : "";
      return `<li class="pf-order">
        <div class="pf-order__top"><strong>${o.orderName ? `Order ${esc(o.orderName)}` : `Order from ${short(o.createdAt)}`}</strong><span class="pf-pill ${tone}">${esc(o.status)}</span></div>
        <p class="pf-muted pf-small">${short(o.createdAt)} · ${money(o.total)}${o.subscription ? " · Subscribe & Save" : ""}</p>
        <ul class="pf-order__items">${o.items.map((i) => `<li>${esc(i.name)}${i.qty > 1 ? ` × ${i.qty}` : ""}</li>`).join("")}</ul>
        ${o.tracking && o.tracking.length ? `<div class="pf-btns">${o.tracking.map((t) => t.url ? `<a class="btn btn--outline" href="${esc(t.url)}" target="_blank" rel="noopener">Track package${t.company ? ` (${esc(t.company)})` : ""}</a>` : `<span class="pf-small">Tracking: ${esc(t.number)}</span>`).join("")}</div>` : ""}
      </li>`;
    }).join("")}</ul>`;
  }

  /* ---------- Coupons (wheel + Play To Win) ---------- */
  const SOURCE = { first: "Spin to win", birthday: "Birthday spin", order: "Order bonus spin", weekly: "Weekly spin", stars: "Play To Win stars", friend: "Friend welcome gift" };
  function allCoupons() {
    const list = [];
    ((data.spin && data.spin.coupons) || []).forEach((c) => list.push(c));
    const local = json("nb_spin_result", null);
    if (local && local.code) list.push({ code: local.code, label: local.label, kind: local.kind });
    if (data.game) {
      (data.game.coupons || []).forEach((c) => list.push({ code: c.code, label: c.label, kind: "stars", at: c.at, expiresAt: c.at ? c.at + 60 * 86400000 : null }));
      if (data.game.friendCode) list.push({ code: data.game.friendCode, label: "15% off your first order", kind: "friend", note: "First order only" });
    }
    const seen = new Set();
    return list.filter((c) => c && c.code && (seen.has(c.code) ? false : seen.add(c.code)));
  }
  const activeCoupons = () => allCoupons().filter((c) => !c.expiresAt || c.expiresAt > Date.now());
  function drawCoupons() {
    const list = allCoupons();
    const ul = $("[data-pf-coupons]");
    if (!list.length) { ul.innerHTML = `<li class="mycoupons__empty">No coupons yet. Spin the wheel, play or order to win your first one 💗</li>`; return; }
    const now = Date.now();
    const act = list.filter((c) => !c.expiresAt || c.expiresAt > now);
    const old = list.filter((c) => c.expiresAt && c.expiresAt <= now).slice(0, 3);
    const row = (c, off) => `<li class="mycoupon ${off ? "is-expired" : ""}">
      <div class="mycoupon__deal"><strong>${esc(c.label || "Discount")}</strong><small>${esc(SOURCE[c.kind] || "Reward")}</small></div>
      <div class="mycoupon__code"><code>${esc(c.code)}</code><small>${off ? "Expired" : c.expiresAt ? `Valid until ${short(c.expiresAt)}` : esc(c.note || "One-time use")}</small></div>
      ${off ? "" : `<div class="mycoupon__btns"><button type="button" class="spin-code__copy" data-pf-copy="${esc(c.code)}">Copy</button><button type="button" class="mycoupon__use" data-pf-use="${esc(c.code)}">Use</button></div>`}
    </li>`;
    ul.innerHTML = act.map((c) => row(c, false)).join("") + old.map((c) => row(c, true)).join("");
  }

  /* ---------- Play To Win ---------- */
  function drawGame() {
    const box = $("[data-pf-game]");
    const g = data.game;
    if (!g) {
      box.innerHTML = `<div class="pf-empty"><p><strong>Win free NutriBae.</strong> Play the game, invite friends and get a product for $0 with free shipping.</p><a class="btn" href="bakery.html">Play To Win</a></div>`;
      return;
    }
    const ev = g.event && !g.event.claimed && !g.event.expired ? g.event : null;
    const item = ev && window.NB_findItem ? window.NB_findItem(ev.prize) : null;
    const link = `${location.origin}/bakery.html?ref=${encodeURIComponent(g.code)}`;
    let challenge = `<div class="pf-empty pf-empty--soft"><p><strong>Pick your free product</strong> and start inviting friends.</p><a class="btn" href="bakery.html">Choose my free product</a></div>`;
    if (ev) {
      const total = ev.needSignups + ev.needOrders, done = Math.min(ev.signups, ev.needSignups) + Math.min(ev.orders, ev.needOrders);
      const pct = Math.round((done / total) * 100);
      const left = Math.max(0, ev.endsAt - Date.now()), d = Math.floor(left / 86400000), h = Math.floor((left % 86400000) / 3600000);
      challenge = `<div class="pf-challenge">
        <div class="pf-challenge__img">${item && item.image ? `<img src="${esc(thumb(item.image))}" alt="">` : "🎁"}<b>FREE</b></div>
        <div class="pf-challenge__body">
          <strong>Free ${esc(item ? item.shortName || item.name : "product")}</strong>
          <div class="pf-bar"><span style="width:${ev.done ? 100 : pct}%"></span></div>
          <small>${ev.done ? "Ready to claim! 🎉" : `${ev.signups}/${ev.needSignups} friends joined · ${ev.orders}/${ev.needOrders} first orders · ⏳ ${d}d ${h}h left`}</small>
        </div>
      </div>`;
    }
    box.innerHTML = `${challenge}
      <div class="pf-invite">
        <label for="pf-ref">My invite link</label>
        <div class="pf-invite__row"><input id="pf-ref" readonly value="${esc(link)}"><button class="btn" type="button" data-pf-copy="${esc(link)}">Copy</button></div>
        <small class="pf-muted">Friends get 15% off their first order. You get +25 ⭐ when they join and +100 ⭐ when they order.</small>
      </div>`;
  }

  /* ---------- Recipes + cookbook ---------- */
  function drawRecipes() {
    const tok = get("nb_cookbook");
    $("[data-pf-cookbook]").innerHTML = tok
      ? `<div class="pf-unlocked"><span>🎉</span><div><strong>Your cookbook is unlocked</strong><small>All 25 recipes are open in the app.</small></div><a class="btn btn--outline" href="/api/cookbook?t=${encodeURIComponent(tok)}&get=pdf">Download PDF</a></div>`
      : `<div class="pf-unlocked pf-unlocked--locked"><span>🔒</span><div><strong>Unlock all 25 recipes</strong><small>Free with any purchase, plus the Wellness Made Sweet PDF.</small></div><a class="btn" href="shop.html">Shop now</a></div>`;
  }

  /* ---------- Favorites: products + recipes ---------- */
  let favTab = "products";
  function drawFavs() {
    const prodIds = window.NB_favs ? window.NB_favs.list() : [];
    const prods = prodIds.map((id) => window.NB_findItem && window.NB_findItem(id)).filter(Boolean);
    const R = window.NB_RECIPES || [];
    const recs = (S.favs || []).map((id) => R.find((r) => r.id === id)).filter(Boolean);
    root.querySelector('[data-pf-count="products"]').textContent = prods.length ? `· ${prods.length}` : "";
    root.querySelector('[data-pf-count="recipes"]').textContent = recs.length ? `· ${recs.length}` : "";
    root.querySelectorAll("[data-pf-tab]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.pfTab === favTab)));
    const box = $("[data-pf-favbox]");
    if (favTab === "products") {
      box.innerHTML = prods.length
        ? `<ul class="pf-favprods">${prods.map((p) => `<li>
            <a class="pf-favprods__img" href="product.html?handle=${encodeURIComponent(p.id)}">${p.image ? `<img src="${esc(thumb(p.image, 300))}" alt="" loading="lazy">` : ""}</a>
            <div class="pf-favprods__body">
              <a href="product.html?handle=${encodeURIComponent(p.id)}"><strong>${esc(p.shortName || p.name)}</strong></a>
              <small>${p.price != null ? `${money(p.price)} · or ${money(window.NB_linePrice(p, "sub"))}/mo subscribed` : ""}</small>
              <div class="pf-favprods__btns"><button class="btn" type="button" data-add-to-cart="${esc(p.id)}" ${p.available === false ? "disabled" : ""}>${p.available === false ? "Sold out" : "Add to cart"}</button><button class="pf-link" type="button" data-pf-unfav="${esc(p.id)}">Remove</button></div>
            </div></li>`).join("")}</ul>`
        : `<div class="pf-empty"><p><strong>No favorite products yet.</strong> Tap the ♡ on any product to save it here.</p><a class="btn" href="shop.html">Browse products</a></div>`;
    } else {
      box.innerHTML = recs.length
        ? `<ul class="pf-favs">${recs.map((r) => `<li><a href="recipes.html?r=${encodeURIComponent(r.id)}"><img src="${esc(r.image)}" alt="" loading="lazy"><span>${esc(r.title)}</span><small>${r.minutes} min${r.macros ? ` · ${r.macros.protein}g protein` : ""}</small></a></li>`).join("")}</ul>`
        : `<div class="pf-empty"><p><strong>No saved recipes yet.</strong> Tap the ♡ on any recipe to save it here.</p><a class="btn" href="recipes.html">Find a recipe</a></div>`;
    }
  }
  root.addEventListener("click", (e) => {
    const tab = e.target.closest("[data-pf-tab]");
    if (tab) { favTab = tab.dataset.pfTab; drawFavs(); return; }
    const un = e.target.closest("[data-pf-unfav]");
    if (un && window.NB_favs) { window.NB_favs.toggle(un.dataset.pfUnfav); drawFavs(); drawStats(); }
  });
  window.addEventListener("nb:favs", () => { drawFavs(); drawStats(); });

  /* ---------- Addresses (saved on this device; used to fill checkout + prize forms) ---------- */
  const ADDR = "nb_addresses";
  const addrs = () => json(ADDR, []) || [];
  const saveAddrs = (l) => set(ADDR, JSON.stringify(l.slice(0, 10)));
  const STATES = "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" ");
  let editing = null; // address id, "new" or null
  function addrForm(a = {}) {
    return `<form class="pf-addrform" data-pf-addrform novalidate>
      <div class="pf-addrform__row"><label>Full name<input name="name" autocomplete="name" required value="${esc(a.name || "")}"></label></div>
      <div class="pf-addrform__row"><label>Address<input name="line1" autocomplete="address-line1" required value="${esc(a.line1 || "")}"></label></div>
      <div class="pf-addrform__row"><label>Apt, suite (optional)<input name="line2" autocomplete="address-line2" value="${esc(a.line2 || "")}"></label></div>
      <div class="pf-addrform__row pf-addrform__row--3">
        <label>City<input name="city" autocomplete="address-level2" required value="${esc(a.city || "")}"></label>
        <label>State<select name="state" autocomplete="address-level1" required><option value="">—</option>${STATES.map((st) => `<option ${a.state === st ? "selected" : ""}>${st}</option>`).join("")}</select></label>
        <label>ZIP<input name="zip" inputmode="numeric" autocomplete="postal-code" maxlength="10" required value="${esc(a.zip || "")}"></label>
      </div>
      <div class="pf-addrform__row"><label>Phone (for delivery updates)<input name="phone" type="tel" autocomplete="tel" required value="${esc(a.phone || "")}"></label></div>
      <label class="pf-check"><input type="checkbox" name="def" ${a.def || !addrs().length ? "checked" : ""}> Use as my default address</label>
      <p class="pf-small pf-muted">We ship within the USA.</p>
      <p class="form-msg" role="alert" data-pf-addrmsg></p>
      <div class="pf-btns"><button class="btn" type="submit">Save address</button><button class="btn btn--outline" type="button" data-pf-addr-cancel>Cancel</button></div>
    </form>`;
  }
  function drawAddresses() {
    const list = addrs();
    const box = $("[data-pf-addresses]");
    let html = "";
    if (list.length) {
      html += `<ul class="pf-addrs">${list.map((a) => editing === a.id ? `<li class="pf-addr is-editing">${addrForm(a)}</li>` : `<li class="pf-addr ${a.def ? "is-default" : ""}">
        <div class="pf-addr__top"><strong>${esc(a.name)}</strong>${a.def ? `<span class="pf-pill is-good">Default</span>` : ""}</div>
        <p>${esc(a.line1)}${a.line2 ? `, ${esc(a.line2)}` : ""}<br>${esc(a.city)}, ${esc(a.state)} ${esc(a.zip)}<br>${esc(a.phone)}</p>
        <div class="pf-addr__btns"><button class="pf-link" type="button" data-pf-addr-edit="${a.id}">Edit</button>${a.def ? "" : `<button class="pf-link" type="button" data-pf-addr-def="${a.id}">Make default</button>`}<button class="pf-link" type="button" data-pf-addr-del="${a.id}">Delete</button></div>
      </li>`).join("")}</ul>`;
    }
    if (editing === "new") html += addrForm();
    else if (!list.length) html += `<div class="pf-empty"><p><strong>No saved addresses yet.</strong> Save one to fill in checkout and your Play To Win prize faster.</p><button class="btn" type="button" data-pf-addr-new>Add an address</button></div>`;
    box.innerHTML = html;
    const f = box.querySelector("[data-pf-addrform]");
    if (f) f.querySelector("input").focus();
  }
  root.addEventListener("click", (e) => {
    if (e.target.closest("[data-pf-addr-new]")) { editing = "new"; drawAddresses(); return; }
    if (e.target.closest("[data-pf-addr-cancel]")) { editing = null; drawAddresses(); return; }
    const ed = e.target.closest("[data-pf-addr-edit]");
    if (ed) { editing = ed.dataset.pfAddrEdit; drawAddresses(); return; }
    const df = e.target.closest("[data-pf-addr-def]");
    if (df) { saveAddrs(addrs().map((a) => ({ ...a, def: a.id === df.dataset.pfAddrDef }))); drawAddresses(); return; }
    const del = e.target.closest("[data-pf-addr-del]");
    if (del) {
      if (del.dataset.sure !== "1") { del.dataset.sure = "1"; del.textContent = "Tap again to delete"; setTimeout(() => { del.dataset.sure = ""; del.textContent = "Delete"; }, 4000); return; }
      let l = addrs().filter((a) => a.id !== del.dataset.pfAddrDel);
      if (l.length && !l.some((a) => a.def)) l[0].def = true;
      saveAddrs(l); drawAddresses();
    }
  });
  root.addEventListener("submit", (e) => {
    const f = e.target.closest("[data-pf-addrform]");
    if (!f) return;
    e.preventDefault();
    const v = Object.fromEntries(["name", "line1", "line2", "city", "state", "zip", "phone"].map((k) => [k, f[k].value.trim()]));
    const msg = f.querySelector("[data-pf-addrmsg]");
    if (!v.name || !v.line1 || !v.city || !v.state || !v.zip || !v.phone) { msg.textContent = "Please fill in every field (apt is optional)."; return; }
    if (!/^\d{5}(-\d{4})?$/.test(v.zip)) { msg.textContent = "Add a valid US ZIP code."; return; }
    if (v.phone.replace(/\D/g, "").length < 10) { msg.textContent = "Add a valid phone number."; return; }
    let l = addrs();
    const def = f.def.checked || !l.length;
    if (def) l = l.map((a) => ({ ...a, def: false }));
    if (editing && editing !== "new") l = l.map((a) => (a.id === editing ? { ...a, ...v, def: def || a.def } : a));
    else l.push({ id: Math.random().toString(36).slice(2, 10), ...v, def });
    saveAddrs(l);
    editing = null;
    drawAddresses();
    app && app.toast("Address saved 📍");
  });

  /* ---------- My Sweet Day ---------- */
  function drawDay() {
    if (!app) { $("[data-pf-day]").innerHTML = ""; return; }
    const lvl = app.level();
    const pts = S.points || 0;
    const pct = lvl.next ? Math.round(((pts - lvl.min) / (lvl.next.min - lvl.min)) * 100) : 100;
    const badges = app.BADGES.map((b) => `<li class="${S.badges.includes(b.id) ? "is-on" : ""}" title="${esc(b.name)}: ${esc(b.desc)}"><span>${b.icon}</span><small>${esc(b.name)}</small></li>`).join("");
    $("[data-pf-day]").innerHTML = `
      <div class="pf-level"><div><strong>${esc(lvl.name)}</strong><small>${pts} Bae Points${lvl.next ? ` · ${lvl.next.min - pts} to ${esc(lvl.next.name)}` : " · top level!"}</small></div><span>🔥 ${app.streak()} day streak</span></div>
      <div class="pf-bar"><span style="width:${Math.max(4, pct)}%"></span></div>
      <p class="pf-sub">Badges · ${S.badges.length}/${app.BADGES.length}</p>
      <ul class="pf-badges">${badges}</ul>`;
  }

  /* ---------- Settings ---------- */
  function drawSettings() {
    const p = json("nb_spin_profile", {}) || {};
    const notif = typeof Notification === "undefined" ? "unsupported" : Notification.permission;
    const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
    const rows = [
      ["🎂", "Birthday", p.mm && p.dd ? `${new Date(2000, p.mm - 1, p.dd).toLocaleDateString("en-US", { month: "long", day: "numeric" })} · bonus spin every year` : "Add it in My rewards for a bonus spin", p.mm ? "" : `<button class="pf-link" type="button" data-pf-spin>Add</button>`],
      ["🔔", "Notifications", notif === "granted" ? "On · reminders and your weekly free spin" : notif === "denied" ? "Blocked in your browser settings" : "Off · turn on for reminders and a weekly free spin", `<a class="pf-link" href="my-day.html#notify">${notif === "granted" ? "Manage" : "Turn on"}</a>`],
      ["📱", "NutriBae app", standalone ? "You’re using the app 💗" : "Add NutriBae to your home screen", standalone ? "" : `<a class="pf-link" href="index.html#appdl-title">How</a>`],
      ["🔁", "Subscriptions", "Skip, change card or cancel", `<a class="pf-link" href="/api/portal">Manage</a>`],
      ["💬", "Help", "Shipping, returns and orders", `<a class="pf-link" href="faq.html">FAQ</a>`],
      ["✉️", "Contact us", "Questions about orders or products", `<a class="pf-link" href="mailto:hello@example.com">Email</a>`],
    ];
    $("[data-pf-settings]").innerHTML = rows.map(([i, t, s, a]) => `<li><span class="pf-rows__icon">${i}</span><div><strong>${t}</strong><small>${s}</small></div>${a}</li>`).join("")
      + (window.NB_auth && window.NB_auth.signedIn
        ? `<li><span class="pf-rows__icon">👋</span><div><strong>Sign out</strong><small>Your data stays saved in your account.</small></div><button class="pf-link" type="button" data-pf-signout>Sign out</button></li>
           <li class="pf-rows__danger"><span class="pf-rows__icon">🗑️</span><div><strong>Delete my account</strong><small>Deletes your saved NutriBae account data. Orders already placed are not affected.</small></div><button class="pf-link" type="button" data-pf-delacct>Delete</button></li>`
        : "")
      + `<li class="pf-rows__danger"><span class="pf-rows__icon">🧹</span><div><strong>Clear my data on this device</strong><small>Removes your profile, cart, coupons and app progress from this browser. This can’t be undone.</small></div><button class="pf-link" type="button" data-pf-clear>Clear</button></li>`;
  }

  /* ---------- Actions ---------- */
  root.addEventListener("click", (e) => {
    const cp = e.target.closest("[data-pf-copy]");
    if (cp) {
      const v = cp.dataset.pfCopy;
      const ok = () => { const t = cp.textContent; cp.textContent = "Copied ✓"; setTimeout(() => { cp.textContent = t; }, 1800); };
      navigator.clipboard ? navigator.clipboard.writeText(v).then(ok, ok) : ok();
      return;
    }
    const use = e.target.closest("[data-pf-use]");
    if (use) {
      window.NB_cart && window.NB_cart.applyCode && window.NB_cart.applyCode(use.dataset.pfUse);
      window.NB_openDrawer && window.NB_openDrawer("cart-drawer");
      return;
    }
    if (e.target.closest("[data-pf-spin]")) { window.NB_spin && window.NB_spin.open(); return; }
    if (e.target.closest("[data-pf-signout]")) { window.NB_auth.signOut().then(() => { location.href = "login.html"; }); return; }
    const da = e.target.closest("[data-pf-delacct]");
    if (da) {
      if (da.dataset.sure !== "1") { da.dataset.sure = "1"; da.textContent = "Tap again to delete"; setTimeout(() => { da.dataset.sure = ""; da.textContent = "Delete"; }, 4000); return; }
      window.NB_auth.deleteAccount().then(() => location.reload()).catch((err) => { da.textContent = err.message; });
      return;
    }
    const clr = e.target.closest("[data-pf-clear]");
    if (clr) {
      if (clr.dataset.sure !== "1") { clr.dataset.sure = "1"; clr.textContent = "Tap again to clear"; setTimeout(() => { clr.dataset.sure = ""; clr.textContent = "Clear"; }, 4000); return; }
      try { Object.keys(localStorage).filter((k) => k.startsWith("nb_")).forEach((k) => localStorage.removeItem(k)); } catch { /* ignore */ }
      location.reload();
    }
  });

  /* ---------- Account (sign in / create account on login.html) ---------- */
  const authBox = $("[data-pf-auth]");
  function drawAuth() {
    const A = window.NB_auth;
    if (!authBox || !A) return;
    authBox.hidden = false;
    if (A.signedIn && A.user) {
      const u = A.user;
      const via = (u.providers || []).map((p) => (p === "google" ? "Google" : "Apple")).join(" + ") || (u.hasPassword ? "email" : "");
      authBox.className = "pf-auth is-in";
      authBox.innerHTML = `<div class="pf-auth__in"><span class="pf-auth__check" aria-hidden="true">✓</span><div><strong id="auth-title">Signed in${via ? ` with ${esc(via)}` : ""}</strong><small>${esc(u.email || "")} · your profile is saved to your account and syncs on every device.</small></div></div>`;
      return;
    }
    authBox.className = "pf-auth";
    authBox.innerHTML = `
      <div class="pf-auth__text">
        <p class="pf-eyebrow">Your account</p>
        <h2 id="auth-title">Save your NutriBae profile on every device</h2>
        <p>Create a free account with your email and a password to keep your orders, coupons, favorites, addresses and rewards safe on your phone and your computer.</p>
      </div>
      <div class="pf-auth__btns">
        <a class="btn btn--block" href="login.html?mode=signup">Create my account</a>
        <a class="btn btn--block btn--ghost" href="login.html">I already have an account · Sign in</a>
      </div>`;
  }
  function waitAuth(tries = 0) {
    if (window.NB_auth) { drawAuth(); window.NB_auth.onChange(() => { drawAuth(); drawSettings(); }); drawSettings(); return; }
    if (tries < 40) setTimeout(() => waitAuth(tries + 1), 100);
  }
  waitAuth();

  /* ---------- Load ---------- */
  function drawAll() { drawHello(); drawStats(); drawFavs(); drawCoupons(); drawAddresses(); drawGame(); drawRecipes(); drawDay(); drawSettings(); }
  drawAll();
  drawOrders();
  const tz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return ""; } })();
  const spinTok = get("nb_spin_token"), gameTok = get("nb_bakery_token");
  Promise.all([
    spinTok ? fetch(`/api/spin?status=1&tz=${encodeURIComponent(tz)}`, { headers: { "x-spin-token": spinTok } }).then((r) => (r.ok ? r.json() : null)).catch(() => null) : null,
    gameTok ? fetch(`/api/bakery?a=me&tz=${encodeURIComponent(tz)}`, { headers: { "x-bakery-token": gameTok } }).then((r) => (r.ok ? r.json() : null)).catch(() => null) : null,
  ]).then(([sp, gm]) => { data.spin = sp; data.game = gm && gm.state ? gm.state : null; drawAll(); });
  window.addEventListener("nb:products", () => { drawGame(); drawFavs(); });
  window.addEventListener("nb:app", () => { drawStats(); drawDay(); });
  if (location.hash) setTimeout(() => { const el = document.querySelector(location.hash); el && el.scrollIntoView({ block: "start" }); }, 300);
})();
