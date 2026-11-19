/* ==========================================================================
   /api/cart-reminder
   POST { id, lines, email?, endpoint? }  saves the cart so we can remind the
        shopper in 1 hour and 24 hours if they don't check out.
        Only for people who gave us their email (Spin to Win sign-up, which
        says they agree to emails) or turned on app notifications.
   POST { id, clear: true }   cart emptied or bought: forget it.
   POST { review: <stripe session id>, endpoint }  after an order: a push
        notification 10 days later asking for a review.
   GET  ?unsub=<token>        one-click unsubscribe from reminder emails.
   ========================================================================== */
const Stripe = require("stripe");
const R = require("../lib/reminders");
const push = require("../lib/push-store");
const email = require("../lib/email");

const json = (statusCode, body) => ({ statusCode, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(body) });
const REVIEW_AFTER_DAYS = 10;

exports.handler = async (event) => {
  const s = R.db(event);

  if (event.httpMethod === "GET") {
    const h = email.readUnsub((event.queryStringParameters || {}).unsub);
    if (!h) return { statusCode: 400, headers: { "Content-Type": "text/html" }, body: "<p>This link isn’t valid.</p>" };
    await s.set(`unsub/${h}`, "1");
    return { statusCode: 200, headers: { "Content-Type": "text/html; charset=utf-8" }, body: `<!doctype html><meta name="viewport" content="width=device-width"><body style="font-family:sans-serif;text-align:center;padding:60px 20px;color:#111"><h1 style="color:#F19EC8">You’re unsubscribed</h1><p>We won’t send you cart reminders anymore.</p><p><a href="/" style="color:#111">Back to NutriBae</a></p></body>` };
  }
  if (event.httpMethod !== "POST") return json(405, { error: "Use POST." });

  let b;
  try { b = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "Bad request." }); }

  // Which device to notify: only one that already turned on notifications.
  async function pushKeyFor(endpoint) {
    if (typeof endpoint !== "string" || !/^https:\/\//.test(endpoint)) return null;
    const key = push.keyFor(endpoint);
    try { return (await push.store(event).get(key)) ? key : null; } catch { return null; }
  }

  /* ---- review reminder after an order ---- */
  if (b.review) {
    const sid = String(b.review).replace(/[^A-Za-z0-9_]/g, "").slice(0, 100);
    const pushKey = await pushKeyFor(b.endpoint);
    if (!pushKey || !process.env.STRIPE_SECRET_KEY) return json(200, { ok: true });
    if (await s.get(`review/${sid}`)) return json(200, { ok: true });
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-10-28.endive" });
      const session = await stripe.checkout.sessions.retrieve(sid, { expand: ["line_items.data.price.product"] });
      if (session.payment_status === "unpaid") return json(200, { ok: true });
      const items = [];
      for (const li of session.line_items?.data || []) {
        const md = li.price?.product?.metadata || {};
        if (md.product_id && !md.product_id.startsWith("bundle-")) items.push({ handle: md.product_id, name: li.price.product.name });
      }
      if (items.length) await s.setJSON(`review/${sid}`, { pushKey, items: items.slice(0, 3), due: Date.now() + REVIEW_AFTER_DAYS * 86400000, sent: false });
    } catch (err) { console.error("review reminder:", err.message); }
    return json(200, { ok: true });
  }

  /* ---- cart ---- */
  const id = String(b.id || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 24);
  if (id.length < 8) return json(400, { error: "Bad cart." });
  if (b.clear) { await s.delete(`cart/${id}`); return json(200, { ok: true }); }

  const lines = (Array.isArray(b.lines) ? b.lines : []).slice(0, 20).map((l) => ({
    id: String(l.id || "").replace(/[^a-z0-9-]/g, "").slice(0, 80),
    qty: Math.max(1, Math.min(10, Number.parseInt(l.qty, 10) || 1)),
    plan: l.plan === "sub" ? "sub" : "once",
  })).filter((l) => l.id);
  if (!lines.length) { await s.delete(`cart/${id}`); return json(200, { ok: true }); }

  const mail = String(b.email || "").trim().toLowerCase().slice(0, 200);
  const okMail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail) ? mail : "";
  const pushKey = await pushKeyFor(b.endpoint);
  if (!okMail && !pushKey) return json(200, { ok: true, saved: false });

  const prev = (await s.get(`cart/${id}`, { type: "json" })) || {};
  const sameCart = JSON.stringify(prev.lines) === JSON.stringify(lines);
  await s.setJSON(`cart/${id}`, {
    lines, email: okMail || prev.email || "", pushKey: pushKey || prev.pushKey || null,
    // A changed cart starts the 1h / 24h clock again.
    updatedAt: sameCart && prev.updatedAt ? prev.updatedAt : Date.now(),
    sent: sameCart ? prev.sent || {} : {},
  });
  return json(200, { ok: true, saved: true });
};
