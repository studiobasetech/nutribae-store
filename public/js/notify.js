/* ==========================================================================
   App notifications (Web Push) — the card in My Sweet Day.
   Reminders are sent by netlify/functions/push-daily.js at the person's own
   local time; announcements come from notify.html.
   iPhone: works once NutriBae is added to the Home Screen (iOS 16.4+).
   ========================================================================== */
(function () {
  const box = document.querySelector("[data-notify]");
  if (!box) return;
  const app = window.NB_app;
  const S = app.state;
  const PREF_KEY = "nb_notify_prefs";

  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

  let prefs = { daily: true, hour: 9, water: false, refill: true, deals: true };
  try { prefs = { ...prefs, ...(JSON.parse(localStorage.getItem(PREF_KEY)) || {}) }; } catch { /* ignore */ }
  const savePrefs = () => { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch { /* ignore */ } };

  const b64ToBytes = (s) => {
    const raw = atob((s + "=".repeat((4 - (s.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
  };
  const tz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return "America/New_York"; } };

  async function registration() {
    const reg = (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.register("/sw.js"));
    await navigator.serviceWorker.ready;
    return reg;
  }
  async function currentSub() {
    if (!supported) return null;
    try { const reg = await navigator.serviceWorker.getRegistration(); return reg ? await reg.pushManager.getSubscription() : null; } catch { return null; }
  }

  async function sync(sub) {
    const res = await fetch("/api/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: sub.toJSON(), prefs, tz: tz(), refills: S.refillDates || [] }),
    });
    if (!res.ok) throw new Error("save failed");
  }

  async function turnOn() {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") { draw("blocked"); return; }
    const { publicKey } = await fetch("/api/push").then((r) => r.json());
    if (!publicKey) throw new Error("Notifications aren't set up yet.");
    const reg = await registration();
    const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) }));
    await sync(sub);
    app.toast("Notifications are on 🔔");
    draw("on");
  }

  async function turnOff() {
    const sub = await currentSub();
    if (sub) {
      fetch("/api/push", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    }
    app.toast("Notifications are off");
    draw("off");
  }

  const hours = Array.from({ length: 18 }, (_, i) => i + 5)
    .map((h) => `<option value="${h}" ${prefs.hour === h ? "selected" : ""}>${new Date(2000, 0, 1, h).toLocaleTimeString("en-US", { hour: "numeric" })}</option>`).join("");

  function toggles() {
    return `
      <label class="ntf-row"><span><strong>Daily check-in reminder</strong><small>A sweet nudge to log your day</small></span><input type="checkbox" data-pref="daily" ${prefs.daily ? "checked" : ""}></label>
      <label class="ntf-row ntf-row--sub"><span>Remind me at</span><select data-pref-hour>${hours}</select></label>
      <label class="ntf-row"><span><strong>Water reminders</strong><small>11am and 3pm</small></span><input type="checkbox" data-pref="water" ${prefs.water ? "checked" : ""}></label>
      <label class="ntf-row"><span><strong>Refill alerts</strong><small>Before you run out</small></span><input type="checkbox" data-pref="refill" ${prefs.refill ? "checked" : ""}></label>
      <label class="ntf-row"><span><strong>Deals &amp; new flavors</strong><small>First to know, never spammy</small></span><input type="checkbox" data-pref="deals" ${prefs.deals ? "checked" : ""}></label>`;
  }

  function draw(state) {
    let inner = "";
    if (!supported && ios && !standalone) {
      inner = `<p class="card__hint">On iPhone, notifications work in the NutriBae app on your Home Screen: tap <strong>Share</strong> <span aria-hidden="true">⬆️</span> then <strong>Add to Home Screen</strong>, open NutriBae from there and turn them on here.</p>`;
    } else if (!supported) {
      inner = `<p class="card__hint">This browser doesn’t support notifications. Try Chrome, Edge, Firefox or Safari.</p>`;
    } else if (state === "blocked" || Notification.permission === "denied") {
      inner = `<p class="card__hint">Notifications are blocked for NutriBae. Turn them on in your browser or phone settings, then come back here.</p>`;
    } else if (state === "on") {
      inner = `${toggles()}<button class="rd-link" type="button" data-ntf-off>Turn off notifications</button>`;
    } else {
      inner = `<p class="card__hint" style="margin-bottom:12px">Get gentle reminders for your check-in, water and refills, plus first dibs on deals.</p>
        <button class="btn btn--block" type="button" data-ntf-on>Turn on notifications 🔔</button>`;
    }
    box.innerHTML = `<div class="card__head"><h2>Notifications</h2>${state === "on" ? '<span class="pill" style="margin:0">On</span>' : ""}</div>${inner}<p class="form-msg" data-ntf-msg role="status"></p>`;
  }

  box.addEventListener("click", async (e) => {
    const msg = () => box.querySelector("[data-ntf-msg]");
    if (e.target.closest("[data-ntf-on]")) {
      e.target.disabled = true;
      try { await turnOn(); } catch (err) { msg().textContent = "Couldn’t turn on notifications. " + (err.message || ""); e.target.disabled = false; }
    }
    if (e.target.closest("[data-ntf-off]")) turnOff();
  });
  box.addEventListener("change", async (e) => {
    const t = e.target;
    if (t.matches("[data-pref]")) prefs[t.dataset.pref] = t.checked;
    else if (t.matches("[data-pref-hour]")) prefs.hour = Number(t.value);
    else return;
    savePrefs();
    const sub = await currentSub();
    if (sub) sync(sub).then(() => app.toast("Saved")).catch(() => app.toast("Couldn’t save. Try again."));
  });

  // Keep refill dates and time zone fresh on the server (once a day).
  window.addEventListener("nb:app", async () => {
    const today = app.today();
    if (localStorage.getItem("nb_notify_synced") === today) return;
    const sub = await currentSub();
    if (sub && Notification.permission === "granted") {
      try { await sync(sub); localStorage.setItem("nb_notify_synced", today); } catch { /* try later */ }
    }
  });

  currentSub().then((sub) => draw(sub && Notification.permission === "granted" ? "on" : "off"));
})();
