/* ==========================================================================
   Quiz Lab. "Sweet Plan" builds a full daily routine; the other
   9 (js/quizzes-data.js) match you to products and recipes.
   Results are saved on this device (NB_app.state.quizzes / .plan).
   Deep link: plan.html?quiz=<id>
   ========================================================================== */
(function () {
  const app = window.NB_app;
  const { esc } = app;
  const S = app.state;
  S.quizzes = S.quizzes || {};
  const root = document.querySelector("[data-plan]");
  const R = window.NB_RECIPES || [];
  const QUIZZES = window.NB_QUIZZES || [];

  const H = {
    vanilla: "vanilla-birthday-cake-plant-based-protein-powder",
    chocolate: "chocolate-brownie-delight-plant-based-protein-powder",
    strawberry: "energy-powder-strawberry-shortcake",
    cotton: "energy-powder-cotton-candy",
    hydration: "hydration-powder-peach-mango",
    probiotic: "probiotic-20-billion",
  };

  /* ---------- Sweet Plan (the full routine quiz) ---------- */
  const PLAN_Q = [
    { id: "goal", q: "What would make your days feel sweeter?", help: "Pick up to two.", multi: 2, opts: [
      ["protein", "💪", "More protein, easily", "for strength and staying full"],
      ["energy", "⚡", "Steady energy", "without the sugary crash"],
      ["hydration", "💧", "Drinking more water", "and actually enjoying it"],
      ["gut", "🌿", "A happy tummy routine", "daily probiotic habit"],
      ["cravings", "🍰", "Taming sweet cravings", "dessert flavors, smarter"],
    ] },
    { id: "flavor", q: "Which flavors make you happy?", help: "Pick all you love.", multi: 3, opts: [
      ["vanilla", "🎂", "Vanilla & birthday cake"], ["chocolate", "🍫", "Chocolate & brownie"], ["fruity", "🍓", "Fruity & candy"],
    ] },
    { id: "active", q: "How active is a normal week?", opts: [
      ["rest", "🛋️", "Mostly cozy", "rest days and gentle walks"], ["light", "🚶‍♀️", "Lightly active", "walks, yoga, errands"],
      ["moderate", "🏃‍♀️", "Workouts 2–3x a week"], ["high", "🏋️‍♀️", "Training 4+ days"],
    ] },
    { id: "boost", q: "When do you need a boost most?", opts: [
      ["morning", "🌅", "Mornings"], ["midday", "☀️", "The afternoon slump"], ["workout", "👟", "Around my workouts"], ["evening", "🌙", "Evening sweet tooth"],
    ] },
    { id: "style", q: "How do you like to enjoy it?", opts: [
      ["shakes", "🥤", "Quick shakes & smoothies", "ready in 5 minutes"], ["baking", "🧁", "Baking & treats", "pancakes, cookies, mug cakes"], ["both", "✨", "A bit of both"],
    ] },
    { id: "water", q: "How much water do you drink on a typical day?", opts: [
      ["low", "🥛", "Less than 4 glasses"], ["mid", "🥤", "4 to 7 glasses"], ["high", "💦", "8 glasses or more"],
    ] },
  ];

  function buildPlan(a) {
    const has = (k, v) => (a[k] || []).includes(v);
    const pick = new Map();
    const wantsProtein = has("goal", "protein") || has("goal", "cravings") || has("style", "baking") || has("style", "both") || has("active", "moderate") || has("active", "high");
    if (wantsProtein || !(a.goal || []).length) {
      const choc = has("flavor", "chocolate"), van = has("flavor", "vanilla");
      if (choc && !van) pick.set(H.chocolate, "Your everyday shake and baking base: 21g plant protein, 110 calories.");
      else pick.set(H.vanilla, "Your everyday shake and baking base: 20g plant protein, 110 calories.");
      if (choc && van) pick.set(H.chocolate, "For brownie days. Mix and match with vanilla.");
    }
    if (has("goal", "energy") || has("boost", "midday") || (has("boost", "workout") && has("active", "high"))) {
      pick.set(has("flavor", "fruity") && !has("flavor", "vanilla") ? H.cotton : H.strawberry, "A sugar-free lift with natural caffeine from green tea.");
    }
    if (has("goal", "hydration") || has("water", "low") || has("active", "high")) pick.set(H.hydration, "Makes water taste like peach mango, so you sip more of it.");
    if (has("goal", "gut")) pick.set(H.probiotic, "One capsule a day: 13 probiotic strains.");

    const items = [...pick.entries()].slice(0, 4).map(([id, why]) => ({ id, why }));
    const ids = items.map((i) => i.id);
    const proteinId = ids.find((id) => id === H.vanilla || id === H.chocolate);
    const routine = [];
    if (ids.includes(H.probiotic)) routine.push(["Morning", "Probiotic with a glass of water."]);
    if (proteinId) routine.push(["Breakfast", has("boost", "morning") || has("style", "shakes") ? "Protein shake or smoothie (2 scoops)." : "Protein pancakes or waffles from the recipe book."]);
    if (ids.includes(H.hydration)) routine.push(["Midday", "Hydration in your water bottle (1 scoop, 14–20 oz)."]);
    if (ids.includes(H.strawberry) || ids.includes(H.cotton)) routine.push([has("boost", "workout") ? "Pre-workout" : "Afternoon", "Energy drink (1 scoop, 6–10 oz). Skip it late in the day if caffeine keeps you up."]);
    if (proteinId && (has("boost", "workout") || has("active", "moderate") || has("active", "high"))) routine.push(["After moving", "Protein shake to refuel."]);
    if (proteinId && (has("boost", "evening") || has("goal", "cravings"))) routine.push(["Evening", "A NutriBae treat instead of a sugar rush: mug cake or bliss balls."]);

    const flavorOk = (r) => !proteinId || r.products.includes(proteinId) || r.products.length > 1;
    const shakeTypes = ["Smoothie", "Shake"], bakeTypes = ["Breakfast", "Dessert", "Snack"];
    const types = has("style", "shakes") ? shakeTypes : has("style", "baking") ? bakeTypes : [...shakeTypes, ...bakeTypes];
    let recs = R.filter((r) => types.includes(r.type) && flavorOk(r));
    if (has("style", "both")) recs = [recs.find((r) => shakeTypes.includes(r.type)), ...recs.filter((r) => bakeTypes.includes(r.type)).slice(0, 2)].filter(Boolean);
    const waterGoal = has("water", "low") ? 6 : 8;
    const name = has("goal", "energy") ? "Glow & Go" : has("goal", "hydration") ? "Sip Sip Sweet" : has("goal", "gut") ? "Happy Tummy" : has("goal", "cravings") ? "Dessert Smart" : "Strong & Sweet";
    return { name, items, routine, recipes: recs.slice(0, 3).map((r) => r.id), waterGoal, answers: a, at: Date.now() };
  }

  const ALL = [
    { id: "sweet-plan", emoji: "✨", title: "Sweet Plan", desc: "Your full daily routine: products, timing, water goal and recipes.", color: "#FFC9E4", featured: true, questions: PLAN_Q },
    ...QUIZZES,
  ];

  /* ---------- Helpers ---------- */
  function prodInfo(id) {
    const p = window.NB_findItem && window.NB_findItem(id);
    return {
      name: p ? p.shortName || p.name : id.replace(/-/g, " "),
      img: p && p.image ? p.image : "assets/images/logo.png",
      price: p && p.price != null ? window.NB_formatPrice(window.NB_linePrice(p, "sub")) : "",
    };
  }
  const fine = `<p class="plan__fine">Suggestions are based on your answers about taste and routine, not medical advice. If you’re pregnant, nursing, under 18 or have a health condition, check with your doctor before starting a supplement.</p>`;
  function setUrl(id) { history.replaceState(null, "", id ? `?quiz=${id}` : location.pathname); }

  /* ---------- Hub ---------- */
  function drawHub() {
    setUrl(null);
    const done = (id) => (id === "sweet-plan" ? !!S.plan : !!S.quizzes[id]);
    root.innerHTML = `
      <div class="lab">
        <ul class="lab__grid">
          ${ALL.map((q) => `
            <li class="${q.featured ? "is-featured" : ""}">
              <button type="button" class="qcard" data-start="${q.id}" style="--qc:${q.color}">
                <span class="qcard__emoji" aria-hidden="true">${q.emoji}</span>
                <span class="qcard__body">
                  <span class="qcard__meta">${q.questions.length} questions · ${q.questions.length > 4 ? "1 min" : "30 sec"}${q.featured ? " · most popular" : ""}</span>
                  <strong>${esc(q.title)}</strong>
                  <span class="qcard__desc">${esc(q.desc)}</span>
                </span>
                <span class="qcard__go">${done(q.id) ? "See result ✓" : "Start →"}</span>
              </button>
            </li>`).join("")}
        </ul>
      </div>`;
  }

  /* ---------- Quiz runner ---------- */
  let quiz = null, step = 0, answers = {};

  function start(id, fresh = false) {
    quiz = ALL.find((q) => q.id === id);
    if (!quiz) return drawHub();
    setUrl(id);
    if (!fresh && id === "sweet-plan" && S.plan) return drawPlan(S.plan, false);
    if (!fresh && S.quizzes[id]) return drawResult(S.quizzes[id].outcome, false);
    step = 0; answers = {};
    drawQuestion();
    window.scrollTo({ top: root.offsetTop - 90, behavior: "smooth" });
  }

  function opts(q) {
    // Sweet Plan uses [value, emoji, title, subtitle]; the others [title, emoji, points]
    return quiz.id === "sweet-plan"
      ? q.opts.map(([v, e, t, s]) => ({ v, e, t, s }))
      : q.opts.map(([t, e], i) => ({ v: String(i), e, t }));
  }

  function drawQuestion() {
    const q = quiz.questions[step];
    const key = q.id || String(step);
    const sel = answers[key] || [];
    root.innerHTML = `
      <div class="quiz quiz--tech">
        <div class="quiz__top">
          <button class="rd-link" type="button" data-hub>← All quizzes</button>
          <span class="quiz__name">${quiz.emoji} ${esc(quiz.title)}</span>
        </div>
        <div class="quiz__bar" aria-hidden="true"><span style="width:${(step / quiz.questions.length) * 100}%"></span></div>
        <p class="quiz__step">Question ${step + 1} of ${quiz.questions.length}</p>
        <h2 class="quiz__q" id="quiz-q">${esc(q.q)}</h2>
        <p class="quiz__help">${q.multi ? esc(q.help) : "Pick one."}</p>
        <div class="quiz__opts" role="group" aria-labelledby="quiz-q">
          ${opts(q).map((o) => `<button type="button" class="opt" data-opt="${o.v}" aria-pressed="${sel.includes(o.v)}"><span class="opt__emoji" aria-hidden="true">${o.e}</span><span>${esc(o.t)}${o.s ? `<small>${esc(o.s)}</small>` : ""}</span></button>`).join("")}
        </div>
        <div class="quiz__nav">
          <button class="btn btn--ghost" type="button" data-q-back ${step === 0 ? "disabled" : ""}>Back</button>
          <button class="btn" type="button" data-q-next ${sel.length ? "" : "disabled"}>${step === quiz.questions.length - 1 ? "See my result" : "Next"}</button>
        </div>
      </div>`;
  }

  function finish() {
    root.innerHTML = `<div class="quiz quiz--tech"><div class="matching" role="status"><span class="matching__orb" aria-hidden="true"></span><p>Matching your answers…</p></div></div>`;
    setTimeout(() => {
      if (quiz.id === "sweet-plan") return drawPlan(buildPlan(answers), true);
      const totals = {};
      quiz.questions.forEach((q, i) => {
        const a = (answers[String(i)] || [])[0];
        if (a == null) return;
        Object.entries(q.opts[Number(a)][2]).forEach(([k, v]) => { totals[k] = (totals[k] || 0) + v; });
      });
      const order = Object.keys(quiz.outcomes);
      const outcome = order.reduce((best, k) => ((totals[k] || 0) > (totals[best] || 0) ? k : best), order[0]);
      S.quizzes[quiz.id] = { outcome, at: Date.now() };
      const o = quiz.outcomes[outcome];
      if (o.waterGoal) S.waterGoal = o.waterGoal;
      app.save();
      app.award(`quiz:${quiz.id}`, 10, `Quiz: ${quiz.title}`);
      drawResult(outcome, true);
    }, 1100);
  }

  function resultShell(title, text, inner, color) {
    return `
      <div class="quiz quiz--tech plan">
        <div class="quiz__top"><button class="rd-link" type="button" data-hub>← All quizzes</button><span class="quiz__name">${quiz.emoji} ${esc(quiz.title)}</span></div>
        <div class="result-hero" style="--qc:${color}">
          <span class="result-hero__spark" aria-hidden="true">${quiz.emoji}</span>
          <p class="app-eyebrow">Your result</p>
          <h2>${esc(title)}</h2>
          <p>${esc(text)}</p>
        </div>
        ${inner}
      </div>`;
  }

  function productsCard(ids, whyMap = {}) {
    if (!ids.length) return "";
    return `<section class="card" aria-labelledby="rp-title">
      <div class="card__head"><h3 id="rp-title">Your picks</h3></div>
      <ul class="plan-prods">${ids.map((id) => {
        const i = prodInfo(id);
        return `<li class="plan-prod"><img src="${esc(i.img)}" alt="" width="64" height="64"><div><strong><a href="${id.startsWith("bundle-") ? "shop.html" : `product.html?handle=${id}`}">${esc(i.name)}</a></strong>${whyMap[id] ? `<span>${esc(whyMap[id])}</span>` : ""}${i.price ? `<span>${whyMap[id] ? " · " : ""}${i.price}/mo with Subscribe &amp; save</span>` : ""}</div></li>`;
      }).join("")}</ul>
    </section>`;
  }
  function recipesCard(ids) {
    const recs = ids.map((id) => R.find((r) => r.id === id)).filter(Boolean);
    if (!recs.length) return "";
    return `<section class="card" aria-labelledby="rr-title">
      <div class="card__head"><h3 id="rr-title">Recipes for you</h3><a class="card__hint" href="recipes.html">All recipes</a></div>
      <ul class="mini-recipes">${recs.map((r) => `<li><a href="recipes.html?r=${r.id}"><img src="${r.image}" alt="" loading="lazy">${esc(r.title)}</a></li>`).join("")}</ul>
    </section>`;
  }
  function actions(ids) {
    return `<div class="plan__actions">
      ${ids.length ? `<button class="btn btn--block" type="button" data-add="${ids.join(",")}">Add to cart · Subscribe &amp; save 15%</button>` : ""}
      <button class="btn btn--ghost btn--block" type="button" data-hub>Take another quiz</button>
      <button class="rd-link" type="button" data-retake>Retake this quiz</button>
      ${fine}
    </div>`;
  }

  function drawResult(key, fresh) {
    const o = quiz.outcomes[key];
    if (!o) return start(quiz.id, true);
    root.innerHTML = resultShell(o.title, o.text,
      productsCard(o.products) + recipesCard(o.recipes || []) +
      (o.tip ? `<p class="rd-tip"><strong>Bae tip:</strong> ${esc(o.tip)}</p>` : "") + actions(o.products), quiz.color);
    if (fresh) window.scrollTo({ top: root.offsetTop - 90, behavior: "smooth" });
  }

  function drawPlan(plan, fresh) {
    quiz = ALL[0];
    const why = Object.fromEntries(plan.items.map((i) => [i.id, i.why]));
    const routine = `<section class="card" aria-labelledby="pr-title">
      <div class="card__head"><h3 id="pr-title">Your sweet day</h3><p class="card__hint">Water goal: ${plan.waterGoal} glasses</p></div>
      <ol class="routine">${plan.routine.map(([t, d]) => `<li><time>${esc(t)}</time><span>${esc(d)}</span></li>`).join("")}</ol>
    </section>`;
    root.innerHTML = resultShell(plan.name, "A simple routine built around what you told us. Change it anytime.",
      productsCard(plan.items.map((i) => i.id), why) + routine + recipesCard(plan.recipes) +
      `<a class="btn btn--ghost btn--block" href="my-day.html">Track it in My Sweet Day</a>` + actions(plan.items.map((i) => i.id)), quiz.color);
    if (fresh) {
      S.plan = plan;
      S.waterGoal = plan.waterGoal;
      plan.items.forEach((i) => { if (!S.refill[i.id]) S.refill[i.id] = { servings: 30, opened: null }; });
      app.save();
      app.award("plan", 20, "Made your Sweet Plan");
      window.scrollTo({ top: root.offsetTop - 90, behavior: "smooth" });
    }
  }

  /* ---------- Events ---------- */
  root.addEventListener("click", (e) => {
    const st = e.target.closest("[data-start]");
    if (st) { start(st.dataset.start); return; }
    if (e.target.closest("[data-hub]")) { drawHub(); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    if (e.target.closest("[data-retake]")) { start(quiz.id, true); return; }
    const add = e.target.closest("[data-add]");
    if (add) { app.addToCart(add.dataset.add.split(",").filter((id) => window.NB_findItem && window.NB_findItem(id)), "sub"); return; }
    const o = e.target.closest("[data-opt]");
    if (o) {
      const q = quiz.questions[step];
      const key = q.id || String(step);
      let sel = answers[key] || [];
      const v = o.dataset.opt;
      if (q.multi) {
        sel = sel.includes(v) ? sel.filter((x) => x !== v) : [...sel, v];
        if (sel.length > q.multi) sel = sel.slice(-q.multi);
        answers[key] = sel; drawQuestion();
      } else {
        answers[key] = [v]; drawQuestion();
        setTimeout(() => { if (step < quiz.questions.length - 1) { step++; drawQuestion(); } else finish(); }, 220);
      }
      return;
    }
    if (e.target.closest("[data-q-back]")) { step = Math.max(0, step - 1); drawQuestion(); return; }
    if (e.target.closest("[data-q-next]")) { if (step < quiz.questions.length - 1) { step++; drawQuestion(); } else finish(); }
  });

  window.addEventListener("nb:products", () => {
    if (root.querySelector(".plan") && quiz) {
      if (quiz.id === "sweet-plan" && S.plan) drawPlan(S.plan, false);
      else if (S.quizzes[quiz.id]) drawResult(S.quizzes[quiz.id].outcome, false);
    }
  });

  const want = new URLSearchParams(location.search).get("quiz");
  if (want && ALL.some((q) => q.id === want)) start(want);
  else drawHub();
})();
