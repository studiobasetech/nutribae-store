/* ==========================================================================
   Cart — saved in the shopper's browser (localStorage). Free, no server.
   A line is { id, qty, plan } where plan is "once" or "sub" (Subscribe & Save)
   and id is a Shopify product handle or a bundle id (see products.js).
   Any button with data-add-to-cart="<id>" adds it (one-time purchase).
   ========================================================================== */

(function () {
  const KEY = "nb_cart_v2";

  const keyOf = (l) => `${l.id}:${l.plan}`;
  const find = (id) => (window.NB_findItem ? window.NB_findItem(id) : window.NB_findProduct(id));

  function read() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY));
      if (Array.isArray(saved)) return saved;
      // carry over a cart from the previous version
      const old = JSON.parse(localStorage.getItem("nb_cart_v1")) || [];
      return old.map((l) => ({ ...l, plan: "once" }));
    } catch { return []; }
  }
  function write(next) {
    lines = next;
    try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch { /* private mode: cart lasts this visit only */ }
    render();
  }

  let lines = read();

  // Shipping Guarantee choice (off until the shopper ticks it).
  const G_KEY = "nb_guarantee";
  let guarantee = false;
  try { guarantee = localStorage.getItem(G_KEY) === "1"; } catch { /* ignore */ }
  // Free cookbook with any purchase (on unless the shopper unticks it).
  const C_KEY = "nb_cookbook_optin";
  let cookbook = true;
  try { cookbook = localStorage.getItem(C_KEY) !== "0"; } catch { /* ignore */ }

  // Discount code (checked with /api/discount, applied by Stripe at checkout).
  const D_KEY = "nb_discount";
  let discount = null; // { code, percentOff, amountOff, minimum }
  try { discount = JSON.parse(localStorage.getItem(D_KEY)) || null; } catch { /* ignore */ }
  let discountMsg = "";
  function saveDiscount(d) {
    discount = d;
    try { d ? localStorage.setItem(D_KEY, JSON.stringify(d)) : localStorage.removeItem(D_KEY); } catch { /* ignore */ }
  }
  // A code won on the Spin to Win wheel is filled in for the shopper.
  function spinCode() {
    try { const r = JSON.parse(localStorage.getItem("nb_spin_result")); return r && r.code ? r.code : ""; } catch { return ""; }
  }
  async function applyCode(code) {
    code = String(code || "").trim().toUpperCase();
    if (!code) return;
    discountMsg = "Checking…"; render();
    try {
      const res = await fetch(`/api/discount?code=${encodeURIComponent(code)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.valid) { saveDiscount(null); discountMsg = data.error || "That code isn't valid."; }
      else { saveDiscount({ code: data.code, percentOff: data.percentOff, amountOff: data.amountOff, minimum: data.minimum }); discountMsg = ""; }
    } catch { discountMsg = "We couldn't check that code. You can also enter it on the payment page."; }
    render();
  }

  function setGuarantee(on) {
    guarantee = !!on;
    try { localStorage.setItem(G_KEY, guarantee ? "1" : "0"); } catch { /* ignore */ }
    render();
  }

  function add(id, qty = 1, plan = "once") {
    if (!find(id)) return;
    const line = lines.find((l) => l.id === id && l.plan === plan);
    if (line) line.qty = Math.min(10, line.qty + qty); else lines.push({ id, qty, plan });
    write(lines);
  }
  function setQty(key, qty) {
    write(qty <= 0
      ? lines.filter((l) => keyOf(l) !== key)
      : lines.map((l) => (keyOf(l) === key ? { ...l, qty: Math.min(10, qty) } : l)));
  }

  function totals() {
    let count = 0;
    lines.forEach((l) => { if (find(l.id)) count += l.qty; });
    if (window.NB_priceCart) {
      const pc = window.NB_priceCart(lines);
      return { count, subtotal: pc.subtotal, missingPrice: pc.missing, pc };
    }
    let subtotal = 0, missingPrice = false;
    lines.forEach((l) => { const item = find(l.id); if (!item) return; if (item.price == null) missingPrice = true; else subtotal += item.price * l.qty; });
    return { count, subtotal, missingPrice, pc: null };
  }
  const unitOf = (pc, l) => { const r = pc && pc.rows.find((x) => x.line === l); return r ? r : null; };

  // Switch a cart line between one-time and Subscribe & Save.
  function setPlan(key, plan) {
    const line = lines.find((l) => keyOf(l) === key);
    if (!line) return;
    const other = lines.find((l) => l !== line && l.id === line.id && l.plan === plan);
    if (other) { other.qty = Math.min(10, other.qty + line.qty); write(lines.filter((l) => l !== line)); }
    else { line.plan = plan; write(lines); }
  }

  function render() {
    // Drop items that no longer exist, but only once the live list has loaded.
    if (window.NB_productsLoaded) lines = lines.filter((l) => find(l.id));
    const { count, subtotal, missingPrice, pc } = totals();

    document.querySelectorAll("[data-cart-count]").forEach((el) => {
      el.textContent = count;
      el.hidden = count === 0;
    });

    const box = document.querySelector("[data-cart-lines]");
    if (!box) return;

    // "Spend more, save more" progress bar
    let bar = document.querySelector("[data-cart-deal]");
    if (!bar) { bar = document.createElement("div"); bar.className = "cart-deal"; bar.setAttribute("data-cart-deal", ""); box.parentNode.insertBefore(bar, box); }
    const tiers = window.NB_CART_TIERS || [];
    if (!lines.length || !pc || pc.missing || !tiers.length) bar.hidden = true;
    else {
      bar.hidden = false;
      const top = tiers[tiers.length - 1].min;
      const pct = Math.min(100, Math.round((pc.base / top) * 100));
      const msgTxt = pc.next
        ? (pc.tier && pc.saved ? `🎉 <strong>${Math.round(pc.tier.off * 100)}% off</strong> unlocked (−${window.NB_formatPrice(pc.saved)}). ` : "") + `Add <strong>${window.NB_formatPrice(pc.toNext)}</strong> more for <strong>${Math.round(pc.next.off * 100)}% off</strong> 🎁`
        : `🎉 You unlocked <strong>${Math.round(pc.tier.off * 100)}% off</strong>${pc.saved ? `, saving ${window.NB_formatPrice(pc.saved)}` : ""}!`;
      bar.innerHTML = `<p class="cart-deal__msg">${msgTxt}</p>
        <div class="cart-deal__track"><span style="width:${pct}%"></span>${tiers.map((t) => `<i style="left:${Math.round((t.min / top) * 100)}%" class="${pc.base >= t.min ? "is-on" : ""}"><b>${Math.round(t.off * 100)}%</b></i>`).join("")}</div>
        ${pc.tier && !pc.eligible ? `<p class="cart-deal__note">Applies to single products bought one time.</p>` : ""}`;
    }

    if (!lines.length) {
      box.innerHTML = `<p class="cart-empty">Your stash is looking a little empty, bae.</p>
        <p><a class="btn" href="shop.html">Find your flavor</a></p>`;
    } else {
      box.innerHTML = lines.map((l) => {
        const item = find(l.id);
        if (!item) return ""; // still loading from Shopify
        const key = keyOf(l);
        const row = unitOf(pc, l);
        const price = row ? row.unit : item.price;
        const was = row && row.unit < row.base ? row.base : null;
        const subPrice = window.NB_linePrice ? window.NB_linePrice(item, "sub") : null;
        const canSub = !item.isBundle && l.plan === "once" && subPrice != null;
        const media = item.image ? `<img src="${item.image}" alt="">` : `<div class="ph" aria-hidden="true"></div>`;
        const note = l.plan === "sub"
          ? `<p class="cart-line__plan">Subscribe &amp; save 15% · ${window.NB_SUBSCRIBE.label.toLowerCase()}</p>`
          : item.isBundle ? `<p class="cart-line__plan">${item.parts.length} items · save ${Math.round(item.discount * 100)}%</p>` : "";
        return `
          <div class="cart-line">
            ${media}
            <div>
              <p class="cart-line__name">${item.shortName}</p>
              ${note}
              <p class="cart-line__price">${window.NB_formatPrice(price)}${was ? ` <s>${window.NB_formatPrice(was)}</s>` : ""}</p>
              ${canSub ? `<button type="button" class="cart-sub" data-plan="${key}" data-to="sub"><span class="cart-sub__box" aria-hidden="true"></span><span><strong>Subscribe &amp; save 15%</strong> · ${window.NB_formatPrice(subPrice)}/mo, cancel anytime</span></button>`
                : l.plan === "sub" ? `<button type="button" class="link-btn cart-sub__off" data-plan="${key}" data-to="once">Switch to one-time</button>` : ""}
              <div class="qty" role="group" aria-label="Quantity for ${item.shortName}">
                <button type="button" aria-label="Decrease quantity" data-qty="${key}" data-delta="-1">−</button>
                <span>${l.qty}</span>
                <button type="button" aria-label="Increase quantity" data-qty="${key}" data-delta="1">+</button>
              </div>
            </div>
            <button type="button" class="link-btn" data-remove="${key}">Remove</button>
          </div>`;
      }).join("");
    }

    const foot = document.querySelector(".drawer__foot");

    // Free cookbook row (top of the cart footer).
    let cb = document.querySelector("[data-cart-cookbook]");
    if (foot && !cb) {
      cb = document.createElement("label");
      cb.className = "cart-guarantee cart-cookbook";
      cb.setAttribute("data-cart-cookbook", "");
      foot.insertBefore(cb, foot.firstChild);
    }
    if (cb) {
      cb.hidden = !lines.length;
      cb.innerHTML = `
        <input type="checkbox" data-cookbook ${cookbook ? "checked" : ""}>
        <img class="cart-cookbook__img" src="assets/images/wellness-made-sweet.jpg" alt="" width="40" height="46">
        <span class="cart-guarantee__txt"><strong>Add my free cookbook</strong><span>Wellness Made Sweet PDF + all 25 recipes in the app</span></span>
        <span class="cart-guarantee__price cart-cookbook__free">FREE</span>`;
    }

    // Shipping Guarantee toggle, placed above the subtotal.
    let g = document.querySelector("[data-cart-guarantee]");
    if (foot && !g) {
      g = document.createElement("label");
      g.className = "cart-guarantee";
      g.setAttribute("data-cart-guarantee", "");
      foot.insertBefore(g, cb ? cb.nextSibling : foot.firstChild);
    }
    const gPrice = window.NB_guaranteePrice ? window.NB_guaranteePrice(subtotal) : 0;
    const gOn = guarantee && lines.length > 0 && !missingPrice && gPrice > 0;
    if (g) {
      g.hidden = !lines.length || missingPrice;
      g.innerHTML = `
        <input type="checkbox" data-guarantee ${guarantee ? "checked" : ""}>
        <span class="cart-guarantee__icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 2.5l8 3v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10v-6z"/><path d="M8.5 12l2.4 2.4 4.6-4.8" stroke-linecap="round"/></svg></span>
        <span class="cart-guarantee__txt"><strong>Shipping Guarantee</strong><span>Refund if your package is lost or damaged</span></span>
        <span class="cart-guarantee__price">${window.NB_formatPrice(gPrice)}</span>`;
    }

    // Discount code
    let dc = document.querySelector("[data-cart-discount]");
    if (foot && !dc) {
      dc = document.createElement("div");
      dc.className = "cart-discount";
      dc.setAttribute("data-cart-discount", "");
      foot.insertBefore(dc, foot.querySelector(".cart-subtotal"));
    }
    const before = subtotal + (gOn ? gPrice : 0);
    let off = 0;
    if (discount && !missingPrice) {
      if (discount.minimum && subtotal < discount.minimum) off = 0;
      else if (discount.percentOff) off = Math.round(before * discount.percentOff) / 100;
      else if (discount.amountOff) off = Math.min(before, discount.amountOff);
    }
    if (dc) {
      dc.hidden = !lines.length;
      const typed = dc.querySelector("input") ? dc.querySelector("input").value : spinCode();
      dc.innerHTML = discount
        ? `<div class="cart-discount__applied">
             <span><strong>${discount.code}</strong> ${discount.percentOff ? `${discount.percentOff}% off` : discount.amountOff ? `${window.NB_formatPrice(discount.amountOff)} off` : ""}${discount.minimum && subtotal < discount.minimum ? ` · needs a ${window.NB_formatPrice(discount.minimum)} order` : ""}</span>
             <span>${off ? `−${window.NB_formatPrice(off)}` : ""} <button type="button" class="link-btn" data-discount-remove>Remove</button></span>
           </div>`
        : `<form class="cart-discount__form" data-discount-form>
             <label class="sr-only" for="cart-code">Discount code</label>
             <input id="cart-code" name="code" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Discount code" value="${String(typed || "").replace(/"/g, "")}">
             <button type="submit" class="btn btn--ghost">Apply</button>
           </form>
           ${discountMsg ? `<p class="cart-discount__msg" role="status">${discountMsg}</p>` : ""}`;
    }

    const sub = document.querySelector("[data-cart-subtotal]");
    if (sub) sub.textContent = missingPrice ? "—" : window.NB_formatPrice(Math.max(0, before - off));

    const checkout = document.querySelector("[data-checkout]");
    if (checkout) checkout.disabled = !lines.length;
  }

  document.addEventListener("change", (e) => {
    if (e.target.matches("[data-guarantee]")) setGuarantee(e.target.checked);
    if (e.target.matches("[data-cookbook]")) {
      cookbook = e.target.checked;
      try { localStorage.setItem(C_KEY, cookbook ? "1" : "0"); } catch { /* ignore */ }
    }
  });
  document.addEventListener("submit", (e) => {
    const f = e.target.closest("[data-discount-form]");
    if (!f) return;
    e.preventDefault();
    applyCode(f.code.value);
  });
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-discount-remove]")) { saveDiscount(null); discountMsg = ""; render(); }
  });

  document.addEventListener("click", (e) => {
    const addBtn = e.target.closest("[data-add-to-cart]");
    if (addBtn) {
      add(addBtn.dataset.addToCart);
      window.NB_openDrawer && window.NB_openDrawer("cart-drawer");
      return;
    }
    const q = e.target.closest("[data-qty]");
    if (q) {
      const line = lines.find((l) => keyOf(l) === q.dataset.qty);
      if (line) setQty(q.dataset.qty, line.qty + Number(q.dataset.delta));
      return;
    }
    const pl = e.target.closest("[data-plan]");
    if (pl) { setPlan(pl.dataset.plan, pl.dataset.to); return; }
    const r = e.target.closest("[data-remove]");
    if (r) { setQty(r.dataset.remove, 0); return; }

    const checkoutBtn = e.target.closest("[data-checkout]");
    if (checkoutBtn) startCheckout(checkoutBtn);
  });

  // Default address + email saved in My profile, so Stripe can fill them in.
  function prefill() {
    try {
      const list = JSON.parse(localStorage.getItem("nb_addresses")) || [];
      const a = list.find((x) => x.def) || list[0];
      const p = JSON.parse(localStorage.getItem("nb_spin_profile")) || {};
      if (!a || !p.email) return null;
      return { email: p.email, name: a.name, phone: a.phone, line1: a.line1, line2: a.line2 || "", city: a.city, state: a.state, zip: a.zip };
    } catch { return null; }
  }

  // Sends the cart to /api/checkout (netlify/functions/checkout.js),
  // which returns a Stripe Checkout page to redirect to.
  async function startCheckout(btn) {
    const msg = document.querySelector("[data-checkout-msg]");
    if (msg) msg.textContent = "";
    btn.disabled = true;
    btn.textContent = "Opening checkout…";
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines, guarantee, cookbook, code: discount ? discount.code : "", cartId: cartId(), prefill: prefill(),
          ref: (() => { try { return localStorage.getItem("nb_ref") || ""; } catch { return ""; } })(),
          bakeryToken: (() => { try { return localStorage.getItem("nb_bakery_token") || ""; } catch { return ""; } })(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error || "Checkout is unavailable right now. Try again in a minute.");
      window.location.href = data.url;
    } catch (err) {
      if (msg) msg.textContent = err.message;
      btn.disabled = false;
      btn.textContent = "Check out";
    }
  }

  // Keep the cart in sync if it changes in another tab.
  window.addEventListener("storage", (e) => { if (e.key === KEY) { lines = read(); render(); } });

  // Coming back from Stripe with the browser's Back button: re-enable checkout.
  window.addEventListener("pageshow", () => {
    const btn = document.querySelector("[data-checkout]");
    if (btn) { btn.textContent = "Check out"; btn.disabled = !lines.length; }
  });

  function clear() { write([]); }

  /* ---------- Cart reminders ----------
     If the shopper turned on notifications or gave us their email (Spin to
     Win sign-up), the cart is saved on the server so we can remind them in
     1 hour and 24 hours if they don't check out. Nothing is sent otherwise. */
  function cartId() {
    try {
      let id = localStorage.getItem("nb_cart_id");
      if (!id) { id = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => "abcdefghjkmnpqrstuvwxyz23456789"[b % 31]).join(""); localStorage.setItem("nb_cart_id", id); }
      return id;
    } catch { return ""; }
  }
  let syncTimer = null;
  function syncReminder() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(async () => {
      const id = cartId();
      if (!id) return;
      let email = "", endpoint = "";
      try { const p = JSON.parse(localStorage.getItem("nb_spin_profile")); email = (p && p.email) || ""; } catch { /* none */ }
      try {
        if ("serviceWorker" in navigator && Notification.permission === "granted") {
          const reg = await navigator.serviceWorker.getRegistration();
          const sub = reg && (await reg.pushManager.getSubscription());
          endpoint = (sub && sub.endpoint) || "";
        }
      } catch { /* none */ }
      if (!email && !endpoint) return;
      const empty = !lines.length;
      fetch("/api/cart-reminder", {
        method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true,
        body: JSON.stringify(empty ? { id, clear: true } : { id, lines: lines.map(({ id: i, qty, plan }) => ({ id: i, qty, plan })), email, endpoint }),
      }).catch(() => {});
    }, 1500);
  }
  const _write = write;
  write = function (next) { _write(next); syncReminder(); };

  // Link from a reminder: ?cart=<id:qty:plan,...> restores the cart and opens it.
  (function restoreFromLink() {
    const qs = new URLSearchParams(location.search);
    const c = qs.get("cart");
    if (!c) return;
    if (c !== "open") {
      const restored = c.split(",").map((x) => { const [id, q, pl] = x.split(":"); return { id, qty: Math.max(1, Math.min(10, Number(q) || 1)), plan: pl === "sub" ? "sub" : "once" }; }).filter((l) => /^[a-z0-9-]+$/.test(l.id));
      restored.forEach((r) => { if (!lines.some((l) => l.id === r.id && l.plan === r.plan)) lines.push(r); });
      try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch { /* ignore */ }
    }
    qs.delete("cart");
    history.replaceState(null, "", location.pathname + (qs.toString() ? `?${qs}` : "") + location.hash);
    const openIt = () => window.NB_openDrawer && window.NB_openDrawer("cart-drawer");
    window.NB_productsLoaded ? setTimeout(openIt, 300) : window.addEventListener("nb:products", () => setTimeout(openIt, 300), { once: true });
  })();

  // Re-draw once live products arrive from Shopify.
  window.addEventListener("nb:products", render);

  window.NB_cart = { add, setQty, clear, applyCode, get lines() { return lines; } };
  render();
})();
