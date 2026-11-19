/* ==========================================================================
   POST /api/checkout
   Receives the cart from the browser, rebuilds it with the real prices from
   Shopify (or js/products.js if Shopify isn't connected) — never trusts
   prices from the browser — creates a Stripe Checkout Session and returns
   its URL. Each line carries the Shopify variant ID so the paid order can be
   created in Shopify, which routes it to Supliful.

   Needs the environment variable STRIPE_SECRET_KEY (set it in Netlify, never
   in this file). Use a restricted key (rk_...) with Checkout Sessions: Write,
   Subscriptions: Write, Invoices: Read and Products: Read.
   ========================================================================== */

const Stripe = require("stripe");
const local = require("../../public/js/products.js");
const shopify = require("../lib/shopify");
const { findCode } = require("./discount");
const bakery = require("../lib/bakery");

// Countries you ship to. Stripe needs two-letter codes.
// TODO: add the rest of your "25+ countries" (e.g. "CA", "GB", "AU", "MX").
const SHIP_TO = ["US"];
const MAX_QTY_PER_ITEM = 10;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-10-28.endive" });

function json(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

function randomLetters(n) {
  const abc = "abcdefghijklmnopqrstuvwxyz";
  return Array.from({ length: n }, () => abc[Math.floor(Math.random() * abc.length)]).join("");
}

// Splits one cart line into the Shopify variants it contains, sharing the
// paid price across them (a bundle becomes its separate products).
function shopifyLines(item, unit) {
  const parts = item.isBundle ? item.parts : [item];
  if (parts.some((p) => !p.variantId)) return [];
  const base = parts.reduce((s, p) => s + p.price, 0);
  let left = Math.round(unit * 100);
  return parts.map((p, i) => {
    const cents = i === parts.length - 1 ? left : Math.round((p.price / base) * unit * 100);
    left -= cents;
    return { v: p.variantId.split("/").pop(), a: (cents / 100).toFixed(2) };
  });
}

function productImageUrl(product, siteUrl) {
  if (!product.image) return null;
  if (product.image.startsWith("https://")) return product.image; // Shopify CDN
  return siteUrl.startsWith("https://") ? `${siteUrl}/${product.image}` : null;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Use POST." });
  if (!process.env.STRIPE_SECRET_KEY) return json(500, { error: "Checkout isn't set up yet." });

  let lines, guarantee = false, cookbook = false, code = "", ref = "", bakeryToken = "", cartId = "", prefill = null;
  try {
    const body = JSON.parse(event.body || "{}");
    lines = body.lines;
    guarantee = body.guarantee === true;
    cookbook = body.cookbook === true; // free Wellness Made Sweet cookbook
    code = String(body.code || "").trim().toUpperCase().slice(0, 40);
    ref = String(body.ref || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);     // friend's bakery link
    bakeryToken = typeof body.bakeryToken === "string" ? body.bakeryToken.slice(0, 80) : ""; // free gift
    cartId = String(body.cartId || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 24);          // abandoned-cart reminders
    prefill = body.prefill && typeof body.prefill === "object" ? body.prefill : null;    // saved address (My profile)
  } catch {
    return json(400, { error: "Your cart couldn't be read. Refresh the page and try again." });
  }
  if (!Array.isArray(lines) || lines.length === 0) return json(400, { error: "Your cart is empty." });

  // Live catalog from Shopify when connected; local list otherwise.
  let catalog = local.PRODUCTS;
  if (shopify.isConfigured()) {
    try {
      catalog = await shopify.fetchProducts();
    } catch (err) {
      console.error("Shopify products error:", err.message);
      return json(502, { error: "Checkout is unavailable right now. Try again in a minute." });
    }
  }
  const lineItems = [];
  let hasSubscription = false;
  const clean = [];
  for (const line of lines) {
    const item = local.resolveItem(String(line.id), catalog); // product or bundle
    const qty = Number.parseInt(line.qty, 10);
    const plan = line.plan === "sub" ? "sub" : "once";
    if (!item) return json(400, { error: "A product in your cart is no longer available. Remove it and try again." });
    if (item.price == null || item.available === false) return json(400, { error: `${item.shortName} isn't available right now.` });
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_PER_ITEM) {
      return json(400, { error: `Choose between 1 and ${MAX_QTY_PER_ITEM} of ${item.shortName}.` });
    }
    clean.push({ id: item.id, qty, plan });
  }

  // Real prices, including the "spend more, save more" cart deal (products.js).
  const priced = local.priceCart(clean, (id) => local.resolveItem(id, catalog));
  const subtotal = priced.subtotal;
  const siteUrl = process.env.URL || ""; // Netlify sets URL to your live site address
  for (const row of priced.rows) {
    const { item, unit } = row;
    const { qty, plan } = row.line;
    if (plan === "sub") hasSubscription = true;
    const deal = unit < row.base && priced.tier ? `Cart deal ${Math.round(priced.tier.off * 100)}% off` : "";
    const description = [
      item.isBundle ? item.parts.map((p) => p.name).join(" + ") : item.size,
      plan === "sub" ? `Subscribe & save 15% · ${local.SUBSCRIBE.label.toLowerCase()}` : "",
      deal,
    ].filter(Boolean).join(" · ");

    lineItems.push({
      quantity: qty,
      price_data: {
        currency: "usd",
        unit_amount: Math.round(unit * 100), // Stripe uses cents
        ...(plan === "sub" ? { recurring: { interval: local.SUBSCRIBE.interval } } : {}),
        product_data: {
          name: item.name,
          ...(description ? { description } : {}),
          ...(productImageUrl(item, siteUrl) ? { images: [productImageUrl(item, siteUrl)] } : {}),
          metadata: {
            product_id: item.id,
            plan,
            // What Shopify needs to create the order: variant + price per unit.
            shopify_lines: JSON.stringify(shopifyLines(item, unit)),
          },
        },
      },
    });
  }

  // Optional Shipping Guarantee: one-time charge on this order (never recurring).
  // The webhook sends it to Shopify as a shipping line, not a product, so
  // Supliful only receives the real products.
  if (guarantee) {
    const g = local.guaranteePrice(subtotal);
    if (g > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: Math.round(g * 100),
          product_data: {
            name: "Shipping Guarantee",
            description: "Refund if your package is lost or damaged",
            metadata: { kind: "shipping_guarantee" },
          },
        },
      });
    }
  }

  // NutriBae Bakery free gift that ships with this order (e.g. the Probiotic).
  let giftPlayer = null;
  if (bakeryToken) {
    try {
      const store = bakery.db(event);
      const pid = bakery.playerIdFrom(bakeryToken);
      const player = pid ? await store.get(`p/${pid}`, { type: "json" }) : null;
      if (player && player.pendingGift && player.pendingGift.variantId) {
        giftPlayer = player.id;
        lineItems.push({
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: 0,
            product_data: {
              name: `Free gift: ${player.pendingGift.name}`,
              description: "Won in the NutriBae Bakery",
              metadata: { kind: "bakery_gift", shopify_lines: JSON.stringify([{ v: player.pendingGift.variantId.split("/").pop(), a: "0.00" }]) },
            },
          },
        });
      }
    } catch (err) { console.error("Bakery gift lookup:", err.message); }
  }

  // Discount code typed in the cart: apply it directly. Without one, the
  // Stripe page still shows its own "Add promotion code" field.
  let discounts = null;
  if (code) {
    try {
      const found = await findCode(stripe, code);
      if (!found) return json(400, { error: `The code ${code} isn't valid or has expired. Remove it and try again.` });
      discounts = [{ promotion_code: found.pc.id }];
    } catch (err) {
      console.error("Discount code error:", err.type, err.code, err.message);
      return json(502, { error: "We couldn't check your discount code. Remove it to continue, or try again." });
    }
  }

  const origin = process.env.URL || event.headers.origin || `https://${event.headers.host}`;

  // Saved default address from My profile: put it on a Stripe customer so the
  // payment page opens with the email, name and shipping address filled in.
  let customer = null;
  if (prefill) {
    const t = (v, n) => String(v || "").trim().slice(0, n);
    const email = t(prefill.email, 200).toLowerCase();
    const addr = { line1: t(prefill.line1, 120), line2: t(prefill.line2, 120) || undefined, city: t(prefill.city, 80), state: t(prefill.state, 2).toUpperCase(), postal_code: t(prefill.zip, 10), country: "US" };
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && addr.line1 && addr.city && /^[A-Z]{2}$/.test(addr.state) && /^\d{5}(-\d{4})?$/.test(addr.postal_code);
    if (ok) {
      const info = { email, name: t(prefill.name, 100), phone: t(prefill.phone, 30), address: addr, shipping: { name: t(prefill.name, 100), phone: t(prefill.phone, 30), address: addr } };
      try {
        const found = await stripe.customers.list({ email, limit: 1 });
        customer = found.data[0] ? (await stripe.customers.update(found.data[0].id, info)).id : (await stripe.customers.create({ ...info, metadata: { source: "nutribae-website" } })).id;
      } catch (err) { console.error("Prefill customer:", err.message); customer = null; } // checkout still works without it
    }
  }

  try {
    const session = await stripe.checkout.sessions.create({
      // Any Subscribe & Save item makes this a subscription checkout; one-time
      // items in the same cart are charged once with the first payment.
      mode: hasSubscription ? "subscription" : "payment",
      line_items: lineItems,
      ...(discounts ? { discounts } : { allow_promotion_codes: true }), // Spin to win codes (create them in Stripe)
      ...(customer ? { customer, customer_update: { name: "auto", address: "auto", shipping: "auto" } } : {}),
      metadata: { source: "nutribae-website", cookbook: cookbook ? "1" : "0", ...(ref ? { ref } : {}), ...(giftPlayer ? { gift: giftPlayer } : {}), ...(cartId ? { cart: cartId } : {}) },
      // Abandoned checkout: the page expires after an hour; shoppers who said yes
      // to emails get a reminder with a link back (stripe-webhook.js).
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
      consent_collection: { promotions: "auto" },
      after_expiration: { recovery: { enabled: true, allow_promotion_codes: true } },
      ...(cookbook ? { custom_text: { submit: { message: "Your free Wellness Made Sweet cookbook (PDF + all recipes in the app) unlocks right after payment." } } } : {}),
      shipping_address_collection: { allowed_countries: SHIP_TO },
      ...(hasSubscription
        ? { subscription_data: { metadata: { source: "nutribae-website" } } }
        : {
            // Save the card so the one-tap add-on after checkout can use it.
            ...(customer ? {} : { customer_creation: "always" }),
            payment_intent_data: { setup_future_usage: "off_session" },
            shipping_options: [
              {
                shipping_rate_data: {
                  type: "fixed_amount",
                  fixed_amount: { amount: 0, currency: "usd" },
                  display_name: "Free shipping",
                },
              },
            ],
          }),
      phone_number_collection: { enabled: true }, // required: Supliful declines orders without a phone
      // Sales tax: leave off until you've registered in a state (see README).
      success_url: `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/shop.html`,
      integration_identifier: `nutribae-store-${randomLetters(8)}`,
    });
    return json(200, { url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err.type, err.code, err.message); // never log keys
    return json(502, { error: "Checkout is unavailable right now. Try again in a minute." });
  }
};
