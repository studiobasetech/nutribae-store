/* ==========================================================================
   POST /api/stripe-webhook
   Stripe calls this after a payment. This — not the success page — is where
   orders are handled, because a customer can pay and close the tab before
   the success page loads.

   - First payment (checkout.session.completed): creates the paid order in
     Shopify; Shopify routes it to Supliful, which makes and ships it.
   - Subscribe & Save renewals (invoice.paid, billing_reason
     "subscription_cycle"): creates a new Shopify order every month with the
     address saved on the subscription.

   Needs STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET (from the webhook
   endpoint you create in Stripe — see README), plus the SHOPIFY_* variables.
   Webhook events to send: checkout.session.completed,
   checkout.session.async_payment_succeeded, checkout.session.async_payment_failed,
   checkout.session.expired, invoice.paid.
   ========================================================================== */

const Stripe = require("stripe");
const cookbook = require("../lib/cookbook");
const bakery = require("../lib/bakery");
const shopify = require("../lib/shopify");
const reminders = require("../lib/reminders");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-10-28.endive" });

/* ---------- helpers ---------- */

const gid = (id) => (String(id).startsWith("gid://") ? id : `gid://shopify/ProductVariant/${id}`);

function parseLines(metadataValue, qty) {
  try {
    return JSON.parse(metadataValue || "[]").map((l) => ({ v: l.v, a: l.a, q: qty }));
  } catch {
    return [];
  }
}

// Subscription metadata values are limited to 500 characters, so long lists
// are stored in chunks: lines_0, lines_1, ...
function packLines(lines) {
  const text = JSON.stringify(lines);
  const out = {};
  for (let i = 0; i * 450 < text.length; i++) out[`lines_${i}`] = text.slice(i * 450, (i + 1) * 450);
  return out;
}
function unpackLines(md) {
  let text = "";
  for (let i = 0; md[`lines_${i}`] !== undefined; i++) text += md[`lines_${i}`];
  try { return JSON.parse(text || "[]"); } catch { return []; }
}

function shopifyAddress(name, addr, phone) {
  const [firstName, ...rest] = String(name || "").trim().split(/\s+/);
  return {
    firstName: firstName || "",
    lastName: rest.join(" ") || firstName || "",
    address1: addr?.line1 || "",
    address2: addr?.line2 || "",
    city: addr?.city || "",
    provinceCode: addr?.state || "",
    countryCode: addr?.country || "US",
    zip: addr?.postal_code || "",
    phone: phone || "",
  };
}

async function createShopifyOrder({ tag, email, phone, name, address, lines, totalCents, guaranteeCents = 0, currency, note, cookbookUrl = null }) {
  if (!shopify.isConfigured()) return; // place it in Supliful by hand
  const existing = await shopify.findOrderByTag(tag);
  if (existing) {
    console.log("Shopify order already exists:", existing.name);
    return existing;
  }
  if (!lines.length) throw new Error("Order has no Shopify products.");
  if (!email || !phone) throw new Error("Order is missing the customer's email or phone."); // Supliful needs both

  const cur = (currency || "usd").toUpperCase();
  const addr = shopifyAddress(name, address, phone);
  const created = await shopify.createOrder({
    email,
    phone,
    currency: cur,
    financialStatus: "PAID",
    lineItems: lines.map((l) => ({
      variantId: gid(l.v),
      quantity: l.q,
      priceSet: { shopMoney: { amount: String(l.a), currencyCode: cur } },
    })),
    shippingAddress: addr,
    billingAddress: addr,
    shippingLines: [{
      title: guaranteeCents ? "Free shipping + Shipping Guarantee" : "Free shipping",
      priceSet: { shopMoney: { amount: (guaranteeCents / 100).toFixed(2), currencyCode: cur } },
    }],
    transactions: [{
      kind: "SALE",
      status: "SUCCESS",
      gateway: "Stripe",
      amountSet: { shopMoney: { amount: (totalCents / 100).toFixed(2), currencyCode: cur } },
    }],
    tags: ["website", tag, ...(guaranteeCents ? ["shipping-guarantee"] : []), ...(cookbookUrl ? ["cookbook"] : [])],
    ...(cookbookUrl ? { customAttributes: [{ key: "Cookbook download", value: cookbookUrl }] } : {}),
    note,
  }, { sendReceipt: !!cookbookUrl });
  console.log("Shopify order created:", created.name);
  return created;
}

/* ---------- first payment ---------- */

async function fulfillCheckout(sessionId) {
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["line_items.data.price.product"],
  });
  if (session.payment_status === "unpaid") return; // async payment still pending

  const ship = session.collected_information?.shipping_details || session.shipping_details;
  const customer = session.customer_details || {};
  const name = ship?.name || customer.name;

  const allLines = [];
  const recurringLines = [];
  let guaranteeCents = 0;
  for (const li of session.line_items?.data || []) {
    const md = li.price?.product?.metadata || {};
    if (md.kind === "shipping_guarantee") { guaranteeCents += li.amount_total || 0; continue; }
    let lines = parseLines(md.shopify_lines, li.quantity);
    if (!lines.length && md.shopify_variant_id) {
      lines = [{ v: md.shopify_variant_id, a: (li.amount_total / li.quantity / 100).toFixed(2), q: li.quantity }];
    }
    allLines.push(...lines);
    if (li.price?.recurring) recurringLines.push(...lines);
  }

  console.log("NEW ORDER", JSON.stringify({ session: session.id, email: customer.email, name, lines: allLines.length, total: session.amount_total / 100 }));

  // Save what renewals need on the subscription (address, contact, products).
  if (session.subscription) {
    const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
    await stripe.subscriptions.update(subId, {
      metadata: {
        source: "nutribae-website",
        email: customer.email || "",
        phone: customer.phone || "",
        ship_name: name || "",
        ship_line1: ship?.address?.line1 || "",
        ship_line2: ship?.address?.line2 || "",
        ship_city: ship?.address?.city || "",
        ship_state: ship?.address?.state || "",
        ship_zip: ship?.address?.postal_code || "",
        ship_country: ship?.address?.country || "US",
        ...packLines(recurringLines),
      },
    });
  }

  // Free cookbook: signed download link, saved on the Shopify order (shown in
  // the order confirmation email, see README) and logged here.
  let cookbookUrl = null;
  if (session.metadata?.cookbook === "1") {
    cookbookUrl = cookbook.link(cookbook.makeToken(session.id));
    console.log("COOKBOOK", JSON.stringify({ session: session.id, email: customer.email }));
  }

  // One-tap add-on bought on the success page before this order was created:
  // ship it in the same box.
  const rs = reminders.db();
  let upsell = null;
  try { upsell = await rs.get(`upsell/${session.id}`, { type: "json" }); } catch { /* none */ }
  let extraCents = 0;
  if (upsell && upsell.status === "paid" && !upsell.included && !upsell.editedAt) {
    allLines.push({ v: String(upsell.variantId).split("/").pop(), a: Number(upsell.price).toFixed(2), q: 1 });
    extraCents = Math.round(upsell.price * 100);
    upsell.included = true;
    await rs.setJSON(`upsell/${session.id}`, upsell);
  }

  const order = await createShopifyOrder({
    tag: `stripe-${session.id}`,
    cookbookUrl,
    email: customer.email,
    phone: customer.phone,
    name,
    address: ship?.address,
    lines: allLines,
    totalCents: session.amount_total + extraCents,
    guaranteeCents,
    currency: session.currency,
    note: `Paid on nutribae website. Stripe session: ${session.id}${guaranteeCents ? ` · Shipping Guarantee purchased ($${(guaranteeCents / 100).toFixed(2)})` : ""}`,
  });

  await bakeryAfterOrder(session, customer.email);

  try {
    if (order && order.id) await rs.setJSON(`order/${session.id}`, { orderId: order.id, name: order.name, at: Date.now() });
    if (session.metadata?.cart) await rs.delete(`cart/${session.metadata.cart}`); // bought: no reminders
  } catch (err) { console.error("reminders cleanup:", err.message); }

  // TODO: email the customer their Wellness Made Sweet download link.
}

/* ---------- NutriBae Bakery: friend orders + delivered gifts ---------- */
async function bakeryAfterOrder(session, email) {
  try {
    const store = bakery.db();
    const md = session.metadata || {};
    const eh = email ? bakery.hash(email) : null;
    const firstOrder = eh ? !(await store.get(`o/${eh}`)) : false;
    if (eh && firstOrder) await store.setJSON(`o/${eh}`, { at: Date.now(), session: session.id });

    // A friend's FIRST order from a bakery link counts toward the referrer's treat.
    if (md.ref && eh && firstOrder) {
      const refId = await store.get(`c/${md.ref}`);
      const referrer = refId ? await store.get(`p/${refId}`, { type: "json" }) : null;
      if (referrer && referrer.emailHash !== eh && !(referrer.friendOrders || []).some((o) => o.emailHash === eh)) {
        referrer.friendOrders = referrer.friendOrders || [];
        referrer.friendOrders.push({ emailHash: eh, at: Date.now(), session: session.id });
        referrer.sprinkles = (referrer.sprinkles || 0) + bakery.FRIEND_ORDER_SPRINKLES;
        await store.setJSON(`p/${referrer.id}`, referrer);
        console.log("BAKERY friend order for", md.ref);
      }
    }
    // The free gift shipped with this order: clear it.
    if (md.gift) {
      const player = await store.get(`p/${md.gift}`, { type: "json" });
      if (player && player.pendingGift) {
        player.pendingGift = null;
        await store.setJSON(`p/${player.id}`, player);
      }
    }
  } catch (err) {
    console.error("Bakery after-order error:", err.message);
  }
}

/* ---------- Abandoned checkout (Stripe page expired unpaid) ----------
   Only shoppers who ticked "email me" on the Stripe page get an email. */
async function checkoutExpired(obj) {
  const rs = reminders.db();
  const mail = obj.customer_details?.email || "";
  const consent = obj.consent?.promotions === "opt_in";
  const recovery = obj.after_expiration?.recovery?.url || null;
  const cartKey = obj.metadata?.cart ? `cart/${obj.metadata.cart}` : null;
  const existing = cartKey ? await rs.get(cartKey, { type: "json" }) : null;
  if (existing) {
    if (consent && mail) existing.email = mail;
    if (recovery) existing.recovery = recovery;
    await rs.setJSON(cartKey, existing);
    return;
  }
  if (!consent || !mail) return;
  const full = await stripe.checkout.sessions.retrieve(obj.id, { expand: ["line_items"] });
  const names = (full.line_items?.data || []).map((li) => li.description).filter((n) => n && !/Shipping Guarantee|Free gift/.test(n));
  await rs.setJSON(`cart/s${obj.id.replace(/[^A-Za-z0-9]/g, "").slice(-20)}`, { lines: [], names, email: mail, pushKey: null, recovery, updatedAt: obj.created * 1000, sent: {} });
  console.log("CHECKOUT EXPIRED, reminder queued", obj.id);
}

/* ---------- Subscribe & Save renewals ---------- */

async function fulfillRenewal(invoice) {
  if (invoice.billing_reason !== "subscription_cycle") return; // first payment is handled above
  const subId = invoice.parent?.subscription_details?.subscription || invoice.subscription;
  if (!subId) return;
  const sub = await stripe.subscriptions.retrieve(typeof subId === "string" ? subId : subId.id);
  const md = sub.metadata || {};
  const lines = unpackLines(md);

  console.log("RENEWAL", JSON.stringify({ invoice: invoice.id, subscription: sub.id, lines: lines.length, total: invoice.amount_paid / 100 }));

  await createShopifyOrder({
    tag: `stripe-${invoice.id}`,
    email: md.email || invoice.customer_email,
    phone: md.phone,
    name: md.ship_name || invoice.customer_name,
    address: {
      line1: md.ship_line1, line2: md.ship_line2, city: md.ship_city,
      state: md.ship_state, postal_code: md.ship_zip, country: md.ship_country,
    },
    lines,
    totalCents: invoice.amount_paid,
    currency: invoice.currency,
    note: `Subscribe & Save renewal. Stripe invoice: ${invoice.id}`,
  });
}

/* ---------- entry point ---------- */

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Use POST." };

  const signature = event.headers["stripe-signature"];
  const rawBody = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature check failed:", err.message);
    return { statusCode: 400, body: "Invalid signature." };
  }

  try { bakery.db(event); } catch { /* blobs connect for the bakery */ }
  try {
    switch (stripeEvent.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await fulfillCheckout(stripeEvent.data.object.id);
        break;
      case "checkout.session.async_payment_failed":
        console.log("PAYMENT FAILED", stripeEvent.data.object.id);
        break;
      case "checkout.session.expired":
        await checkoutExpired(stripeEvent.data.object);
        break;
      case "invoice.paid":
        await fulfillRenewal(stripeEvent.data.object);
        break;
      default:
        break; // ignore other events
    }
  } catch (err) {
    console.error("Order handling failed:", err.message);
    return { statusCode: 500, body: "Order handling failed." }; // Stripe will retry
  }

  return { statusCode: 200, body: "ok" };
};
