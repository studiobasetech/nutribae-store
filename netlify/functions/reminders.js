/* ==========================================================================
   Scheduled every hour (netlify.toml).
   1. Cart reminders: 1 hour and 24 hours after a cart stops changing
      (push notification and/or email). Stops as soon as they buy.
   2. Checkout reminders: Stripe checkout pages that expired unpaid, for
      shoppers who ticked "email me" on the Stripe page (sent once).
   3. Review reminders: a push 10 days after an order.
   Honest messages only: no fake countdowns or "only 2 left".
   ========================================================================== */
const R = require("../lib/reminders");
const pushStore = require("../lib/push-store");
const webpush = require("../lib/webpush");
const email = require("../lib/email");
const shopify = require("../lib/shopify");
const local = require("../../public/js/products.js");

const HOUR = 3600000;
const STEPS = [
  { key: "h1", after: 1 * HOUR, title: "You left something sweet 💗", subject: "Your NutriBae cart is waiting 💗" },
  { key: "h24", after: 24 * HOUR, title: "Still thinking about it, bae? 🍰", subject: "Still thinking about it? Your cart is saved" },
];
const FORGET_AFTER = 3 * 24 * HOUR;

const site = () => process.env.URL || "http://localhost:8888";
const cartLink = (lines) => `${site()}/shop.html?cart=${encodeURIComponent(lines.map((l) => `${l.id}:${l.qty}:${l.plan}`).join(","))}`;

async function run(event) {
  const s = R.db(event);
  let ps = null;
  try { ps = pushStore.store(event); } catch { /* push not set up */ }

  let catalog = local.PRODUCTS;
  if (shopify.isConfigured()) { try { catalog = await shopify.fetchProducts(); } catch (err) { console.error("catalog:", err.message); } }
  const itemOf = (id) => local.resolveItem(id, catalog);

  async function sendPush(pushKey, msg) {
    if (!pushKey || !ps || !process.env.VAPID_PUBLIC_KEY) return false;
    const sub = await ps.get(pushKey, { type: "json" });
    if (!sub || !sub.subscription) return false;
    try {
      const r = await webpush.send(sub.subscription, msg);
      if (r.gone) await ps.delete(pushKey);
      return r.ok;
    } catch (err) { console.error("push:", err.message); return false; }
  }
  async function unsubscribed(addr) { return addr ? !!(await s.get(`unsub/${email.hash(addr)}`)) : true; }

  const stats = { carts: 0, pushes: 0, emails: 0, reviews: 0 };
  const { blobs } = await s.list();
  const now = Date.now();

  for (const { key } of blobs) {
    /* ---- carts + expired checkouts ---- */
    if (key.startsWith("cart/")) {
      const c = await s.get(key, { type: "json" });
      if (!c) continue;
      stats.carts++;
      const age = now - (c.updatedAt || now);
      if (age > FORGET_AFTER) { await s.delete(key); continue; }
      const step = [...STEPS].reverse().find((st) => age >= st.after && !(c.sent || {})[st.key]);
      if (!step) continue;
      // Skip the 1h step if we're already past 24h (don't send both at once).
      STEPS.forEach((st) => { if (st.after <= step.after) c.sent = { ...(c.sent || {}), [st.key]: now }; });

      const items = (c.lines || []).map((l) => ({ item: itemOf(l.id), qty: l.qty })).filter((x) => x.item);
      const names = c.names || items.map((x) => x.item.shortName || x.item.name);
      if (!names.length && !c.recovery) { await s.setJSON(key, c); continue; }
      const first = names[0] || "your favorites";
      const more = names.length > 1 ? ` and ${names.length - 1} more` : "";
      const link = c.recovery || cartLink(c.lines || []);
      const body = step.key === "h1"
        ? `${first}${more} is still in your cart. Free shipping on all USA orders.`
        : `Your cart is saved: ${first}${more}. Free shipping, and Subscribe & save 15% on every delivery.`;

      if (await sendPush(c.pushKey, { title: step.title, body, url: link.replace(site(), ""), tag: "cart" })) stats.pushes++;
      if (c.email && !(await unsubscribed(c.email))) {
        const ok = await email.send({
          to: c.email,
          subject: step.subject,
          html: email.layout({
            title: step.title,
            intro: step.key === "h1" ? "We saved your cart for you. Ready when you are, bae." : "Your favorites are still waiting. Every order ships free in the USA.",
            items: items.length ? items.map((x) => ({ name: x.item.shortName || x.item.name, image: x.item.image && x.item.image.startsWith("http") ? x.item.image : null, qty: x.qty })) : names.map((n) => ({ name: n })),
            button: "Finish my order",
            buttonUrl: link,
            note: "Tip: switch to Subscribe &amp; save 15% in your cart and never run out.",
            unsubUrl: `${site()}/api/cart-reminder?unsub=${email.unsubToken(c.email)}`,
          }),
          text: `${body}\n\nFinish your order: ${link}`,
        });
        if (ok) stats.emails++;
      }
      await s.setJSON(key, c);
      continue;
    }

    /* ---- review reminders ---- */
    if (key.startsWith("review/")) {
      const r = await s.get(key, { type: "json" });
      if (!r) continue;
      if (r.sent || now < r.due) { if (now - r.due > 7 * 24 * HOUR) await s.delete(key); continue; }
      const it = r.items[0];
      const ok = await sendPush(r.pushKey, {
        title: `How’s your ${it.name.replace(/ — .*/, "")}? ⭐`,
        body: "Share a quick review (photos welcome!) and earn stars in Play To Win.",
        url: `/product.html?handle=${encodeURIComponent(it.handle)}#write-review`,
        tag: "review",
      });
      r.sent = true;
      await s.setJSON(key, r);
      if (ok) stats.reviews++;
    }
  }
  console.log("reminders", JSON.stringify(stats));
  return stats;
}

exports.handler = async (event) => ({ statusCode: 200, body: JSON.stringify(await run(event)) });
