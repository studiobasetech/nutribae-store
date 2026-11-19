/* ==========================================================================
   NutriBae product catalog
   Products now come from Shopify (see netlify/functions/products.js).
   This list is only the fallback used when Shopify isn't connected, plus
   extra info (details, disclaimer, size) matched by id = Shopify handle.
   price: in US dollars. null = not set yet (shows "Price coming soon").
   image: path under assets/images. null = pink placeholder until you add one.
   This file is shared: the browser uses it to show products, and the
   checkout function uses it to set the real price (so prices can't be
   changed from the browser).
   ========================================================================== */

(function () {
  const PRODUCTS = [
  {
    id: "vanilla-birthday-cake-plant-based-protein-powder",
    name: "Plant-Based Vanilla Birthday Cake Protein Powder",
    shortName: "Vanilla Birthday Cake Protein",
    category: "Protein",
    price: null, // TODO: your price, e.g. 44.99
    size: "29.4 oz (833 g)",
    image: "assets/images/vanilla-birthday-cake.jpg",
    description:
      "A creamy, dreamy plant-based protein that tastes like a slice of celebration cake. 20g of protein per serving, sweetened with stevia.",
  },
  {
    id: "chocolate-brownie-delight-plant-based-protein-powder",
    name: "Plant-Based Chocolate Brownie Delight Protein Powder",
    shortName: "Chocolate Brownie Delight Protein",
    category: "Protein",
    price: null, // TODO
    size: "29.4 oz (833 g)",
    image: "assets/images/chocolate-brownie-delight.jpg",
    description:
      "Luxuriously creamy plant-based protein that tastes like fudgy brownies. 21g of protein per serving, sweetened with stevia.",
  },
  {
    id: "energy-powder-strawberry-shortcake",
    name: "Energy Powder — Strawberry Shortcake",
    shortName: "Strawberry Shortcake Energy",
    category: "Energy",
    price: null, // TODO
    size: "4.9 oz (140 g)",
    image: "assets/images/energy-strawberry-shortcake.jpg",
    description: "Clean energy, mental focus and lasting endurance in a strawberry shortcake flavor.",
  },
  {
    id: "energy-powder-cotton-candy",
    name: "Energy Powder (Cotton Candy)",
    shortName: "Cotton Candy Energy",
    category: "Energy",
    price: null, // TODO
    size: "4.94 oz (140 g)",
    image: null, // TODO: add assets/images/energy-cotton-candy.jpg
    description:
      "Tired of the highs and lows from traditional energy drinks? Discover a balanced boost with our Energy Powder, a great-tasting sugar-free formula crafted for a smooth, sustained lift in energy and focus. Whether you're gearing up for an intense workout, a marathon gaming session, or a demanding day at the office, our Energy Powder is here to support you.*",
    details: [
      {
        title: "Key highlights",
        list: [
          "Backed by science: a carefully selected blend of components supported by scientific research to support energy and focus.*",
          "Balanced energy: caffeine and L-theanine for a steady energy boost, without jitters or the dreaded crash.*",
          "Nutrient-rich: infused with essential electrolytes and nutrients to support hydration and overall wellness.*",
          "Precisely formulated: every ingredient is included at specific dosages, aligned with wellness goals.*",
          "Sugar-free flavor: the refreshing taste of Cotton Candy without the sugar.",
        ],
      },
      {
        title: "Ideal for",
        list: [
          "Gamers: a steady energy flow that keeps you sharp and engaged.*",
          "Fitness enthusiasts: helps sustain energy and endurance without jitters.*",
          "Professionals & students: improved focus and energy to stay productive.*",
          "Anyone seeking a balanced boost: a supportive lift for busy days.*",
        ],
      },
      {
        title: "Ingredients",
        text: "Thiamin (as Thiamine HCl) 0.40 mg, Riboflavin (Vitamin B2) 0.43 mg, Niacin (Vitamin B3) 5.20 mg NE, Vitamin B6 (as Pyridoxine HCl) 0.56 mg, Folate 133 mcg DFE (78 mcg Folic Acid), Vitamin B12 (as Methylcobalamin) 0.80 mcg, Pantothenic Acid (as D-Calcium Pantothenate) 1.66 mg, Magnesium (as Magnesium Citrate) 36 mg, Sodium (as Sodium Citrate) 60 mg, Potassium (as Potassium Citrate) 130 mg, Taurine 1000 mg, Natural Caffeine (from Green Tea) 200 mg, L-Theanine 100 mg, Polydextrose, Citric Acid, Natural and Artificial Flavors, Sucralose, Calcium Silicate, Blue Spirulina (for color).",
      },
      {
        title: "How to use",
        text: "Using the scoop inside the jar, mix one scoop with 6–10 oz (177–296 ml) of water, to taste. For a larger drink, mix 2 scoops with 12–20 oz (355–591 ml) of water.",
      },
      {
        title: "Warnings & storage",
        text: "Contains 200 mg of caffeine per serving. Do not exceed 5 scoops in 24 hours. Not intended for use by persons with a medical condition. Consult your physician before use if you are pregnant or nursing or taking any medication. Manufactured in a facility that produces milk, eggs, fish, shellfish, tree nuts, peanuts, wheat, soybeans and sesame. Store in a cool, dry place and keep out of reach of children. Do not use if the safety seal is broken or missing. Contents sold by weight, not volume; some settling may occur. Secure lid tightly when not in use. Consume within 90 days. Made in the USA.",
      },
    ],
    disclaimer:
      "*These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease.",
  },
  {
    id: "hydration-powder-peach-mango",
    name: "Hydration Powder (Peach Mango)",
    shortName: "Peach Mango Hydration",
    category: "Hydration",
    price: null, // TODO
    size: "4.9 oz (140 g)", // from the jar label (product sheet says 5.71 oz / 162 g, confirm)
    image: "assets/images/hydration-peach-mango.jpg",
    description:
      "Elevate your hydration routine with Peach Mango HYDRATION, a delicious drink that combines essential electrolytes to keep you hydrated and energized. Ideal for any activity level, from marathon gaming to marathon running, HYDRATION delivers pure, clean refreshment with a delightful, uplifting taste.",
    // Optional extra info, shown in expandable sections on the Shop page
    details: [
      {
        title: "Key highlights",
        list: [
          "Premium formulation: avoids fillers and unnecessary additives, focusing on essential nutrients.*",
          "All-day consumption: suitable for consumption throughout the day.*",
          "Keto friendly: designed to fit into various dietary lifestyles.*",
          "Various nutrients: contains essential nutrients to support overall health.*",
          "Supports muscle function: helps maintain proper muscle function and endurance.*",
          "Enhances endurance: boosts stamina for both physical and mental activities.*",
          "Caffeine-free and uplifting taste: enjoy the refreshing taste without caffeine or sugar.*",
        ],
      },
      {
        title: "Ideal for",
        list: [
          "Athletes: supports hydration and endurance for high-energy activities.*",
          "Professionals & students: helps maintain hydration and focus throughout the day.*",
          "Anyone seeking hydration: a clean, refreshing drink to stay hydrated and healthy.*",
        ],
      },
      {
        title: "Ingredients",
        text: "Vitamin B1 (as Thiamine HCl) 0.40 mg, Vitamin B2 (Riboflavin) 0.43 mg, Vitamin B3 (Niacin) 5.20 mg NE, Vitamin B5 (as D-Calcium Pantothenate) 1.66 mg, Vitamin B6 (as Pyridoxine HCl) 0.56 mg, Vitamin B9 (Folate) 133 mcg DFE (78 mcg Folic Acid), Vitamin B12 (as Methylcobalamin) 0.80 mcg, Calcium (as Calcium Citrate) 40 mg, Magnesium (as Magnesium Citrate) 20 mg, Sodium (as Sodium Citrate) 100 mg, Potassium (as Potassium Citrate) 200 mg, Polydextrose, Citric Acid, Natural & Artificial Flavors, Sucralose, Calcium Silicate, Beta Carotene (for color).",
      },
      {
        title: "How to use",
        text: "Using the scoop inside the jar, mix one scoop with 14–20 oz (414–591 ml) of water, to taste. For a larger drink, mix 2 scoops with 28–40 oz (828 ml–1.2 L) of water.",
      },
      {
        title: "Warnings & storage",
        text: "Do not exceed 5 scoops in 24 hours. Not intended for use by persons with a medical condition. Consult your physician before use if you are pregnant or nursing or taking any medication. Manufactured in a facility that produces milk, eggs, fish, shellfish, tree nuts, peanuts, wheat, soybeans and sesame. Store in a cool, dry place and keep out of reach of children. Do not use if the safety seal is broken or missing. Contents sold by weight, not volume; some settling may occur. Secure lid tightly when not in use. Consume within 90 days. Made in the USA.",
      },
    ],
    disclaimer:
      "*These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease.",
  },
];

  /* ---------- Subscribe & Save + Bundles (shared by site and checkout) ---------- */
  const SUBSCRIBE = { discount: 0.15, interval: "month", label: "Delivered every month" };

  // Optional Shipping Guarantee in the cart: refund or replacement if the
  // package is lost, stolen or damaged. Priced like the common shipping
  // protection apps: a % of the order with a minimum. Change the numbers here
  // (the checkout function uses the same ones, so prices can't be tampered with).
  const SHIPPING_GUARANTEE = { rate: 0.03, min: 1.95 };
  function guaranteePrice(subtotal) {
    if (!(subtotal > 0)) return 0;
    return Math.max(SHIPPING_GUARANTEE.min, Math.ceil(subtotal * SHIPPING_GUARANTEE.rate * 100) / 100);
  }

  // Bundles are built from existing Shopify products (by handle). The price is
  // the items added up, minus the bundle discount; the old total is shown
  // struck through.
  const BUNDLES = [
    {
      id: "bundle-dessert-lovers-duo",
      name: "Dessert Lovers Duo",
      tagline: "Birthday cake + brownie. Why choose?",
      items: [
        "vanilla-birthday-cake-plant-based-protein-powder",
        "chocolate-brownie-delight-plant-based-protein-powder",
      ],
      discount: 0.15,
    },
    {
      id: "bundle-sweet-day-set",
      name: "Sweet Day Set",
      tagline: "Protein, energy and hydration for your whole day.",
      items: [
        "vanilla-birthday-cake-plant-based-protein-powder",
        "energy-powder-strawberry-shortcake",
        "hydration-powder-peach-mango",
      ],
      discount: 0.15,
    },
    {
      id: "bundle-sweet-starter-kit",
      name: "Sweet Starter Kit",
      tagline: "Protein, energy and gut love. The best way to start.",
      items: [
        "vanilla-birthday-cake-plant-based-protein-powder",
        "energy-powder-strawberry-shortcake",
        "probiotic-20-billion",
      ],
      discount: 0.15,
    },
    {
      id: "bundle-sweat-and-sip-duo",
      name: "Sweat & Sip Duo",
      tagline: "Energy before your workout, hydration after.",
      items: [
        "energy-powder-cotton-candy",
        "hydration-powder-peach-mango",
      ],
      discount: 0.15,
    },
  ];

  // Spend more, save more: a % off single products bought one time (bundles
  // and Subscribe & Save already have their own discount). Based on the cart
  // total. The checkout function uses these same numbers.
  const CART_TIERS = [
    { min: 75, off: 0.10 },
    { min: 110, off: 0.15 },
  ];
  const tierEligible = (item, plan) => plan !== "sub" && !item.isBundle;

  // Prices a whole cart. resolve(id) returns the product/bundle or null.
  function priceCart(lines, resolve) {
    const rows = [];
    let base = 0, missing = false;
    for (const l of lines) {
      const item = resolve(l.id);
      if (!item) continue;
      const unit = linePrice(item, l.plan);
      if (unit == null) { missing = true; continue; }
      base += unit * l.qty;
      rows.push({ line: l, item, base: unit });
    }
    base = round2(base);
    let tier = null;
    CART_TIERS.forEach((t) => { if (base >= t.min) tier = t; });
    const next = CART_TIERS.find((t) => base < t.min) || null;
    let total = 0, saved = 0;
    rows.forEach((r) => {
      r.unit = tier && tierEligible(r.item, r.line.plan) ? round2(r.base * (1 - tier.off)) : r.base;
      total += r.unit * r.line.qty;
      saved += (r.base - r.unit) * r.line.qty;
    });
    const eligible = rows.some((r) => tierEligible(r.item, r.line.plan));
    return { rows, base, tier, next, toNext: next ? round2(next.min - base) : 0, subtotal: round2(total), saved: round2(saved), eligible, missing };
  }

  const round2 = (n) => Math.round(n * 100) / 100;

  // Returns a product, or a bundle priced from the catalog, or null.
  function resolveItem(id, catalog) {
    const product = catalog.find((p) => p.id === id);
    if (product) return product;
    const b = BUNDLES.find((x) => x.id === id);
    if (!b) return null;
    const parts = b.items.map((h) => catalog.find((p) => p.id === h));
    if (parts.some((p) => !p)) return null;
    const missingPrice = parts.some((p) => p.price == null);
    const compareAt = missingPrice ? null : round2(parts.reduce((s, p) => s + p.price, 0));
    return {
      ...b,
      isBundle: true,
      shortName: b.name,
      category: "Bundle",
      parts,
      compareAt,
      price: compareAt == null ? null : round2(compareAt * (1 - b.discount)),
      available: parts.every((p) => p.available !== false),
      image: parts[0].image || null,
    };
  }

  function linePrice(item, plan) {
    if (item.price == null) return null;
    return plan === "sub" ? round2(item.price * (1 - SUBSCRIBE.discount)) : item.price;
  }

  function formatPrice(price) {
    if (price === null || price === undefined) return "Price coming soon";
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(price);
  }
  function findProduct(id) {
    const list = typeof window !== "undefined" && window.NB_PRODUCTS ? window.NB_PRODUCTS : PRODUCTS;
    return list.find((p) => p.id === id);
  }

  if (typeof window !== "undefined") {
    window.NB_PRODUCTS = PRODUCTS;
    window.NB_formatPrice = formatPrice;
    window.NB_findProduct = findProduct;
    window.NB_findItem = (id) => resolveItem(id, window.NB_PRODUCTS);
    window.NB_BUNDLES = BUNDLES;
    window.NB_SUBSCRIBE = SUBSCRIBE;
    window.NB_linePrice = linePrice;
    window.NB_guaranteePrice = guaranteePrice;
    window.NB_CART_TIERS = CART_TIERS;
    window.NB_priceCart = (lines) => priceCart(lines, (id) => resolveItem(id, window.NB_PRODUCTS));
    window.NB_productsSource = "local";

    // Star rating (pink), used on product cards, product pages and badges.
    window.NB_stars = function (rating, size = 16) {
      const pct = Math.max(0, Math.min(100, (rating / 5) * 100));
      const star = '<path d="M10 1.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L10 15l-5.2 2.7 1-5.9L1.5 7.7l5.9-.8z"/>';
      const row = Array.from({ length: 5 }, (_, i) => `<svg viewBox="0 0 20 20" width="${size}" height="${size}" x="${i * (size + 2)}">${star}</svg>`).join("");
      const w = 5 * size + 8;
      return `<span class="stars" role="img" aria-label="${rating.toFixed(1)} out of 5 stars" style="width:${w}px;height:${size}px"><span class="stars__base"><svg width="${w}" height="${size}" aria-hidden="true">${row}</svg></span><span class="stars__fill" style="width:${pct}%"><svg width="${w}" height="${size}" aria-hidden="true">${row}</svg></span></span>`;
    };

    // Review summary from Judge.me (only real reviews; nothing shows until there are some).
    window.NB_reviewSummary = fetch("/api/reviews?summary=1")
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);

    // Live products from Shopify (published there by Supliful).
    // The list above is the fallback while Shopify isn't connected.
    // Extra info kept here (details, disclaimer, size) is added to the
    // Shopify product with the same id (its Shopify "handle").
    window.NB_productsReady = fetch("/api/products")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data || !Array.isArray(data.products) || !data.products.length) return;
        window.NB_PRODUCTS = data.products.map((p) => {
          const extra = PRODUCTS.find((x) => x.id === p.id) || {};
          return {
            ...p,
            size: extra.size || p.size || "",
            details: extra.details,
            disclaimer: extra.disclaimer,
            image: p.image || extra.image || null,
          };
        });
        window.NB_productsSource = "shopify";
      })
      .catch(() => { /* offline or not connected: keep the local list */ })
      .finally(() => {
        window.NB_productsLoaded = true;
        window.dispatchEvent(new Event("nb:products"));
      });
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { CART_TIERS, priceCart, tierEligible, PRODUCTS, BUNDLES, SUBSCRIBE, SHIPPING_GUARANTEE, guaranteePrice, resolveItem, linePrice, formatPrice, findProduct };
  }
})();
