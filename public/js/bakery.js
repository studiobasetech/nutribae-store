/* ==========================================================================
   NutriBae Bakery page — join, daily check-in, Bake & Catch, "Bake your free
   treat" with friends, sprinkle shop. All rewards are checked by
   netlify/functions/bakery.js; this file only shows them.
   ========================================================================== */
(function () {
  const root = document.querySelector("[data-bakery]");
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const TOKEN = "nb_bakery_token";
  const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const set = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* ignore */ } };
  let tz = "America/New_York";
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { /* default */ }

  // Every product can be won. What it takes depends on the product's cost.
  const TIER = {
    protein: { need: [8, 3], ship: "Ships free on its own" },
    treat: { need: [5, 2], ship: "Ships free on its own" },
    probiotic: { need: [3, 1], ship: "Ships free with your next order" },
  };
  const PRIZES = {
    "vanilla-birthday-cake-plant-based-protein-powder": { name: "Vanilla Birthday Cake Protein", short: "Vanilla Protein", retail: "$54.90", tier: "protein", emoji: "🎂" },
    "chocolate-brownie-delight-plant-based-protein-powder": { name: "Chocolate Brownie Delight Protein", short: "Chocolate Protein", retail: "$54.90", tier: "protein", emoji: "🍫" },
    "energy-powder-strawberry-shortcake": { name: "Strawberry Shortcake Energy", short: "Strawberry Energy", retail: "$34.99", tier: "treat", emoji: "🍓" },
    "energy-powder-cotton-candy": { name: "Cotton Candy Energy", short: "Cotton Candy Energy", retail: "$34.99", tier: "treat", emoji: "🍭" },
    "hydration-powder-peach-mango": { name: "Peach Mango Hydration", short: "Peach Mango Hydration", retail: "$34.99", tier: "treat", emoji: "🥭" },
    "probiotic-20-billion": { name: "Probiotic 20 Billion", short: "Probiotic", retail: "$19.95", tier: "probiotic", emoji: "🌿" },
  };
  Object.entries(PRIZES).forEach(([h, p]) => Object.assign(p, { options: [[h, p.name]], ship: TIER[p.tier].ship }));
  // Use the live Shopify price when it has loaded (the retail above is a fallback).
  const retailOf = (h) => { const it = window.NB_findItem && window.NB_findItem(h); return it && it.price != null && window.NB_formatPrice ? window.NB_formatPrice(it.price) : PRIZES[h].retail; };
  const NEED = Object.fromEntries(Object.entries(PRIZES).map(([h, p]) => [h, TIER[p.tier].need]));
  const TIERS = [["t3", 500, "$3 off orders of $30+"], ["t5", 1000, "$5 off orders of $40+"], ["t15", 2500, "15% off one order"]];

  // Friend link: remember who invited you (also used at checkout).
  const qs = new URLSearchParams(location.search);
  const refParam = (qs.get("ref") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  if (refParam) set("nb_ref", refParam);

  async function api(a, body, method = "POST") {
    const res = await fetch(`/api/bakery?a=${a}&tz=${encodeURIComponent(tz)}`, {
      method,
      headers: { "Content-Type": "application/json", "x-bakery-token": get(TOKEN) || "" },
      body: method === "POST" ? JSON.stringify({ ...(body || {}), tz }) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { const e = new Error(data.error || "Something went wrong."); e.status = res.status; throw e; }
    return data;
  }
  const toast = (m) => (window.NB_app ? window.NB_app.toast(m) : null);
  let state = null;

  /* ---------- Join ---------- */
  function drawJoin(msg) {
    const ref = get("nb_ref");
    root.innerHTML = `
      <section class="bk-card bk-join">
        <div class="bk-awning" aria-hidden="true"></div>
        <span class="bk-join__emoji" aria-hidden="true">🧁</span>
        ${ref ? `<p class="app-eyebrow">You’re invited</p><h2>Your friend saved you a seat at the NutriBae Bakery</h2>
          <p>Open your bakery and get <strong>15% off your first order</strong>, then play to win free treats of your own.</p>`
        : `<p class="app-eyebrow">Play To Win</p><h2>Play, invite friends and win free NutriBae</h2>
          <p>Play a 30-second game every day, earn stars for coupons, and bake free NutriBae treats with your friends.</p>`}
        <form class="bk-form" data-join>
          <label class="sr-only" for="bk-name">First name</label><input id="bk-name" name="firstName" placeholder="First name" autocomplete="given-name" required>
          <label class="sr-only" for="bk-email">Email</label><input id="bk-email" name="email" type="email" placeholder="Email address" autocomplete="email" required>
          <button class="btn btn--block" type="submit">Open my bakery</button>
          <p class="form-msg" role="alert">${msg ? esc(msg) : ""}</p>
          <p class="bk-fine">You’ll get NutriBae emails and can unsubscribe anytime. Free to play, no purchase needed.</p>
        </form>
      </section>`;
  }

  /* ---------- Main ---------- */
  // Progress for the free product: a star meter (friends who joined) and
  // level blocks (friends who ordered), pixel-game style.
  function cakeSVG(ev) {
    const stars = Array.from({ length: ev.needSignups }, (_, i) => `<span class="lv-star ${i < ev.signups ? "is-on" : ""}">★</span>`).join("");
    const levels = Array.from({ length: ev.needOrders }, (_, i) => `<span class="lv-block ${i < ev.orders ? "is-on" : ""}">${i < ev.orders ? "✓" : `LV${i + 1}`}</span>`).join("");
    return `<div class="lv ${ev.done ? "is-done" : ""}" role="img" aria-label="${ev.signups} of ${ev.needSignups} friends joined, ${ev.orders} of ${ev.needOrders} friend orders">
      <div class="lv-prize">${prizeImgs(ev.prize)}${ev.done ? '<span class="lv-burst">UNLOCKED!</span>' : ""}</div>
      <div class="lv-stars">${stars}</div>
      <div class="lv-levels">${levels}</div>
    </div>`;
  }

  function timeLeft(ms) {
    if (ms <= 0) return "0h";
    const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000), m = Math.floor((ms % 3600000) / 60000);
    return d ? `${d}d ${h}h` : `${h}h ${m}m`;
  }

  // Small version of a Shopify photo (their CDN resizes with ?width=).
  const thumb = (u) => (/cdn\.shopify\.com/.test(u) ? u + (u.includes("?") ? "&" : "?") + "width=240" : u);
  // Real product photos (from Shopify) for each free treat.
  function prizeImgs(k) {
    if (!PRIZES[k]) return "";
    const imgs = PRIZES[k].options.map(([h]) => (window.NB_findItem && window.NB_findItem(h)) || null).filter((x) => x && x.image).slice(0, 3);
    if (!imgs.length) return `<span class="bk-prize__emoji" aria-hidden="true">${PRIZES[k].emoji}</span>`;
    return `<span class="bk-prize__imgs bk-prize__imgs--${imgs.length}" aria-hidden="true">${imgs.map((x) => `<img src="${esc(thumb(x.image))}" alt="" width="144" height="144">`).join("")}</span>`;
  }

  function inviteLink() { return `${location.origin}/bakery.html?ref=${state.code}`; }
  const shareText = () => `I’m playing NutriBae Run to win free products 💗 Play with my link and get 15% off your first order (I earn a reward when you join and order): ${inviteLink()}`;

  function eventCard() {
    const ev = state.event;
    const active = ev && PRIZES[ev.prize] && !ev.claimed && !(ev.expired) && !(ev.done && !ev.claimable);
    if (active) {
      const p = PRIZES[ev.prize];
      const ms = ev.endsAt - Date.now();
      const sLeft = Math.max(0, ev.needSignups - ev.signups), oLeft = Math.max(0, ev.needOrders - ev.orders);
      return `
        <section class="bk-card bk-event" aria-labelledby="ev-title">
          <div class="bk-event__head">
            <div class="bk-event__title">${prizeImgs(ev.prize)}<div><p class="app-eyebrow">Playing for</p><h2 id="ev-title">Free ${esc(p.name)}</h2></div></div>
            <span class="bk-timer" data-endsat="${ev.endsAt}">⏳ ${timeLeft(ms)}</span>
          </div>
          ${cakeSVG(ev)}
          <ul class="bk-reqs">
            <li class="${sLeft ? "" : "is-done"}"><span>${sLeft ? "⭐" : "✅"}</span><div><strong>${ev.signups} of ${ev.needSignups} friends joined</strong><small>Each one adds a star</small></div></li>
            <li class="${oLeft ? "" : "is-done"}"><span>${oLeft ? "🛍️" : "✅"}</span><div><strong>${ev.orders} of ${ev.needOrders} friends placed their first order</strong><small>Each one fills a level</small></div></li>
          </ul>
          ${ev.claimable
            ? `<button class="btn btn--block bk-glow" type="button" data-claim>🎉 Claim your free ${esc(p.name)}</button>`
            : `<p class="bk-almost">${sLeft + oLeft === 1 ? "Just 1 more to go! 🎉" : `${sLeft ? `${sLeft} more friend${sLeft > 1 ? "s" : ""} to join` : ""}${sLeft && oLeft ? " and " : ""}${oLeft ? `${oLeft} more first order${oLeft > 1 ? "s" : ""}` : ""} to unlock it.`}</p>
               <div class="bk-share"><button class="btn" type="button" data-share>Invite friends</button><button class="btn btn--ghost" type="button" data-copy>Copy my link</button></div>`}
          <button class="rd-link bk-change" type="button" data-pick>↺ Change product · see all free products</button>
          <p class="bk-fine">${esc(p.ship)}. Only friends new to NutriBae count, and orders count once they’re paid. Changing products keeps your friends and time.</p>
        </section>`;
    }
    const last = ev && ev.claimed && PRIZES[ev.prize] ? `<p class="bk-win">🎉 You won a free ${esc(PRIZES[ev.prize].name)}! Play for another one below.</p>` : ev && ev.expired ? `<p class="bk-fine">Time ran out on your last challenge. Start a new one, your friends still earned you stars.</p>` : "";
    return `
      <section class="bk-card" aria-labelledby="pick-title">
        <p class="app-eyebrow">Win a free product</p>
        <h2 id="pick-title">Pick a product, invite friends, win it free</h2>
        <p class="bk-sub">You have 7 days. Friends who join fill your star meter, friends who place their first order unlock a level.</p>
        ${last}
        <ul class="bk-prizes">
          ${Object.entries(PRIZES).map(([k, p]) => {
            const cd = state.cooldowns[k];
            return `<li><button type="button" class="bk-prize" data-start="${k}" ${cd ? "disabled" : ""}>
              ${prizeImgs(k)}
              <span class="bk-prize__body"><strong>Free ${esc(p.name)}</strong><small>${NEED[k][0]} friends join + ${NEED[k][1]} friend order${NEED[k][1] > 1 ? "s" : ""} · ${retailOf(k)} value</small><small>${esc(p.ship)}</small></span>
              <span class="bk-prize__go">${cd ? `Back ${new Date(cd).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "Play for it →"}</span>
            </button></li>`;
          }).join("")}
        </ul>
      </section>`;
  }

  let stage = null, content = null, playing = false;
  function ensureLayout() {
    if (stage && root.contains(stage)) return;
    root.innerHTML = `<section class="wf" data-wf aria-labelledby="wf-title"></section><section class="bk-stage" data-stage aria-label="NutriBae Run game"></section><div class="bk-content" data-content></div><div class="bk-overlay" data-modal hidden></div>`;
    drawBanner();
    stage = root.querySelector("[data-stage]");
    content = root.querySelector("[data-content]");
    mountGame();
  }

  // Big "Win free products" banner at the top (Temu / Shein style, honest copy).
  function drawBanner() {
    const box = root.querySelector("[data-wf]");
    if (!box) return;
    const ids = ["vanilla-birthday-cake-plant-based-protein-powder", "chocolate-brownie-delight-plant-based-protein-powder", "energy-powder-strawberry-shortcake", "energy-powder-cotton-candy", "hydration-powder-peach-mango", "probiotic-20-billion"];
    const items = ids.map((h) => window.NB_findItem && window.NB_findItem(h)).filter((x) => x && x.image);
    box.innerHTML = `
      <p class="wf-kicker">🎁 100% FREE · NO PURCHASE NEEDED TO PLAY</p>
      <h1 class="wf-title" id="wf-title">WIN FREE<br><span>PRODUCTS</span></h1>
      <p class="wf-sub">Play, invite friends and get NutriBae for <strong>$0</strong>, with free shipping.</p>
      ${items.length ? `<div class="wf-prods">${items.map((x) => `<span class="wf-prod"><img src="${esc(thumb(x.image))}" alt="${esc(x.shortName || x.name)}" width="120" height="120"><b>FREE</b></span>`).join("")}</div>` : ""}
      <ul class="wf-chips">
        <li>⏰ New plays every day</li>
        <li>👯 Invite friends to win faster</li>
        <li>⭐ Stars = coupons</li>
      </ul>`;
  }

  function draw() {
    const s = state;
    ensureLayout();
    updateStage();
    content.innerHTML = `
      <section class="bk-hero">
        <div class="bk-awning" aria-hidden="true"></div>
        <div class="bk-hero__body">
          <div>
            <p class="app-eyebrow">Play To Win</p>
            <h1 class="bk-hero__title">${s.firstName && s.firstName !== "bae" ? `Hi ${esc(s.firstName)}, play` : "Play"}, invite friends &amp; win free NutriBae 💗</h1>
          </div>
          <div class="bk-stats">
            <div><strong>${s.sprinkles}</strong><span>stars ⭐</span></div>
            <div><strong>${s.playsLeft}</strong><span>plays left</span></div>
            <div><strong>${s.friendsTotal}</strong><span>friends</span></div>
          </div>
          <button class="btn ${s.checkedIn ? "btn--ghost" : ""} btn--block" type="button" data-checkin ${s.checkedIn ? "disabled" : ""}>${s.checkedIn ? "✓ Checked in today" : "Daily check-in · +5 ⭐"}</button>
        </div>
      </section>

      ${s.friendCode ? `<section class="bk-card bk-gift"><p>💗 Your friend’s welcome gift: <strong>15% off your first order</strong></p><div class="spin-code"><span class="spin-code__label">15% OFF</span><strong class="spin-code__value">${esc(s.friendCode)}</strong><button type="button" class="spin-code__copy" data-use="${esc(s.friendCode)}" data-pct="15">Use it</button></div></section>` : ""}
      ${s.pendingGift ? `<section class="bk-card bk-gift"><p>🎁 Your free <strong>${esc(s.pendingGift.name)}</strong> is waiting and ships free with your next order.</p><a class="btn" href="shop.html">Shop now</a></section>` : ""}


      ${eventCard()}

      <section class="bk-card" aria-labelledby="shop-title">
        <p class="app-eyebrow">Star shop</p>
        <h2 id="shop-title">Turn stars into coupons</h2>
        <ul class="bk-tiers">
          ${TIERS.map(([k, cost, label]) => `<li>
            <div><strong>${esc(label)}</strong><small>${cost.toLocaleString("en-US")} stars</small>
              <div class="meter"><span style="width:${Math.min(100, (s.sprinkles / cost) * 100)}%"></span></div></div>
            <button class="btn ${s.sprinkles >= cost ? "" : "btn--ghost"}" type="button" data-redeem="${k}" ${s.sprinkles >= cost ? "" : "disabled"}>${s.sprinkles >= cost ? "Get it" : `${(cost - s.sprinkles).toLocaleString("en-US")} to go`}</button>
          </li>`).join("")}
        </ul>
        ${s.coupons.length ? `<p class="bk-fine" style="margin-top:14px">Your coupons (one-time, 60 days):</p><ul class="bk-coupons">${s.coupons.map((c) => `<li><span>${esc(c.label)}</span><strong>${esc(c.code)}</strong><button type="button" class="spin-code__copy" data-use="${esc(c.code)}">Use it</button></li>`).join("")}</ul>` : ""}
      </section>

      <section class="bk-card" aria-labelledby="friends-title">
        <p class="app-eyebrow">Invite friends</p>
        <h2 id="friends-title">Share the game, earn more</h2>
        <ul class="earn">
          <li><span>A friend joins with your link</span><b>+25 ⭐ and +1 play</b></li>
          <li><span>A friend places their first order</span><b>+100 ⭐</b></li>
          <li><span>Your friend gets</span><b>15% off their first order</b></li>
        </ul>
        <div class="bk-link"><input readonly value="${esc(inviteLink())}" aria-label="Your invite link"><button class="btn" type="button" data-copy>Copy</button></div>
        <button class="btn btn--ghost btn--block" type="button" data-share style="margin-top:10px">Share my link</button>
        <p class="bk-fine">${s.friendsTotal} friend${s.friendsTotal === 1 ? "" : "s"} joined · ${s.friendOrdersTotal} placed a first order</p>
      </section>

      <details class="bk-rules"><summary>How Play To Win works</summary>
        <p>Free to play, no purchase necessary. Sprinkles from the game are limited to ${s.dailyCap} a day. Free treats need the friends shown on each treat within 7 days; friends must be new to NutriBae, and their orders count once paid. Each treat can be won once every 30 days. Coupons are one-time use and expire after 60 days. Free treats ship within the USA. We may remove stars or prizes won by fake accounts or self-referrals.</p>
      </details>

      <div class="bk-overlay" data-overlay hidden></div>`;
  }

  /* ---------- Claim ---------- */
  function drawClaim() {
    const ev = state.event, p = PRIZES[ev.prize];
    const own = p.ship.includes("own");
    const ov = root.querySelector("[data-overlay]");
    ov.hidden = false;
    ov.innerHTML = `<div class="bk-modal" role="dialog" aria-modal="true" aria-labelledby="claim-title">
      <button class="icon-btn bk-modal__close" type="button" data-close aria-label="Close">✕</button>
      <p class="app-eyebrow">You did it 🎉</p><h2 id="claim-title">Claim your free ${esc(p.name)}</h2>
      <form class="bk-form" data-claim-form>
        <input type="hidden" name="option" value="${p.options[0][0]}">
        ${own ? `
          <input name="name" placeholder="Full name" autocomplete="name" required>
          ${state.hasEmail ? "" : `<input name="email" type="email" placeholder="Email (for tracking)" autocomplete="email" required>`}
          <input name="line1" placeholder="Address" autocomplete="address-line1" required>
          <input name="line2" placeholder="Apt, suite (optional)" autocomplete="address-line2">
          <div class="bk-row"><input name="city" placeholder="City" autocomplete="address-level2" required><input name="state" placeholder="State (e.g. FL)" maxlength="2" autocomplete="address-level1" required></div>
          <div class="bk-row"><input name="zip" placeholder="ZIP" inputmode="numeric" autocomplete="postal-code" required><input name="phone" placeholder="Phone" type="tel" autocomplete="tel" required></div>
          <p class="bk-fine">Ships free within the USA.</p>` : `<p class="bk-sub">It’s added to your next order for free. Just shop and check out as usual on this device.</p>`}
        <button class="btn btn--block" type="submit">${own ? "Send my free treat" : "Add it to my next order"}</button>
        <p class="form-msg" role="alert" data-claim-msg></p>
      </form></div>`;
    // Fill in the default address saved in My profile.
    try {
      const list = JSON.parse(localStorage.getItem("nb_addresses")) || [];
      const d = list.find((x) => x.def) || list[0];
      const f = ov.querySelector("[data-claim-form]");
      if (d && f && f.line1) ["name", "line1", "line2", "city", "state", "zip", "phone"].forEach((k) => { if (f[k] && d[k]) f[k].value = d[k]; });
    } catch { /* none */ }
  }

  /* ---------- Pop-ups: pick your free product + "almost ready to ship" ---------- */
  const modal = () => root.querySelector("[data-modal]");
  function openModal(html) {
    const m = modal(); if (!m) return;
    m.hidden = false; m.innerHTML = html; document.body.style.overflow = "hidden";
  }
  function closeModal() { const m = modal(); if (m) { m.hidden = true; m.innerHTML = ""; } document.body.style.overflow = ""; }
  const activeEvent = () => { const ev = state && state.event; return ev && PRIZES[ev.prize] && !ev.claimed && !ev.expired ? ev : null; };

  function pickerHTML() {
    const ev = activeEvent();
    return `<div class="bk-modal wf-pick" role="dialog" aria-modal="true" aria-labelledby="pick-modal-title">
      <button class="icon-btn bk-modal__close" type="button" data-mclose aria-label="Close">✕</button>
      <p class="wf-pick__kicker">🎁 100% FREE · FREE SHIPPING</p>
      <h2 id="pick-modal-title">${ev ? "Change your free product" : "Pick your FREE product"}</h2>
      <p class="bk-sub">${ev ? "Your friends and time carry over." : "Choose the one you want, we’ll reserve it for you for 7 days."}</p>
      <ul class="wf-grid">
        ${Object.entries(PRIZES).map(([h, p]) => {
          const it = window.NB_findItem && window.NB_findItem(h);
          const cd = state.cooldowns[h];
          const on = ev && ev.prize === h;
          return `<li><button type="button" class="wf-card ${on ? "is-on" : ""}" data-choose="${h}" ${cd ? "disabled" : ""}>
            <span class="wf-card__img">${it && it.image ? `<img src="${esc(thumb(it.image))}" alt="">` : `<span class="bk-prize__emoji">${p.emoji}</span>`}<b>FREE</b></span>
            <strong>${esc(p.short)}</strong>
            <span class="wf-card__price"><s>${retailOf(h)}</s> <em>$0</em></span>
            <small>${cd ? `Back ${new Date(cd).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : `${NEED[h][0]} friends + ${NEED[h][1]} order${NEED[h][1] > 1 ? "s" : ""}`}</small>
            ${on ? '<span class="wf-card__tag">Your pick</span>' : ""}
          </button></li>`;
        }).join("")}
      </ul>
    </div>`;
  }
  function openPicker() { openModal(pickerHTML()); }

  function almostHTML(fresh) {
    const ev = state.event, p = PRIZES[ev.prize];
    const it = window.NB_findItem && window.NB_findItem(ev.prize);
    const sLeft = Math.max(0, ev.needSignups - ev.signups), oLeft = Math.max(0, ev.needOrders - ev.orders);
    const total = 2 + ev.needSignups + ev.needOrders * 2;
    const doneUnits = 2 + Math.min(ev.signups, ev.needSignups) + Math.min(ev.orders, ev.needOrders) * 2;
    const pct = Math.round((doneUnits / total) * 100);
    const step = (ok, text) => `<li class="${ok ? "is-done" : ""}"><span>${ok ? "✓" : ""}</span><div>${text}</div></li>`;
    if (ev.done) {
      return `<div class="bk-modal wf-almost" role="dialog" aria-modal="true" aria-labelledby="almost-title">
        <button class="icon-btn bk-modal__close" type="button" data-mclose aria-label="Close">✕</button>
        <div class="wf-almost__img">${it && it.image ? `<img src="${esc(thumb(it.image))}" alt="">` : ""}<span>FREE</span></div>
        <h2 id="almost-title">🎉 Your free ${esc(p.short)} is ready!</h2>
        <p class="bk-sub">Claim it now and we’ll ship it to you.</p>
        <button class="btn btn--block bk-glow" type="button" data-mclaim>Claim my free ${esc(p.short)}</button>
      </div>`;
    }
    return `<div class="bk-modal wf-almost" role="dialog" aria-modal="true" aria-labelledby="almost-title">
      <button class="icon-btn bk-modal__close" type="button" data-mclose aria-label="Close">✕</button>
      ${fresh ? '<div class="wf-burst" aria-hidden="true"></div>' : ""}
      <div class="wf-almost__img">${it && it.image ? `<img src="${esc(thumb(it.image))}" alt="">` : ""}<span>FREE</span></div>
      <p class="wf-almost__kicker">${fresh ? "Reserved for you! 🎉" : "Don’t lose your free gift!"}</p>
      <h2 id="almost-title">Your free ${esc(p.short)} is almost ready to ship to you 🚚</h2>
      <div class="wf-meter"><span style="width:${pct}%"></span><b>${pct}%</b></div>
      <ul class="wf-steps">
        ${step(true, "Free product reserved")}
        ${step(true, "Free shipping unlocked (USA)")}
        ${step(!sLeft, sLeft ? `Invite <strong>${sLeft} more friend${sLeft > 1 ? "s" : ""}</strong> to join` : "Friends joined")}
        ${step(!oLeft, oLeft ? `<strong>${oLeft} friend${oLeft > 1 ? "s" : ""}</strong> place${oLeft > 1 ? "" : "s"} a first order` : "Friend orders done")}
      </ul>
      <p class="wf-almost__timer">⏳ Reserved for you for <strong data-endsat="${ev.endsAt}">${timeLeft(ev.endsAt - Date.now())}</strong></p>
      <button class="btn btn--block bk-glow" type="button" data-mshare>Invite friends now 💗</button>
      <button class="rd-link" type="button" data-mplay>Play the game to earn stars ⭐</button>
    </div>`;
  }
  function openAlmost(fresh) { if (state && state.event && PRIZES[state.event.prize]) openModal(almostHTML(fresh)); }

  // On each visit: pick a product first; afterwards a daily "almost there" reminder.
  function autoPopups() {
    if (!state) return;
    const ev = activeEvent();
    if (!ev) { if (!sessionStorage.getItem("nb_wf_picked")) openPicker(); return; }
    const day = new Date().toLocaleDateString("en-CA");
    if (get("nb_wf_popup_day") !== day) { set("nb_wf_popup_day", day); openAlmost(false); }
  }

  /* ---------- Game ---------- */
  let ticket = null;
  // The game is always on screen at the top of the page.
  function mountGame() {
    playing = false;
    window.NB_BakeryGame.start(stage, {
      onStart: async () => {
        if (!activeEvent()) { openPicker(); throw new Error("Pick your free product first 🎁"); }
        const d = await api("play"); ticket = d.ticket; state = d.state; playing = true;
      },
      onEnd: async (score) => {
        playing = false;
        let html;
        try {
          const d = await api("score", { ticket, score });
          state = d.state;
          html = `<p class="sm-title">${score} points! 🎉</p><p class="sm-sub">You earned <strong>${d.earned} stars</strong>${d.capped ? " (that’s today’s max!)" : ""}.</p>`;
        } catch (err) { html = `<p class="sm-title">${score} points</p><p class="sm-sub">${esc(err.message)}</p>`; }
        stage.querySelector(".sm").insertAdjacentHTML("beforeend", `<div class="sm-overlay">${html}
          ${state.playsLeft ? `<button class="btn" type="button" data-again>Play again (${state.playsLeft} left)</button>` : `<p class="bk-game__hint">No plays left today. Invite a friend for an extra play, or come back tomorrow!</p>`}</div>`);
        draw();
      },
    });
    updateStage();
  }
  // Shows plays left on the start screen (and blocks it when there are none).
  function updateStage() {
    if (!stage || !state || playing) return;
    const go = stage.querySelector("[data-sm-go]");
    const hint = stage.querySelector(".sm-hint");
    if (!go || !hint) return;
    if (state.playsLeft > 0) {
      hint.textContent = state.testMode ? "Tap or press Space to jump · TEST MODE: unlimited plays" : `Tap or press Space to jump · ${state.playsLeft} play${state.playsLeft === 1 ? "" : "s"} left today`;
    } else {
      hint.textContent = "No plays left today. Invite a friend for an extra play, or come back tomorrow!";
      go.disabled = true; go.dataset.blocked = "1"; go.textContent = "Come back tomorrow";
    }
  }
  function closeOverlay() {
    const ov = root.querySelector("[data-overlay]");
    if (!ov) return;
    ov.hidden = true; ov.innerHTML = ""; document.body.style.overflow = "";
    draw();
  }

  /* ---------- Events ---------- */
  root.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    if (f.matches("[data-join]")) {
      const btn = f.querySelector("button"); btn.disabled = true;
      try {
        const d = await api("join", { firstName: f.firstName.value, email: f.email.value, ref: get("nb_ref") || "" });
        set(TOKEN, d.token); state = d.state;
        if (state.friendCode) set("nb_discount", JSON.stringify({ code: state.friendCode, percentOff: 15 }));
        draw(); toast("Welcome! Let’s play 💗");
      } catch (err) { drawJoin(err.message); }
    }
    if (f.matches("[data-claim-form]")) {
      const btn = f.querySelector("button[type=submit]"); btn.disabled = true;
      const fd = Object.fromEntries(new FormData(f));
      try {
        const d = await api("claim", { option: fd.option, address: fd });
        state = d.state;
        f.parentElement.innerHTML = `<p class="app-eyebrow">Yay! 🎉</p><h2>${d.ship === "next-order" ? "It’s in your next order" : "Your treat is on its way"}</h2>
          <p class="bk-sub">${d.ship === "next-order" ? `Your free ${esc(d.name)} will be added when you check out on this device.` : `We’re sending your free ${esc(d.name)}. You’ll get a tracking email once it ships.`}</p>
          <button class="btn btn--block" type="button" data-close>Back to the game</button>`;
      } catch (err) { f.querySelector("[data-claim-msg]").textContent = err.message; btn.disabled = false; }
    }
  });

  root.addEventListener("click", async (e) => {
    const t = e.target;
    try {
      if (t.closest("[data-mclose]") || t.matches("[data-modal]")) { try { sessionStorage.setItem("nb_wf_picked", "1"); } catch {} return closeModal(); }
      if (t.closest("[data-pick]")) return openPicker();
      const ch = t.closest("[data-choose]");
      if (ch) {
        ch.disabled = true;
        const switching = !!activeEvent();
        const d = await api(switching ? "switch" : "event", { prize: ch.dataset.choose });
        state = d.state; draw();
        try { sessionStorage.setItem("nb_wf_picked", "1"); } catch {}
        set("nb_wf_popup_day", new Date().toLocaleDateString("en-CA"));
        openAlmost(true);
        return;
      }
      if (t.closest("[data-mshare]")) { closeModal(); const b = root.querySelector("[data-share]"); if (b) b.click(); return; }
      if (t.closest("[data-mplay]")) { closeModal(); stage && stage.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
      if (t.closest("[data-mclaim]")) { closeModal(); return drawClaim(); }
      if (t.closest("[data-close]")) return closeOverlay();
      if (t.closest("[data-again]")) { mountGame(); return; }
      if (t.closest("[data-claim]")) return drawClaim();
      if (t.closest("[data-checkin]")) { const d = await api("checkin"); state = d.state; draw(); toast("+5 stars ⭐"); return; }
      const st = t.closest("[data-start]");
      if (st) { const d = await api("event", { prize: st.dataset.start }); state = d.state; draw(); set("nb_wf_popup_day", new Date().toLocaleDateString("en-CA")); openAlmost(true); return; }
      const rd = t.closest("[data-redeem]");
      if (rd) {
        rd.disabled = true;
        const d = await api("redeem", { tier: rd.dataset.redeem });
        state = d.state; draw(); toast(`Your coupon: ${d.code}`); return;
      }
      if (t.closest("[data-share]")) {
        if (navigator.share) { await navigator.share({ title: "NutriBae Run · Play To Win", text: shareText(), url: inviteLink() }).catch(() => {}); }
        else { await navigator.clipboard.writeText(shareText()).catch(() => {}); toast("Invite copied, paste it to your friends 💗"); }
        return;
      }
      if (t.closest("[data-copy]")) { await navigator.clipboard.writeText(inviteLink()).catch(() => {}); toast("Link copied 💗"); return; }
      const use = t.closest("[data-use]");
      if (use) {
        set("nb_discount", JSON.stringify({ code: use.dataset.use, percentOff: use.dataset.pct ? Number(use.dataset.pct) : null }));
        toast("Saved to your cart 🛒");
      }
    } catch (err) { toast(err.message); if (err.status === 401) { set(TOKEN, null); stage = null; init(); } }
  });

  // Product photos arrive from Shopify after the page loads.
  window.addEventListener("nb:products", () => {
    if (state && content) { drawBanner(); draw(); }
    const m = modal();
    if (m && !m.hidden && m.querySelector(".wf-pick")) m.innerHTML = pickerHTML();
    if (m && !m.hidden && m.querySelector(".wf-almost") && state && state.event) m.innerHTML = almostHTML(false);
  });

  // Keep the countdown fresh
  setInterval(() => {
    root.querySelectorAll(".bk-timer[data-endsat]").forEach((el) => { el.textContent = `⏳ ${timeLeft(Number(el.dataset.endsat) - Date.now())}`; });
    root.querySelectorAll(".wf-almost [data-endsat]").forEach((el) => { el.textContent = timeLeft(Number(el.dataset.endsat) - Date.now()); });
  }, 30000);

  /* ---------- Start ---------- */
  async function init() {
    if (!get(TOKEN)) {
      // No form: open the bakery with what we already know about this shopper.
      let known = {};
      try { known = JSON.parse(get("nb_spin_profile")) || {}; } catch { /* none */ }
      try {
        const d = await api("join", { firstName: known.firstName || "", email: known.email || "", ref: get("nb_ref") || "" });
        set(TOKEN, d.token); state = d.state;
        if (state.friendCode) set("nb_discount", JSON.stringify({ code: state.friendCode, percentOff: 15 }));
        draw(); return setTimeout(autoPopups, 700);
      } catch (err) { root.innerHTML = `<p class="bk-loading">${esc(err.message)}</p>`; return; }
    }
    root.innerHTML = `<p class="bk-loading">Loading the game…</p>`;
    try { state = (await api("me", null, "GET")).state; draw(); setTimeout(autoPopups, 700); }
    catch (err) {
      if (err.status === 401) { set(TOKEN, null); return init(); }
      root.innerHTML = `<p class="bk-loading">${esc(err.message)}</p>`;
    }
  }
  init();
})();
