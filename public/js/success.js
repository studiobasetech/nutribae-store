// Order placed: empty the cart and unlock the free cookbook if it was added.
// (Orders themselves are handled by the Stripe webhook, not this page.)
(function () {
  const sessionId = new URLSearchParams(location.search).get("session_id");
  if (!sessionId) return;
  window.NB_cart.clear();

  const box = document.querySelector("[data-cookbook-box]");
  fetch(`/api/cookbook?unlock=${encodeURIComponent(sessionId)}`)
    .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
    .then(({ ok, d }) => {
      if (ok && d.included && d.token) {
        try { localStorage.setItem("nb_cookbook", d.token); } catch { /* private mode */ }
        box.querySelector("[data-cookbook-pdf]").href = `/api/cookbook?t=${encodeURIComponent(d.token)}&get=pdf`;
        box.hidden = false;
      } else if (d && d.error) {
        box.querySelector("[data-cookbook-msg]").textContent = d.error;
        box.querySelector("[data-cookbook-btns]").hidden = true;
        box.hidden = false;
      }
    })
    .catch(() => {});
})();

/* ---------- One-tap add-on (same box, card already saved) ---------- */
(function () {
  const sid = new URLSearchParams(location.search).get("session_id");
  const box = document.querySelector("[data-upsell]");
  if (!sid || !box) return;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
  const thumb = (u) => (u && /cdn\.shopify\.com/.test(u) ? u + (u.includes("?") ? "&" : "?") + "width=320" : u);
  let timer = null;

  fetch(`/api/upsell?session_id=${encodeURIComponent(sid)}`).then((r) => r.json()).then((d) => {
    if (d.added) return showAdded(d.name);
    const o = d.offer;
    if (!o) return;
    const pct = o.compareAt ? Math.round((1 - o.price / o.compareAt) * 100) : 0;
    box.innerHTML = `
      <p class="upsell__kicker">Wait! One-time offer, just for this order</p>
      <div class="upsell__row">
        <div class="upsell__img">${o.image ? `<img src="${esc(thumb(o.image))}" alt="">` : ""}${pct ? `<span>-${pct}%</span>` : ""}</div>
        <div>
          <h2 id="upsell-title">Add ${esc(o.name)} to your box</h2>
          <p class="upsell__pitch">${esc(o.pitch)}</p>
          <p class="upsell__price"><strong>${fmt(o.price)}</strong>${o.compareAt ? ` <s>${fmt(o.compareAt)}</s>` : ""} <span>· ships with your order, free</span></p>
        </div>
      </div>
      <button class="btn btn--block upsell__yes" type="button" data-upsell-yes>Yes, add it for ${fmt(o.price)}</button>
      <button class="link-btn upsell__no" type="button" data-upsell-no>No thanks</button>
      <p class="upsell__fine">One tap charges the card you just used. Offer ends in <strong data-upsell-timer></strong>.</p>
      <p class="upsell__msg" role="status" data-upsell-msg></p>`;
    box.hidden = false;
    const t = box.querySelector("[data-upsell-timer]");
    const tick = () => {
      const ms = o.endsAt - Date.now();
      if (ms <= 0) { clearInterval(timer); box.hidden = true; return; }
      t.textContent = `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;
    };
    tick(); timer = setInterval(tick, 1000);
    box.querySelector("[data-upsell-no]").onclick = () => { clearInterval(timer); box.hidden = true; };
    box.querySelector("[data-upsell-yes]").onclick = async (e) => {
      const b = e.currentTarget; b.disabled = true; b.textContent = "Adding…";
      try {
        const r = await fetch("/api/upsell", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: sid }) });
        const res = await r.json().catch(() => ({}));
        if (!r.ok || !res.added) throw new Error(res.error || "We couldn’t add it. Nothing was charged.");
        clearInterval(timer); showAdded(res.name);
      } catch (err) {
        box.querySelector("[data-upsell-msg]").textContent = err.message;
        b.disabled = false; b.textContent = "Try again";
      }
    };
  }).catch(() => {});

  function showAdded(name) {
    box.innerHTML = `<p class="upsell__done">🎉 <strong>${esc(name)}</strong> was added to your order. It ships in the same box.</p>`;
    box.hidden = false;
  }
})();

/* ---------- Review reminder in 10 days (only if notifications are on) ---------- */
(async function () {
  const sid = new URLSearchParams(location.search).get("session_id");
  if (!sid || !("serviceWorker" in navigator) || typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg && (await reg.pushManager.getSubscription());
    if (!sub) return;
    fetch("/api/cart-reminder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ review: sid, endpoint: sub.endpoint }) }).catch(() => {});
  } catch { /* ignore */ }
})();

/* ---------- Bonus spin earned by this order ---------- */
(function () {
  const sid = new URLSearchParams(location.search).get("session_id");
  const cta = document.querySelector("[data-spin-cta]");
  if (!sid || !cta) return;
  try { localStorage.setItem("nb_spin_seen", "1"); } catch { /* ignore */ } // no first-visit popup here
  fetch("/api/spin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ claimOrder: sid }) })
    .then((r) => r.json())
    .then(async (d) => {
      if (!d.ok || !window.NB_spin) return;
      window.NB_spin.setToken(d.token);
      const st = await window.NB_spin.refresh();
      if (st && st.available === "order") {
        cta.hidden = false;
        cta.querySelector("[data-spin-cta-go]").onclick = () => { window.NB_spin.open(); cta.hidden = true; };
      }
    })
    .catch(() => {});
})();

/* ---------- Remember this order on this device (My profile → My orders) ---------- */
(function () {
  const sid = new URLSearchParams(location.search).get("session_id");
  if (!sid) return;
  try {
    const list = JSON.parse(localStorage.getItem("nb_orders")) || [];
    if (!list.some((o) => o.id === sid)) list.unshift({ id: sid, at: Date.now() });
    localStorage.setItem("nb_orders", JSON.stringify(list.slice(0, 20)));
  } catch { /* private mode */ }
})();
