/* ==========================================================================
   Sweet Swap — pick a craving, get a NutriBae recipe with a side-by-side
   comparison. "Usual" numbers are rough averages for a common serving
   (they vary by brand); NutriBae numbers come from the cookbook.
   ========================================================================== */
(function () {
  const app = window.NB_app;
  const { esc } = app;
  const S = app.state;
  const R = window.NB_RECIPES || [];

  // usual: { name, kcal, protein, carbs } rough per-serving averages
  const CRAVINGS = [
    { id: "cookies", emoji: "🍪", label: "Cookies", recipe: "chocolate-chip-cookies", usual: { name: "2 bakery chocolate chip cookies", kcal: 280, protein: 3, carbs: 38 } },
    { id: "brownie", emoji: "🟫", label: "Brownie", recipe: "chocolate-brownie", usual: { name: "1 bakery brownie", kcal: 230, protein: 3, carbs: 36 } },
    { id: "cinnamon-roll", emoji: "🌀", label: "Cinnamon roll", recipe: "cinnamon-rolls", usual: { name: "1 bakery cinnamon roll with icing", kcal: 450, protein: 7, carbs: 64 } },
    { id: "pancakes", emoji: "🥞", label: "Pancakes", recipe: "birthday-cake-pancakes", usual: { name: "3 diner pancakes with syrup", kcal: 520, protein: 11, carbs: 90 } },
    { id: "frappe", emoji: "☕", label: "Mocha frappé", recipe: "mocha-energy-boost", usual: { name: "Coffee-shop mocha frappé (16 oz)", kcal: 370, protein: 5, carbs: 55 } },
    { id: "latte", emoji: "🥛", label: "Vanilla latte", recipe: "vanilla-latte", usual: { name: "Vanilla latte with syrup (16 oz)", kcal: 250, protein: 12, carbs: 35 } },
    { id: "milkshake", emoji: "🥤", label: "Milkshake", recipe: "brownie-batter", usual: { name: "Chocolate milkshake (16 oz)", kcal: 530, protein: 12, carbs: 85 } },
    { id: "candy-bar", emoji: "🍫", label: "Candy bar", recipe: "chocolate-peanut-candy-bar", usual: { name: "Chocolate peanut candy bar", kcal: 250, protein: 4, carbs: 33 } },
    { id: "cheesecake", emoji: "🍰", label: "Cheesecake", recipe: "strawberry-cheesecake-bites", usual: { name: "1 slice of cheesecake", kcal: 400, protein: 7, carbs: 32 } },
    { id: "pb-cups", emoji: "🥜", label: "PB cups", recipe: "peanut-butter-cup", usual: { name: "2 peanut butter cups", kcal: 210, protein: 5, carbs: 24 } },
    { id: "muffin", emoji: "🧁", label: "Muffin", recipe: "chocolate-banana-muffins", usual: { name: "1 bakery muffin", kcal: 450, protein: 6, carbs: 60 } },
    { id: "chocolate-cake", emoji: "🎂", label: "Chocolate cake", recipe: "chocolate-mug-cake", usual: { name: "1 slice of frosted chocolate cake", kcal: 350, protein: 4, carbs: 50 } },
    { id: "apple-pie", emoji: "🥧", label: "Apple pie", recipe: "apple-crumble", usual: { name: "1 slice of apple pie", kcal: 410, protein: 4, carbs: 58 } },
    { id: "ice-cream", emoji: "🍨", label: "Cookie dough ice cream", recipe: "cookie-dough-bowl", usual: { name: "1 cup cookie dough ice cream", kcal: 340, protein: 5, carbs: 40 } },
    { id: "pina-colada", emoji: "🍍", label: "Piña colada", recipe: "pina-colada-vanilla-tropical", usual: { name: "Store-bought piña colada smoothie (16 oz)", kcal: 400, protein: 4, carbs: 80 } },
  ].filter((c) => R.some((r) => r.id === c.recipe));

  const list = document.querySelector("[data-cravings]");
  const vs = document.querySelector("[data-vs]");
  let current = null;

  const TINTS = ["#FFD6E8", "#FFE3C4", "#CFEFFF", "#E3DCFF", "#FFF0C2", "#D8F5E3", "#F5D7C8", "#D9E4FF"];
  list.innerHTML = CRAVINGS.map((c, i) =>
    `<li><button type="button" class="crave" data-crave="${c.id}" aria-pressed="false" style="--qc:${TINTS[i % TINTS.length]}"><span class="crave__emoji" aria-hidden="true">${c.emoji}</span><span class="crave__label">${esc(c.label)}</span></button></li>`).join("");

  function bar(label, usual, nb, unit, better) {
    const max = Math.max(usual, nb, 1);
    const diff = nb - usual;
    let note = "";
    if (better === "more" && diff > 0) note = `${Math.round(nb / Math.max(usual, 1))}× the protein`;
    if (better === "less" && diff < 0) note = `${Math.abs(diff)}${unit} less`;
    return `<div class="cmp__row">
      <div class="cmp__label"><span>${label}</span>${note ? `<em>${note}</em>` : ""}</div>
      <div class="cmp__bar"><span>Usual</span><span class="cmp__track"><span style="width:${(usual / max) * 100}%"></span></span><b>${usual}${unit}</b></div>
      <div class="cmp__bar cmp__bar--nb"><span>NutriBae</span><span class="cmp__track"><span style="width:${(nb / max) * 100}%"></span></span><b>${nb}${unit}</b></div>
    </div>`;
  }

  function show(id) {
    const c = CRAVINGS.find((x) => x.id === id);
    if (!c) return;
    current = c;
    const r = R.find((x) => x.id === c.recipe);
    document.querySelectorAll("[data-crave]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.crave === id)));
    vs.hidden = false;
    const boost = Math.round(r.macros.protein / Math.max(c.usual.protein, 1));
    vs.innerHTML = `
      <div class="vs__head">
        <p class="app-eyebrow">Craving: ${esc(c.label)}</p>
        <span class="vs__badge">⚡ ${boost}× the protein</span>
      </div>
      <div class="vs__cols">
        <div class="vs__col">
          <span class="vs__tag">The usual</span>
          <div class="vs__emoji" aria-hidden="true">${c.emoji}</div>
          <p class="vs__name">${esc(c.usual.name)}</p>
        </div>
        <div class="vs__col vs__col--nb">
          <span class="vs__tag">Your Sweet Swap</span>
          <img src="${r.image}" alt="" width="800" height="600">
          <p class="vs__name">${esc(r.title)}</p>
        </div>
      </div>
      <div class="cmp">
        ${bar("Protein", c.usual.protein, r.macros.protein, "g", "more")}
        ${bar("Carbs", c.usual.carbs, r.macros.carbs, "g", "less")}
        ${bar("Calories", c.usual.kcal, r.macros.kcal, "", "less")}
      </div>
      <div class="rd-actions">
        <a class="btn" href="recipes.html?r=${r.id}&cook=1">Make it now · ${r.minutes} min</a>
        <a class="btn btn--ghost" href="recipes.html?r=${r.id}">See recipe</a>
      </div>`;
    if (!S.swaps.includes(id)) { S.swaps.push(id); app.save(); }
    app.award(`swap:${id}`, 3, `Sweet Swap: ${c.label}`);
    vs.classList.remove("is-in"); void vs.offsetWidth; vs.classList.add("is-in");
    vs.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  list.addEventListener("click", (e) => {
    const b = e.target.closest("[data-crave]");
    if (b) show(b.dataset.crave);
  });

  const q = new URLSearchParams(location.search).get("c");
  if (q) show(q);
})();
