/* ==========================================================================
   Spin to win — side tab + popup wheel.
   The prize is picked on the server (netlify/functions/spin.js, odds in
   netlify/lib/spin-config.js), which also creates a unique one-time Stripe
   code. Rules: one spin when you sign up, then one spin on your birthday,
   plus bonus spins: one after every order and one a week with notifications on.
   After the first spin the side tab becomes "My rewards" (or "Free spin!").
   SLICES below only draws the wheel; keep the same order as spin-config.js.
   ========================================================================== */

(function () {
  const AUTO_OPEN_AFTER_MS = 4000;     // first visit only; set to null to turn off
  // Safety cap: slices above this % can never win, whatever their weight.
  const MAX_WIN_PERCENT = 15;
  const SLICES = [
    { label: "Almost",   weight: 15, code: null },
    { label: "10% OFF",  weight: 25, code: "SPIN10" }, // TODO: create in Stripe
    { label: "No luck",  weight: 15, code: null },
    { label: "15% OFF",  weight: 10, code: "SPIN15" }, // TODO
    { label: "Sorry...", weight: 15, code: null },
    { label: "30% OFF",  weight: 0,  code: null },     // display only, can never win
    { label: "Almost",   weight: 0,  code: null },
    { label: "10% OFF",  weight: 20, code: "SPIN10" },
    { label: "No luck",  weight: 0,  code: null },
    { label: "15% OFF",  weight: 0,  code: "SPIN15" },
    { label: "Sorry...", weight: 0,  code: null },
    { label: "30% OFF",  weight: 0,  code: null },     // display only, can never win
  ];
  const percentOf = (s) => parseInt(s.label, 10) || 0;
  SLICES.forEach((s) => { if (percentOf(s) > MAX_WIN_PERCENT) { s.weight = 0; s.code = null; } });

  const KEY_SPUN = "nb_spin_result";
  const KEY_DISMISSED = "nb_spin_dismissed";
  const KEY_TOKEN = "nb_spin_token";
  let bonus = null; // { available: "order"|"weekly"|null, orderCredits, pushOn, nextWeekly, lastWin }
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };

  /* ---------- Wheel SVG (12 slices, 30° each, pointer at 30°) ---------- */
  const C = 200, R = 161, STEP = 360 / SLICES.length, POINTER = 30;
  const rad = (d) => (d * Math.PI) / 180;
  const slices = SLICES.map((s, i) => {
    const a0 = rad(i * STEP - STEP / 2), a1 = rad(i * STEP + STEP / 2);
    const fill = i % 2 ? "var(--pink)" : "var(--wheel-blue)";
    return `<path d="M${C} ${C}L${C + R * Math.cos(a0)} ${C + R * Math.sin(a0)}A${R} ${R} 0 0 1 ${C + R * Math.cos(a1)} ${C + R * Math.sin(a1)}Z" fill="${fill}"/>`;
  }).join("");
  const labels = SLICES.map((s, i) =>
    `<text x="${C + 100}" y="${C}" transform="rotate(${i * STEP} ${C} ${C})" text-anchor="middle" dominant-baseline="central"
      font-family="Inter, sans-serif" font-weight="700" font-size="13" fill="${i % 2 ? "#fff" : "#333"}">${s.label}</text>`
  ).join("");
  const p = rad(POINTER), px = -Math.sin(p), py = Math.cos(p);
  const tip = [C + 150 * Math.cos(p), C + 150 * Math.sin(p)];
  const base = [C + 185 * Math.cos(p), C + 185 * Math.sin(p)];
  const knob = [C + 192 * Math.cos(p), C + 192 * Math.sin(p)];

  const wheelSVG = `
    <svg class="spin-modal__wheel" viewBox="0 0 400 400" role="img" aria-label="Prize wheel">
      <circle cx="200" cy="200" r="169" fill="#E6E6E6"/><circle cx="200" cy="200" r="164" fill="#fff"/>
      <g class="wheel-rot" data-wheel>${slices}${labels}</g>
      <circle cx="200" cy="200" r="18" fill="#EDEDED"/><circle cx="200" cy="200" r="14" fill="#fff"/>
      <path d="M${tip[0]} ${tip[1]}L${base[0] + px * 11} ${base[1] + py * 11}L${base[0] - px * 11} ${base[1] - py * 11}Z" fill="#555"/>
      <circle cx="${knob[0]}" cy="${knob[1]}" r="16" fill="#EDEDED"/><circle cx="${knob[0]}" cy="${knob[1]}" r="11" fill="#fff"/>
    </svg>`;

  /* ---------- Markup ---------- */
  const html = `
    <div class="spin-tab" data-spin-tab>
      <button class="spin-tab__open" type="button" data-spin-open>Spin to win</button>
      <button class="spin-tab__close" type="button" aria-label="Hide spin to win" data-spin-hide>
        <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" aria-hidden="true"><path d="M2 2l6 6M8 2L2 8"/></svg>
      </button>
    </div>
    <div class="spin-modal" role="dialog" aria-modal="true" aria-labelledby="spin-title" aria-hidden="true" data-spin-modal>
      ${wheelSVG}
      <button class="icon-btn spin-modal__close" type="button" aria-label="Close" data-spin-close>
        <svg viewBox="0 0 16 16" fill="none" stroke="#555566" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M2 2l12 12M14 2L2 14"/></svg>
      </button>
      <div class="spin-modal__content">
        <img src="assets/images/logo.png" alt="NutriBae" width="228" height="66">
        <h2 class="spin-modal__title" id="spin-title">Spin to win</h2>
        <p class="spin-modal__sub">Enter your email for the chance to win a discount, plus a bonus spin on every birthday 🎂</p>
        <form class="spin-form" data-spin-form novalidate>
          <label class="sr-only" for="spin-name">First name</label>
          <input id="spin-name" name="firstName" type="text" placeholder="First name" autocomplete="given-name" required>
          <label class="sr-only" for="spin-email">Email address</label>
          <input id="spin-email" name="email" type="email" placeholder="Email address" autocomplete="email" required>
          <fieldset>
            <legend>Birthday <span class="dob__perk">🎂 Get a bonus spin on every birthday!</span></legend>
            <div class="dob">
              <label class="sr-only" for="dob-mm">Month</label>
              <input id="dob-mm" name="mm" inputmode="numeric" maxlength="2" placeholder="MM">
              <label class="sr-only" for="dob-dd">Day</label>
              <input id="dob-dd" name="dd" inputmode="numeric" maxlength="2" placeholder="DD">
              <label class="sr-only" for="dob-yyyy">Year</label>
              <input id="dob-yyyy" name="yyyy" inputmode="numeric" maxlength="4" placeholder="YYYY">
            </div>
          </fieldset>
          <button class="btn btn--block" type="submit">Try your luck</button>
        </form>
        <div class="spin-result" role="status" aria-live="polite" data-spin-result></div>
        <button class="spin-modal__decline" type="button" data-spin-close data-spin-decline>No, I don’t feel lucky</button>
        <p class="spin-modal__legal">You are signing up to receive communication via email and can unsubscribe at any time.</p>
      </div>
    </div>`;
  document.body.insertAdjacentHTML("beforeend", html);

  const tab = document.querySelector("[data-spin-tab]");
  const modal = document.querySelector("[data-spin-modal]");
  const form = document.querySelector("[data-spin-form]");
  const result = document.querySelector("[data-spin-result]");
  const wheel = document.querySelector("[data-wheel]");

  // Hiding the tab only lasts for this visit, so the wheel comes back next time.
  const session = { get(k) { try { return sessionStorage.getItem(k); } catch { return null; } }, set(k, v) { try { sessionStorage.setItem(k, v); } catch {} } };
  try { localStorage.removeItem(KEY_DISMISSED); } catch {} // old "hide forever" setting
  if (session.get(KEY_DISMISSED)) tab.hidden = true;

  function openModal() {
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    const prev = store.get(KEY_SPUN);
    if (birthdayToday()) { birthdayMode(); }
    else if (bonus && bonus.available) { bonusMode(); }
    else if (prev) { rewardsMode(); }
    else {
      setMode(null); form.hidden = false;
      // Signed-in account: fill in what we already know.
      const pa = profile() || {};
      if (!form.firstName.value && pa.firstName) form.firstName.value = pa.firstName;
      if (!form.email.value && pa.email) form.email.value = pa.email;
      if (pa.birthday && !form.mm.value) { form.mm.value = String(pa.birthday.mm).padStart(2, "0"); form.dd.value = String(pa.birthday.dd).padStart(2, "0"); form.yyyy.value = pa.birthday.yyyy || ""; }
      modal.querySelector("#spin-title").textContent = "Spin to win";
      modal.querySelector(".spin-modal__sub").textContent = "Enter your email for the chance to win a discount, plus a bonus spin on every birthday 🎂";
    }
    (form.hidden ? modal.querySelector("[data-spin-close]") : form.querySelector("input")).focus();
  }
  function closeModal() {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
  }

  const PROFILE = "nb_spin_profile";
  const profile = () => { try { return JSON.parse(store.get(PROFILE)) || null; } catch { return null; } };
  const todayMD = () => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() }; };
  function birthdayToday() {
    const p = profile();
    if (!p || !p.mm || !p.dd) return false;
    const t = todayMD();
    const leap = (t.y % 4 === 0 && t.y % 100 !== 0) || t.y % 400 === 0;
    const match = (p.mm === t.m && p.dd === t.d) || (p.mm === 2 && p.dd === 29 && !leap && t.m === 2 && t.d === 28);
    return match && store.get("nb_spin_bday") !== String(t.y);
  }
  const monthName = (m) => new Date(2000, m - 1, 1).toLocaleDateString("en-US", { month: "long" });

  function birthdayMode() {
    const p = profile() || {};
    setMode("is-birthday");
    form.hidden = false;
    result.innerHTML = "";
    modal.querySelector("#spin-title").textContent = `Happy birthday${p.firstName ? ", " + p.firstName : ""}! 🎂`;
    modal.querySelector(".spin-modal__sub").textContent = "It’s your day, bae! Here’s your birthday spin, and every slice is a gift today.";
    form.email.value = p.email || "";
    form.querySelector("button").disabled = false;
    form.querySelector("button").textContent = "Spin my birthday wheel";
    wheel.style.transition = "none"; wheel.style.transform = "rotate(0deg)";
  }

  /* ---------- Bonus spins + My rewards ---------- */
  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const tzName = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return "America/New_York"; } };
  async function pushEndpoint() {
    try {
      if (!("serviceWorker" in navigator) || typeof Notification === "undefined" || Notification.permission !== "granted") return "";
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg && (await reg.pushManager.getSubscription());
      return (sub && sub.endpoint) || "";
    } catch { return ""; }
  }
  async function refresh() {
    const token = store.get(KEY_TOKEN);
    if (token) {
      try {
        const ep = await pushEndpoint();
        const r = await fetch(`/api/spin?status=1&tz=${encodeURIComponent(tzName())}&endpoint=${encodeURIComponent(ep)}`, { headers: { "x-spin-token": token } });
        if (r.ok) bonus = await r.json();
        else if (r.status === 401) store.set(KEY_TOKEN, "");
      } catch { /* offline */ }
    }
    updateTab();
    return bonus;
  }
  function updateTab() {
    const btn = tab.querySelector("[data-spin-open]");
    const hot = !!(bonus && bonus.available);
    tab.classList.toggle("is-hot", hot);
    btn.textContent = hot ? "Free spin! 🎁" : store.get(KEY_SPUN) ? "My rewards" : "Spin to win";
    if (hot) tab.hidden = false;
  }
  const niceDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  function setMode(cls) {
    modal.classList.remove("is-result", "is-birthday", "is-bonus", "is-rewards");
    if (cls) modal.classList.add(cls);
  }

  function bonusMode() {
    setMode("is-bonus");
    form.hidden = true;
    const order = bonus.available === "order";
    modal.querySelector("#spin-title").textContent = order ? "Your bonus spin is here! 🎁" : "Your weekly free spin! 🎡";
    modal.querySelector(".spin-modal__sub").textContent = order
      ? "Thanks for your order, bae 💗 This spin always wins a code for your next order."
      : "A free spin every week for app babes. Good luck!";
    result.innerHTML = `<button class="btn btn--block spin-bonus__go" type="button" data-spin-bonus-go>Spin now</button>`;
    wheel.style.transition = "none"; wheel.style.transform = "rotate(0deg)";
  }

  async function rewardsMode() {
    setMode("is-rewards");
    form.hidden = true;
    let local = null;
    try { local = JSON.parse(store.get(KEY_SPUN)); } catch { /* none */ }
    const win = (bonus && bonus.lastWin) || (local && local.code ? local : null);
    if (win && Number.isInteger(win.index ?? win.i)) { wheel.style.transition = "none"; wheel.style.transform = `rotate(${5 * 360 + POINTER - (win.index ?? win.i) * STEP}deg)`; }
    const p = profile() || {};
    modal.querySelector("#spin-title").textContent = "My rewards 🎁";
    modal.querySelector(".spin-modal__sub").textContent = `${p.firstName || (bonus && bonus.firstName) ? `Hi ${esc(p.firstName || bonus.firstName)}! ` : ""}Your codes and your next free spins.`;
    const lines = [];
    lines.push(`<li><span>🛍️</span><div><strong>Bonus spin with every order</strong><small>${bonus && bonus.orderCredits ? `${bonus.orderCredits} waiting for you` : "Always wins a code for your next order"}</small></div></li>`);
    lines.push(bonus && bonus.pushOn
      ? `<li><span>🎡</span><div><strong>Weekly free spin</strong><small>${bonus.nextWeekly ? `Next one: ${niceDate(bonus.nextWeekly)}` : "Ready now!"}</small></div></li>`
      : `<li><span>🔔</span><div><strong>Weekly free spin</strong><small><a href="my-day.html#notify">Turn on notifications</a> to get one every Monday</small></div></li>`);
    const bd = (bonus && bonus.birthday) || (p.mm && p.dd ? { mm: p.mm, dd: p.dd } : null);
    lines.push(bd
      ? `<li><span>🎂</span><div><strong>Bonus spin on every birthday</strong><small>Yours is ${monthName(bd.mm)} ${bd.dd}. Every slice wins that day!</small></div></li>`
      : `<li class="spin-ways__bday"><span>🎂</span><div><strong>Bonus spin on every birthday</strong><small>Add your birthday and every slice wins on your day.</small>
          ${store.get(KEY_TOKEN) ? `<form class="spin-bday" data-spin-bday><input name="mm" inputmode="numeric" maxlength="2" placeholder="MM" aria-label="Birth month"><input name="dd" inputmode="numeric" maxlength="2" placeholder="DD" aria-label="Birth day"><button type="submit">Save</button></form><small data-spin-bday-msg></small>` : ""}</div></li>`);
    lines.push(`<li><span>⭐</span><div><strong>Stars in Play To Win</strong><small data-spin-stars><a href="bakery.html">Play and win free products</a></small></div></li>`);
    result.innerHTML = `
      <section class="mycoupons" aria-labelledby="mycoupons-title">
        <h3 id="mycoupons-title">My coupons</h3>
        <ul class="mycoupons__list" data-mycoupons>${couponRows(win)}</ul>
      </section>
      <h3 class="mycoupons__h">More ways to win</h3>
      <ul class="spin-ways">${lines.join("")}</ul>
      <a class="btn btn--block spin-result__shop" href="shop.html" data-spin-shop>Shop now</a>`;
    // Stars from the game, if they play on this device.
    try {
      const bt = localStorage.getItem("nb_bakery_token");
      if (bt) {
        const r = await fetch("/api/bakery?a=me", { headers: { "x-bakery-token": bt } });
        const d = r.ok ? await r.json() : null;
        const el = result.querySelector("[data-spin-stars]");
        if (d && d.state && el) el.innerHTML = `You have <b>${d.state.sprinkles.toLocaleString("en-US")} ⭐</b> · <a href="bakery.html">turn them into coupons</a>`;
        if (d && d.state) {
          const extra = (d.state.coupons || []).map((c) => ({ code: c.code, label: c.label, kind: "stars", at: c.at, expiresAt: c.at ? c.at + 60 * 86400000 : null }));
          if (d.state.friendCode) extra.push({ code: d.state.friendCode, label: "15% off your first order", kind: "friend", note: "First order only" });
          const ul = result.querySelector("[data-mycoupons]");
          if (ul && extra.length) ul.innerHTML = couponRows(win, extra);
        }
      }
    } catch { /* ignore */ }
  }

  document.addEventListener("submit", async (e) => {
    const f = e.target.closest("[data-spin-bday]");
    if (!f) return;
    e.preventDefault();
    const msgEl = result.querySelector("[data-spin-bday-msg]");
    try {
      const r = await fetch("/api/spin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ setBirthday: true, token: store.get(KEY_TOKEN), birthday: { mm: f.mm.value, dd: f.dd.value } }) });
      const d = await r.json().catch(() => ({}));
      if (d.birthday) {
        store.set(PROFILE, JSON.stringify({ ...(profile() || {}), mm: d.birthday.mm, dd: d.birthday.dd }));
        if (bonus) bonus.birthday = d.birthday;
        return rewardsMode();
      }
      if (msgEl) msgEl.textContent = d.error || "We couldn’t save it. Try again.";
    } catch { if (msgEl) msgEl.textContent = "We couldn’t save it. Try again."; }
  });

  /* ---------- My coupons: wheel codes + Play To Win codes ---------- */
  const SOURCE = { first: "Spin to win", birthday: "Birthday spin", order: "Order bonus spin", weekly: "Weekly spin", stars: "Play To Win stars", friend: "Friend welcome gift" };
  const short = (t) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  function couponList(win, extra = []) {
    let list = (bonus && bonus.coupons) || [];
    if (!list.length && win) list = [{ code: win.code, label: win.label, kind: win.kind, at: win.at || null, expiresAt: win.at ? win.at + 30 * 86400000 : null }];
    const seen = new Set();
    return [...list, ...extra].filter((c) => c && c.code && (seen.has(c.code) ? false : seen.add(c.code)));
  }
  function couponRows(win, extra) {
    const list = couponList(win, extra);
    if (!list.length) return `<li class="mycoupons__empty">No coupons yet. Spin, play or order to win your first one 💗</li>`;
    const now = Date.now();
    const active = list.filter((c) => !c.expiresAt || c.expiresAt > now);
    const expired = list.filter((c) => c.expiresAt && c.expiresAt <= now);
    const row = (c, off) => `
      <li class="mycoupon ${off ? "is-expired" : ""}">
        <div class="mycoupon__deal"><strong>${esc(c.label || "Discount")}</strong><small>${esc(SOURCE[c.kind] || "Reward")}</small></div>
        <div class="mycoupon__code"><code>${esc(c.code)}</code><small>${off ? "Expired" : c.expiresAt ? `Valid until ${short(c.expiresAt)}` : c.note ? esc(c.note) : "One-time use"}</small></div>
        ${off ? "" : `<div class="mycoupon__btns"><button type="button" class="spin-code__copy" data-spin-copy="${esc(c.code)}">Copy</button><button type="button" class="mycoupon__use" data-coupon-use="${esc(c.code)}">Use</button></div>`}
      </li>`;
    return active.map((c) => row(c, false)).join("") + expired.slice(0, 3).map((c) => row(c, true)).join("");
  }
  // Use a code: put it in the cart and open the cart.
  document.addEventListener("click", (e) => {
    const u = e.target.closest("[data-coupon-use]");
    if (!u) return;
    const code = u.dataset.couponUse;
    closeModal();
    if (window.NB_cart && window.NB_cart.applyCode) window.NB_cart.applyCode(code);
    if (window.NB_openDrawer) window.NB_openDrawer("cart-drawer");
  });

  async function spinBonus(btn) {
    btn.disabled = true; btn.textContent = "Spinning…";
    let data, res;
    try {
      res = await fetch("/api/spin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "bonus", token: store.get(KEY_TOKEN), tz: tzName(), endpoint: await pushEndpoint() }) });
      data = await res.json().catch(() => ({}));
    } catch { res = { ok: false }; data = { error: "We couldn’t reach the wheel. Try again in a minute." }; }
    if (!res.ok) {
      result.innerHTML = `<p class="spin-result__msg">${esc(data.error || "Something went wrong.")}</p>`;
      if (data.state) { bonus = data.state; updateTab(); }
      return;
    }
    if (data.token) store.set(KEY_TOKEN, data.token);
    bonus = data.state || null;
    const r = { label: data.label, code: data.code, i: data.index, kind: data.kind, expiresDays: data.code && !/^SPIN/.test(data.code) ? 30 : null };
    rotateTo(r.i, true);
    const done = () => { if (r.code) store.set(KEY_SPUN, JSON.stringify(r)); showResult(r); updateTab(); };
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ? done() : wheel.addEventListener("transitionend", done, { once: true });
  }

  function rotateTo(idx, animate) {
    if (!animate) wheel.style.transition = "none";
    else { wheel.style.transition = ""; wheel.style.transform = "rotate(0deg)"; void wheel.getBoundingClientRect(); }
    wheel.style.transform = `rotate(${5 * 360 + POINTER - idx * STEP}deg)`;
  }

  function showResult(slice) {
    form.hidden = true;
    setMode("is-result");
    const won = !!slice.code;
    const bonusKind = slice.kind === "order" || slice.kind === "weekly";
    const p = profile();
    const bdayLine = slice.kind === "birthday"
      ? ""
      : p && p.mm ? `<p class="spin-result__next">🎂 Come back on ${monthName(p.mm)} ${p.dd} for your birthday spin!</p>` : "";
    modal.querySelector("#spin-title").textContent = won ? (slice.kind === "birthday" ? "Happy birthday! 🎉" : "Congratulations 🎉") : "So close! 💗";
    result.innerHTML = `
      <p class="spin-result__text">${bonusKind
        ? (won ? "Here’s your code for your next order, bae 💗" : "Not this time, bae! Your next weekly spin is on Monday 💗")
        : won
        ? "Thanks for subscribing babe.💗<br>Copy your discount code and apply to your next order."
        : "Thanks for subscribing babe.💗<br>You’ll still get our exclusive deals and new flavor drops by email."}</p>
      ${won ? `
        <div class="spin-code">
          <span class="spin-code__label">${slice.label}</span>
          <strong class="spin-code__value">${slice.code}</strong>
          <button type="button" class="spin-code__copy" data-spin-copy="${slice.code}">Copy</button>
        </div>` : ""}
      <a class="btn btn--block spin-result__shop" href="shop.html" data-spin-shop>Shop now</a>
      ${won && slice.expiresDays ? `<p class="spin-result__fine">One-time code, valid for ${slice.expiresDays} days.</p>` : ""}
      ${bdayLine}`;
  }

  function pickSlice() {
    const total = SLICES.reduce((s, x) => s + x.weight, 0);
    let r = Math.random() * total;
    for (let i = 0; i < SLICES.length; i++) { r -= SLICES[i].weight; if (r < 0) return i; }
    return 0;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const isBday = modal.classList.contains("is-birthday");
    const name = form.firstName.value.trim();
    const email = form.email.value.trim();
    const msg = (t) => { result.innerHTML = `<p class="spin-result__msg">${t}</p>`; };
    if ((!isBday && !name) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg("Add your first name and a valid email to spin."); return; }
    const btn = form.querySelector("button");
    btn.disabled = true;
    let tz = "America/New_York";
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch {}
    let data, res;
    try {
      res = await fetch("/api/spin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: name, email, birthday: { mm: form.mm.value, dd: form.dd.value, yyyy: form.yyyy.value }, tz }),
      });
      data = await res.json().catch(() => ({}));
    } catch { data = { error: "We couldn’t reach the wheel. Try again in a minute." }; res = { ok: false, status: 0 }; }

    if (!res.ok) {
      btn.disabled = false;
      if (res.status === 409 && data.result) {
        // Already spun with this email: show their prize again.
        if (data.birthday) store.set(PROFILE, JSON.stringify({ ...(profile() || {}), email, mm: data.birthday.mm, dd: data.birthday.dd }));
        const r = { label: data.result.label, code: data.result.code, i: data.result.index, kind: data.result.kind };
        store.set(KEY_SPUN, JSON.stringify(r));
        rotateTo(r.i, false); showResult(r);
        result.insertAdjacentHTML("afterbegin", `<p class="spin-result__msg">${data.error}</p>`);
        return;
      }
      msg(data.error || "Something went wrong. Try again.");
      return;
    }

    const prev = profile() || {};
    store.set(PROFILE, JSON.stringify({
      email, firstName: name || prev.firstName || "",
      mm: data.birthday ? data.birthday.mm : prev.mm || null, dd: data.birthday ? data.birthday.dd : prev.dd || null,
    }));
    if (data.kind === "birthday") store.set("nb_spin_bday", String(todayMD().y));
    if (data.token) store.set(KEY_TOKEN, data.token);
    const r = { label: data.label, code: data.code, i: data.index, kind: data.kind, expiresDays: data.code && !/^SPIN/.test(data.code) ? 30 : null };
    rotateTo(r.i, true);
    const done = () => { store.set(KEY_SPUN, JSON.stringify(r)); showResult(r); refresh(); };
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    reduce ? done() : wheel.addEventListener("transitionend", done, { once: true });
  });

  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-spin-open]")) openModal();
    const go = e.target.closest("[data-spin-bonus-go]");
    if (go) spinBonus(go);
    const cp = e.target.closest("[data-spin-copy]");
    if (cp) {
      const code = cp.dataset.spinCopy;
      const ok = () => { cp.textContent = "Copied ✓"; setTimeout(() => { cp.textContent = "Copy"; }, 2000); };
      if (navigator.clipboard) navigator.clipboard.writeText(code).then(ok, ok); else ok();
    }
    if (e.target.closest("[data-spin-shop]") && location.pathname.endsWith("shop.html")) { e.preventDefault(); closeModal(); }
    if (e.target.closest("[data-spin-close]")) closeModal();
    if (e.target.closest("[data-spin-hide]")) { tab.hidden = true; session.set(KEY_DISMISSED, "1"); }
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

  window.NB_spin = { open: openModal, refresh, setToken: (t) => { if (t) store.set(KEY_TOKEN, t); } };
  updateTab();
  refresh();

  // Birthday: the tab comes back and the wheel opens by itself.
  if (birthdayToday()) {
    tab.hidden = false;
    setTimeout(openModal, 2500);
  } else if (AUTO_OPEN_AFTER_MS !== null && !store.get(KEY_SPUN) && !store.get("nb_spin_seen")) {
    setTimeout(() => { store.set("nb_spin_seen", "1"); openModal(); }, AUTO_OPEN_AFTER_MS);
  }
})();
