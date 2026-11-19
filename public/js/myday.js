/* ==========================================================================
   My Sweet Day — daily tracker (water, scoops, movement), "How do I feel
   today?" wellness log, Bae Points & badges, smart refill estimates and the
   wearables section. Everything is saved on this device for now.
   ========================================================================== */
(function () {
  const app = window.NB_app;
  const { esc } = app;
  const S = app.state;
  const $ = (sel) => document.querySelector(sel);

  const DROP = '<svg viewBox="0 0 24 30" aria-hidden="true"><path d="M12 1C12 1 2 13 2 19.5A10 10 0 0 0 22 19.5C22 13 12 1 12 1z" fill="currentColor"/></svg>';

  const PRODUCT_HANDLES = [
    "vanilla-birthday-cake-plant-based-protein-powder",
    "chocolate-brownie-delight-plant-based-protein-powder",
    "energy-powder-strawberry-shortcake",
    "energy-powder-cotton-candy",
    "hydration-powder-peach-mango",
    "probiotic-20-billion",
  ];
  // Servings per container, used as the starting guess for refill estimates
  // (the shopper can change it). Probiotic: 30 capsules.
  const DEFAULT_SERVINGS = { "probiotic-20-billion": 30 };
  const UNIT = (id) => (id.startsWith("probiotic") ? "capsule" : "scoop");

  function info(id) {
    const p = window.NB_findItem && window.NB_findItem(id);
    return { name: p ? p.shortName || p.name : id.replace(/-/g, " "), img: p && p.image ? p.image : "assets/images/logo.png", p };
  }

  // Products to show: plan + pantry + tracked, or everything if none yet.
  function myProducts() {
    const set = new Set([...(S.plan ? S.plan.items.map((i) => i.id) : []), ...S.pantry, ...Object.keys(S.refill)]);
    const list = [...set].filter((id) => PRODUCT_HANDLES.includes(id) || (window.NB_findItem && window.NB_findItem(id)));
    return list.length ? list : PRODUCT_HANDLES.slice(0, 5);
  }

  const dateLabel = (d) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" }).slice(0, 2);
  function lastDays(n) {
    const out = [];
    const d = new Date();
    for (let i = n - 1; i >= 0; i--) { const x = new Date(d); x.setDate(d.getDate() - i); out.push(app.today(x)); }
    return out;
  }

  /* ---------- Header stats ---------- */
  function drawStats() {
    const lv = app.level();
    $("[data-stat-streak]").textContent = app.streak();
    $("[data-stat-points]").textContent = S.points;
    $("[data-stat-level]").textContent = lv.name;
    const t = new Date();
    const h = t.getHours();
    $("[data-greet]").textContent = `${h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"}, bae`;
    $("[data-today-date]").textContent = t.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  }

  /* ---------- Sweet Score dashboard ----------
     0–100 for today: water 30, NutriBae logged 25, movement 20, check-in 25. */
  const STEP_GOAL = 8000;
  function drawScore() {
    const d = app.day();
    const goal = S.waterGoal || 8;
    const water = Math.min(1, d.water / goal);
    const scoops = Object.values(d.scoops || {}).reduce((a, b) => a + b, 0);
    const a = d.activity || {};
    const move = Math.min(1, Math.max((a.steps || 0) / STEP_GOAL, (a.activeMin || 0) / 30));
    const feel = d.feel && d.feel.savedAt ? 1 : 0;
    const score = Math.round(water * 30 + (scoops ? 25 : 0) + move * 20 + feel * 25);
    const C = 2 * Math.PI * 52;
    const bar = $("[data-score-bar]");
    bar.style.strokeDasharray = `${C}`;
    bar.style.strokeDashoffset = `${C * (1 - score / 100)}`;
    $("[data-score]").textContent = score;
    $("[data-score-wrap]").setAttribute("aria-label", `Sweet Score ${score} out of 100`);
    const set = (k, p, txt) => {
      const r = document.querySelector(`[data-ring="${k}"] .ring`);
      r.style.setProperty("--p", Math.round(p * 100));
      r.classList.toggle("is-done", p >= 1);
      $(`[data-ring-txt="${k}"]`).textContent = txt;
    };
    set("water", water, `${d.water}/${goal} glasses`);
    set("scoop", scoops ? 1 : 0, scoops ? `${scoops} logged` : "not yet");
    set("move", move, a.steps ? `${a.steps.toLocaleString("en-US")} steps` : a.activeMin ? `${a.activeMin} min` : "0 steps");
    set("feel", feel, feel ? "done ✓" : "not yet");
  }

  /* ---------- Today ---------- */
  function drawWeek() {
    const today = app.today();
    $("[data-week]").innerHTML = lastDays(7).map((d) => {
      const x = S.days[d];
      const on = !!x && (x.water > 0 || x.feel || Object.values(x.scoops || {}).some((n) => n > 0) || (x.activity && x.activity.steps));
      return `<div class="week__d ${on ? "is-on" : ""} ${d === today ? "is-today" : ""}"><span class="week__dot">${on ? "✓" : new Date(d + "T12:00:00").getDate()}</span>${dateLabel(d)}</div>`;
    }).join("");
  }

  function drawWater() {
    const d = app.day();
    const goal = S.waterGoal || 8;
    const n = Math.max(goal, d.water);
    $("[data-water-count]").textContent = `${d.water} of ${goal} glasses`;
    $("[data-water]").innerHTML = Array.from({ length: n }, (_, i) =>
      `<button type="button" class="drop ${i < d.water ? "is-full" : ""}" data-water-set="${i + 1}" aria-label="${i + 1} glass${i ? "es" : ""}">${DROP}</button>`).join("") +
      `<button type="button" class="drop" data-water-set="${d.water + 1}" aria-label="Add a glass" title="Add a glass" style="color:#eee">${DROP}</button>`;
  }

  function drawScoops() {
    const d = app.day();
    $("[data-scoops]").innerHTML = myProducts().map((id) => {
      const { name, img } = info(id);
      const n = d.scoops[id] || 0;
      return `<div class="counter-row">
        <span class="counter-row__name"><img src="${esc(img)}" alt="" width="42" height="42">${esc(name)}</span>
        <span class="stepper" role="group" aria-label="${esc(name)} ${UNIT(id)}s today">
          <button type="button" data-scoop="${id}" data-d="-1" aria-label="One less">−</button>
          <output>${n}</output>
          <button type="button" data-scoop="${id}" data-d="1" aria-label="One more">+</button>
        </span>
      </div>`;
    }).join("");
  }

  function drawMove() {
    const a = app.day().activity || {};
    $("[data-steps]").value = a.steps ?? "";
    $("[data-active]").value = a.activeMin ?? "";
    $("[data-move-src]").textContent = a.source ? `From ${a.source}` : "Typed in by you";
  }

  /* ---------- Feel ---------- */
  const FEEL = {
    energy: { label: "Energy", type: "faces", opts: [["1", "😴"], ["2", "🥱"], ["3", "🙂"], ["4", "😊"], ["5", "🤩"]] },
    mood: { label: "Mood", opts: ["Happy", "Calm", "Meh", "Stressed", "Grateful"] },
    sleep: { label: "Sleep last night", opts: ["Great", "Okay", "Rough"] },
    tummy: { label: "Tummy", opts: ["Comfy", "So-so", "Bloated"] },
    cravings: { label: "Sweet cravings", opts: ["None", "A little", "Strong"] },
  };

  function drawFeel() {
    const f = app.day().feel || {};
    $("[data-feel]").innerHTML = Object.entries(FEEL).map(([k, g]) => {
      if (g.type === "faces") {
        return `<div class="feel-group"><span id="fg-${k}">${g.label}</span><div class="faces" role="group" aria-labelledby="fg-${k}">${g.opts.map(([v, e]) => `<button type="button" class="face" data-feel-k="${k}" data-v="${v}" aria-pressed="${f[k] === v}" aria-label="${g.label} ${v} of 5">${e}</button>`).join("")}</div></div>`;
      }
      return `<div class="feel-group"><span id="fg-${k}">${g.label}</span><div class="chips chips--wrap" role="group" aria-labelledby="fg-${k}">${g.opts.map((v) => `<button type="button" class="chip chip--soft" data-feel-k="${k}" data-v="${v}" aria-pressed="${f[k] === v}">${v}</button>`).join("")}</div></div>`;
    }).join("");
    $("[data-feel-note]").value = f.note || "";
    $("[data-feel-saved]").textContent = f.savedAt ? `Saved at ${new Date(f.savedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : "";
    drawFeelHistory();
  }

  function drawFeelHistory() {
    const days = lastDays(14);
    $("[data-energy-bars]").innerHTML = days.map((d) => {
      const e = Number(S.days[d]?.feel?.energy || 0);
      return `<span class="${e ? "" : "is-empty"}" style="height:${e ? e * 20 : 6}%" title="${d}: ${e ? "energy " + e + "/5" : "no check-in"}"></span>`;
    }).join("");
    $("[data-energy-x]").innerHTML = days.map((d) => `<span>${dateLabel(d)[0]}</span>`).join("");
    const logged = days.filter((d) => S.days[d]?.feel);
    const count = (k) => {
      const c = {};
      logged.forEach((d) => { const v = S.days[d].feel[k]; if (v) c[v] = (c[v] || 0) + 1; });
      const top = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
      return top ? `${top[0]} (${top[1]}×)` : "—";
    };
    $("[data-feel-summary]").innerHTML = logged.length
      ? `<li><span>Check-ins</span><b>${logged.length} of 14 days</b></li><li><span>Most common mood</span><b>${esc(count("mood"))}</b></li><li><span>Most common sleep</span><b>${esc(count("sleep"))}</b></li>`
      : `<li><span>Check in a few days to see your patterns here.</span></li>`;
  }

  /* ---------- Points ---------- */
  function drawPoints() {
    const lv = app.level();
    $("[data-lv-name]").textContent = lv.name;
    $("[data-lv-pts]").textContent = `${S.points} Bae Points`;
    const pct = lv.next ? Math.round(((S.points - lv.min) / (lv.next.min - lv.min)) * 100) : 100;
    $("[data-lv-meter]").style.width = `${pct}%`;
    $("[data-lv-next]").textContent = lv.next ? `${lv.next.min - S.points} points to ${lv.next.name}` : "Top level, you sweet legend!";
    $("[data-badges]").innerHTML = app.BADGES.map((b) => {
      const got = S.badges.includes(b.id);
      return `<li class="badge ${got ? "" : "is-locked"}"><span class="badge__icon" aria-hidden="true">${b.icon}</span><strong>${esc(b.name)}</strong><span>${esc(b.desc)}</span><span class="sr-only">${got ? "Earned" : "Not earned yet"}</span></li>`;
    }).join("");
    $("[data-hist]").innerHTML = S.history.length
      ? S.history.slice(0, 40).map((h) => `<li><span>${esc(h.label)} <b style="color:var(--pink-deep)">+${h.pts}</b></span><time>${new Date(h.at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</time></li>`).join("")
      : "<li>Your points will show up here.</li>";
  }

  /* ---------- Refill ---------- */
  function usedSince(id, opened) {
    return Object.entries(S.days).reduce((sum, [d, x]) => (opened && d >= opened ? sum + (x.scoops?.[id] || 0) : sum), 0);
  }
  function avgPerDay(id) {
    const days = lastDays(14);
    const used = days.reduce((s, d) => s + (S.days[d]?.scoops?.[id] || 0), 0);
    const active = days.filter((d) => (S.days[d]?.scoops?.[id] || 0) > 0).length;
    if (!used) return 0;
    // Spread over the days since the first logged use in the window.
    const first = days.findIndex((d) => (S.days[d]?.scoops?.[id] || 0) > 0);
    return used / Math.max(days.length - first, active, 1);
  }

  function drawRefill() {
    const ids = Object.keys(S.refill);
    S.refillDates = [];
    const options = PRODUCT_HANDLES.filter((id) => !ids.includes(id))
      .map((id) => `<option value="${id}">${esc(info(id).name)}</option>`).join("");
    $("[data-refill-add]").innerHTML = `<option value="">Track another product…</option>${options}`;
    $("[data-refill-add]").hidden = !options;
    if (!ids.length) {
      $("[data-refill]").innerHTML = `<p class="card__hint">Add a product you have at home and we’ll estimate when you’ll run out, based on the scoops you log.</p>`;
      return;
    }
    $("[data-refill]").innerHTML = ids.map((id) => {
      const r = S.refill[id];
      const { name, img } = info(id);
      const servings = Number(r.servings) || DEFAULT_SERVINGS[id] || 30;
      const used = usedSince(id, r.opened);
      const left = Math.max(0, servings - used);
      const rate = avgPerDay(id);
      let status = "Log your scoops in Today and we’ll estimate your refill date.";
      let low = false;
      if (!r.opened) status = "Add the day you opened it to start the estimate.";
      else if (left === 0) { status = "Looks like this one’s finished. Time for a refill!"; low = true; }
      else if (rate > 0) {
        const days = Math.floor(left / rate);
        const out = new Date(); out.setDate(out.getDate() + days);
        const order = new Date(); order.setDate(order.getDate() + Math.max(0, days - 7));
        low = days <= 7;
        S.refillDates.push({ name, date: app.today(order) });
        status = `About ${left} ${UNIT(id)}s left, roughly ${days} day${days === 1 ? "" : "s"} (around ${out.toLocaleDateString("en-US", { month: "short", day: "numeric" })}). ${low ? "Reorder now so you don’t run out." : `Reorder by ${order.toLocaleDateString("en-US", { month: "short", day: "numeric" })}.`}`;
      } else status = `About ${left} ${UNIT(id)}s left. Keep logging so we can estimate your refill date.`;
      return `<div class="refill ${low ? "is-low" : ""}">
        <div class="refill__head"><img src="${esc(img)}" alt="" width="52" height="52"><div><strong>${esc(name)}</strong><span class="refill__status ${low ? "is-low" : ""}">${status}</span></div></div>
        <div class="meter" aria-hidden="true"><span style="width:${Math.round((left / servings) * 100)}%"></span></div>
        <div class="field-row">
          <label class="field">Servings in container<input type="number" inputmode="numeric" min="1" max="200" value="${servings}" data-refill-servings="${id}"></label>
          <label class="field">Opened on<input type="date" value="${r.opened || ""}" max="${app.today()}" data-refill-opened="${id}"></label>
        </div>
        <div class="rd-actions">
          <button class="btn" type="button" data-reorder="${id}">Reorder · Subscribe &amp; save 15%</button>
          <button class="rd-link" type="button" data-refill-remove="${id}">Stop tracking</button>
        </div>
      </div>`;
    }).join("");
  }

  /* ---------- Draw all ---------- */
  function drawAll() {
    drawStats(); drawScore(); drawWeek(); drawWater(); drawScoops(); drawMove(); drawFeel(); drawPoints(); drawRefill();
  }

  /* ---------- Tabs ---------- */
  const tabs = document.querySelectorAll("[data-tab]");
  function showTab(id) {
    tabs.forEach((t) => t.setAttribute("aria-pressed", String(t.dataset.tab === id)));
    document.querySelectorAll("[data-panel]").forEach((p) => { p.hidden = p.dataset.panel !== id; });
    try { history.replaceState(null, "", `#${id}`); } catch { /* ignore */ }
  }
  tabs.forEach((t) => t.addEventListener("click", () => showTab(t.dataset.tab)));

  /* ---------- Events ---------- */
  document.addEventListener("click", (e) => {
    const w = e.target.closest("[data-water-set]");
    if (w) {
      const d = app.day();
      const v = Number(w.dataset.waterSet);
      d.water = v === d.water ? v - 1 : v; // tapping the last full drop empties it
      app.save(); drawWater(); drawWeek(); drawStats();
      if (d.water >= (S.waterGoal || 8)) app.award(`water:${app.today()}`, 5, "Hit your water goal");
      else app.checkBadges();
      return;
    }
    const sc = e.target.closest("[data-scoop]");
    if (sc) {
      const d = app.day();
      const id = sc.dataset.scoop;
      d.scoops[id] = Math.max(0, Math.min(10, (d.scoops[id] || 0) + Number(sc.dataset.d)));
      if (d.scoops[id] > 0 && S.refill[id] && !S.refill[id].opened) S.refill[id].opened = app.today();
      app.save(); drawScoops(); drawWeek(); drawStats(); drawRefill();
      if (Number(sc.dataset.d) > 0) app.award(`scoop:${app.today()}`, 5, "Logged your NutriBae");
      return;
    }
    const fk = e.target.closest("[data-feel-k]");
    if (fk) {
      const d = app.day();
      d.feel = d.feel || {};
      d.feel[fk.dataset.feelK] = d.feel[fk.dataset.feelK] === fk.dataset.v ? undefined : fk.dataset.v;
      document.querySelectorAll(`[data-feel-k="${fk.dataset.feelK}"]`).forEach((b) => b.setAttribute("aria-pressed", String(d.feel[fk.dataset.feelK] === b.dataset.v)));
      return;
    }
    if (e.target.closest("[data-feel-save]")) {
      const d = app.day();
      d.feel = { ...(d.feel || {}), note: $("[data-feel-note]").value.trim().slice(0, 500), savedAt: Date.now() };
      app.save(); drawFeel(); drawWeek(); drawStats();
      app.award(`checkin:${app.today()}`, 10, "Daily check-in");
      return;
    }
    const ro = e.target.closest("[data-reorder]");
    if (ro) { app.addToCart([ro.dataset.reorder], "sub"); return; }
    const rr = e.target.closest("[data-refill-remove]");
    if (rr) { delete S.refill[rr.dataset.refillRemove]; app.save(); drawRefill(); return; }
    if (e.target.closest("[data-move-save]")) {
      const steps = Math.max(0, Math.min(100000, parseInt($("[data-steps]").value, 10) || 0));
      const activeMin = Math.max(0, Math.min(1440, parseInt($("[data-active]").value, 10) || 0));
      app.day().activity = { steps, activeMin, source: null };
      app.save(); drawMove(); drawWeek(); drawStats();
      if (steps || activeMin) app.award(`move:${app.today()}`, 5, "Logged your movement");
      else app.toast("Saved");
    }
  });

  document.addEventListener("change", (e) => {
    const s = e.target.closest("[data-refill-servings]");
    if (s) { S.refill[s.dataset.refillServings].servings = Math.max(1, Math.min(200, parseInt(s.value, 10) || 30)); app.save(); drawRefill(); return; }
    const o = e.target.closest("[data-refill-opened]");
    if (o) { S.refill[o.dataset.refillOpened].opened = o.value || null; app.save(); drawRefill(); return; }
    const a = e.target.closest("[data-refill-add]");
    if (a && a.value) {
      S.refill[a.value] = { servings: DEFAULT_SERVINGS[a.value] || 30, opened: app.today() };
      if (!S.pantry.includes(a.value)) S.pantry.push(a.value);
      app.save(); drawRefill(); drawScoops();
    }
  });

  document.querySelector("[data-goal]").addEventListener("change", (e) => {
    S.waterGoal = Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 8));
    app.save(); drawWater();
  });

  window.addEventListener("nb:products", () => { drawScoops(); drawRefill(); });
  window.addEventListener("nb:app", () => { drawStats(); drawPoints(); drawScore(); });

  // "How My Sweet Day works" explainer: shown until dismissed, can be reopened.
  const EX_KEY = "nb_myday_explained";
  const ex = $("[data-explain]"), exOpen = $("[data-explain-open]");
  function showExplain(on) { ex.hidden = !on; exOpen.hidden = on; }
  let seen = false; try { seen = localStorage.getItem(EX_KEY) === "1"; } catch { /* ignore */ }
  showExplain(!seen);
  $("[data-explain-close]").addEventListener("click", () => { showExplain(false); try { localStorage.setItem(EX_KEY, "1"); } catch { /* ignore */ } });
  exOpen.addEventListener("click", () => showExplain(true));

  // Start
  document.querySelector("[data-goal]").value = S.waterGoal || 8;
  drawAll();
  const start = (location.hash || "").slice(1);
  showTab(["today", "feel", "points", "refill", "connect"].includes(start) ? start : "today");
})();
