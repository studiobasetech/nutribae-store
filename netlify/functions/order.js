/* ==========================================================================
   GET /api/order?session_id=cs_...   (My profile → My orders)
   What was bought, the total, and the shipping status from Shopify
   (tracking link once Supliful ships it). Only someone who has the order's
   checkout id (saved on their device by the thank-you page) can look it up.
   ========================================================================== */
const Stripe = require("stripe");
const shopify = require("../lib/shopify");

const json = (statusCode, body) => ({ statusCode, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(body) });

exports.handler = async (event) => {
  const sid = String((event.queryStringParameters || {}).session_id || "").replace(/[^A-Za-z0-9_]/g, "").slice(0, 100);
  if (!sid.startsWith("cs_")) return json(400, { error: "Missing order." });
  if (!process.env.STRIPE_SECRET_KEY) return json(503, { error: "Orders aren’t connected yet." });
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-10-28.endive" });
    const session = await stripe.checkout.sessions.retrieve(sid, { expand: ["line_items"] });
    if (session.status !== "complete") return json(404, { error: "Order not found." });
    const items = (session.line_items?.data || [])
      .filter((li) => !/^Shipping Guarantee$/.test(li.description || ""))
      .map((li) => ({ name: li.description, qty: li.quantity, total: li.amount_total / 100 }));
    const out = {
      id: sid,
      createdAt: session.created * 1000,
      total: session.amount_total / 100,
      currency: (session.currency || "usd").toUpperCase(),
      subscription: !!session.subscription,
      items,
      status: session.payment_status === "paid" ? "Paid" : "Processing",
      orderName: null, tracking: [],
    };
    if (shopify.isConfigured()) {
      try {
        const found = await shopify.findOrderByTag(`stripe-${sid}`);
        if (found) {
          const d = await shopify.gql(
            `query($id: ID!) { order(id: $id) { name displayFulfillmentStatus fulfillments(first: 5) { trackingInfo { number url company } } } }`,
            { id: found.id }
          );
          const o = d.order;
          out.orderName = o.name;
          const f = String(o.displayFulfillmentStatus || "");
          out.status = { FULFILLED: "Shipped", PARTIALLY_FULFILLED: "Partly shipped", IN_PROGRESS: "Being prepared", UNFULFILLED: "Being prepared", ON_HOLD: "On hold", SCHEDULED: "Scheduled" }[f] || out.status;
          out.tracking = (o.fulfillments || []).flatMap((x) => x.trackingInfo || []).filter((t) => t.url || t.number).map((t) => ({ url: t.url || null, number: t.number || null, company: t.company || null }));
        }
      } catch (err) { console.error("order status:", err.message); }
    }
    return json(200, out);
  } catch (err) {
    console.error("order lookup:", err.message);
    return json(502, { error: "We couldn’t load this order right now." });
  }
};
