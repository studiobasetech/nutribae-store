/* ==========================================================================
   /api/upsell   One-tap add-on on the thank-you page.
   GET  ?session_id=cs_...   → { offer } or { offer: null }
   POST { session_id }       → charges the card saved at checkout and adds the
                               item to the same Shopify order (same box, no
                               extra shipping for us).
   The offer lasts 15 minutes after the order. Prices are set here only.
   Stripe key needs: Checkout Sessions read, PaymentIntents write,
   Customers read, Subscriptions read.
   ========================================================================== */
const Stripe = require("stripe");
const shopify = require("../lib/shopify");
const local = require("../../public/js/products.js");
const R = require("../lib/reminders");

// First product they didn't already buy gets offered.
// (Costs: Probiotic $9.55, Hydration $14.79, Energy $15.25; no extra shipping.)
const OFFERS = [
  { handle: "probiotic-20-billion", price: 12.95, pitch: "Your gut will thank you. Pairs perfectly with your shakes." },
  { handle: "hydration-powder-peach-mango", price: 22.95, pitch: "Electrolytes in a peach mango treat. Perfect after workouts." },
  { handle: "energy-powder-strawberry-shortcake", price: 22.95, pitch: "Clean energy that tastes like strawberry shortcake." },
];
const WINDOW_MS = 15 * 60 * 1000;

const json = (statusCode, body) => ({ statusCode, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(body) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function context(stripe, sid) {
  const session = await stripe.checkout.sessions.retrieve(sid, {
    expand: ["line_items.data.price.product", "payment_intent", "subscription"],
  });
  if (session.status !== "complete" || session.payment_status !== "paid") return null;
  const created = session.created * 1000;
  if (Date.now() - created > WINDOW_MS) return null;
  const customer = typeof session.customer === "string" ? session.customer : session.customer?.id;
  let pm = session.payment_intent?.payment_method || session.subscription?.default_payment_method || null;
  if (pm && typeof pm !== "string") pm = pm.id;
  if (!customer || !pm) return null;

  const bought = new Set();
  for (const li of session.line_items?.data || []) {
    const id = li.price?.product?.metadata?.product_id;
    if (!id) continue;
    if (id.startsWith("bundle-")) (local.BUNDLES.find((b) => b.id === id)?.items || []).forEach((h) => bought.add(h));
    else bought.add(id);
  }
  let catalog = [];
  try { catalog = await shopify.fetchProducts(); } catch (err) { console.error("upsell catalog:", err.message); return null; }
  for (const o of OFFERS) {
    if (bought.has(o.handle)) continue;
    const p = catalog.find((x) => x.id === o.handle);
    if (!p || !p.variantId || p.available === false) continue;
    return { session, customer, pm, created, offer: { ...o, name: p.name, image: p.image, compareAt: p.price, variantId: p.variantId } };
  }
  return null;
}

exports.handler = async (event) => {
  if (!process.env.STRIPE_SECRET_KEY) return json(200, { offer: null });
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-10-28.endive" });
  const s = R.db(event);
  let sid = "";
  if (event.httpMethod === "GET") sid = (event.queryStringParameters || {}).session_id || "";
  else { try { sid = JSON.parse(event.body || "{}").session_id || ""; } catch { return json(400, { error: "Bad request." }); } }
  sid = String(sid).replace(/[^A-Za-z0-9_]/g, "").slice(0, 100);
  if (!sid.startsWith("cs_")) return json(400, { error: "Missing order." });

  const done = await s.get(`upsell/${sid}`, { type: "json" });
  if (done && done.status === "paid") return json(200, { offer: null, added: true, name: done.name });

  let ctx;
  try { ctx = await context(stripe, sid); } catch (err) { console.error("upsell:", err.message); return json(200, { offer: null }); }
  if (!ctx) return json(200, { offer: null });
  const { offer } = ctx;

  if (event.httpMethod === "GET") {
    return json(200, { offer: { handle: offer.handle, name: offer.name, image: offer.image, price: offer.price, compareAt: offer.compareAt, pitch: offer.pitch, endsAt: ctx.created + WINDOW_MS } });
  }
  if (event.httpMethod !== "POST") return json(405, { error: "Use GET or POST." });

  // Charge the saved card (one charge per order, even on double taps).
  let pi;
  try {
    pi = await stripe.paymentIntents.create({
      amount: Math.round(offer.price * 100),
      currency: "usd",
      customer: ctx.customer,
      payment_method: ctx.pm,
      off_session: true,
      confirm: true,
      description: `Add-on: ${offer.name}`,
      metadata: { kind: "upsell", session: sid, product_id: offer.handle },
    }, { idempotencyKey: `upsell-${sid}` });
  } catch (err) {
    console.error("upsell charge:", err.code, err.message);
    if (err.code === "authentication_required") return json(402, { error: "Your bank needs to confirm this payment, so we couldn’t add it here. You can add it on your next order." });
    return json(402, { error: "We couldn’t charge your card for the add-on. Nothing was charged." });
  }
  if (pi.status !== "succeeded") return json(402, { error: "The payment didn’t go through. Nothing was added." });

  const rec = { status: "paid", handle: offer.handle, name: offer.name, variantId: offer.variantId, price: offer.price, pi: pi.id, at: Date.now(), included: false };
  await s.setJSON(`upsell/${sid}`, rec);

  // Add it to the Shopify order (the webhook adds it itself if the order isn't created yet).
  if (shopify.isConfigured()) {
    for (let i = 0; i < 4; i++) {
      const latest = await s.get(`upsell/${sid}`, { type: "json" });
      if (latest && latest.included) break;
      const order = await shopify.findOrderByTag(`stripe-${sid}`).catch(() => null);
      if (order) {
        try {
          await shopify.addPaidItem(order.id, { variantId: offer.variantId, price: offer.price, note: `Add-on paid on Stripe: ${pi.id}` });
          await s.setJSON(`upsell/${sid}`, { ...rec, editedAt: Date.now() });
          console.log("UPSELL added to", order.name);
        } catch (err) {
          console.error("UPSELL Shopify edit failed (add it by hand):", err.message, pi.id);
        }
        break;
      }
      await sleep(1500);
    }
  }
  return json(200, { added: true, name: offer.name });
};
