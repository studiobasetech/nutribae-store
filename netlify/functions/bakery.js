/* ==========================================================================
   /api/bakery?a=<action>   (NutriBae Bakery game, referrals and rewards)

   POST a=join      { firstName, email, ref?, tz }   → { token, state, friendCode? }
   GET  a=me        (x-bakery-token)                 → { state }
   POST a=checkin   daily +5 sprinkles
   POST a=play      → { ticket }   starts a round (uses one play)
   POST a=score     { ticket, score } → sprinkles earned (capped per day)
   POST a=event     { prize }      starts the 7-day "Bake your free treat"
   POST a=claim     { option, address? } → free treat (next order, or ships now)
   POST a=redeem    { tier }       sprinkles → one-time Stripe coupon
   ========================================================================== */
const B = require("../lib/bakery");
const { createCode } = require("../lib/promo");
const shopify = require("../lib/shopify");

function json(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(body) };
}
const today = (p, tz) => B.dayKey(tz || p.tz);
function dayOf(p, tz) {
  p.days = p.days || {};
  const k = today(p, tz);
  p.days[k] = p.days[k] || { plays: 0, game: 0, checkin: false, nonces: [] };
  // keep only the last 14 days
  Object.keys(p.days).sort().slice(0, -14).forEach((old) => delete p.days[old]);
  return p.days[k];
}

async function load(s, id) { return id ? s.get(`p/${id}`, { type: "json" }) : null; }
async function save(s, p) { await s.setJSON(`p/${p.id}`, p); }

exports.handler = async (event) => {
  const a = (event.queryStringParameters || {}).a;
  let body = {};
  if (event.httpMethod === "POST") { try { body = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "Bad request." }); } }
  const tz = String(body.tz || (event.queryStringParameters || {}).tz || "").slice(0, 60);
  let s;
  try { s = B.db(event); } catch (err) { return json(500, { error: err.message }); }

  /* ---------- join (open your bakery) ---------- */
  if (a === "join") {
    // Name and email are optional: the page opens the bakery right away, using
    // what we already know (e.g. from the Spin to win sign-up) when we have it.
    const firstName = String(body.firstName || "").trim().slice(0, 40);
    let email = String(body.email || "").trim().toLowerCase().slice(0, 200);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) email = "";
    // An email can belong to one bakery only; a second device starts as a guest.
    if (email && (await s.get(`e/${B.hash(email)}`))) email = "";
    const eh = email ? B.hash(email) : null;

    const id = B.rid(14);
    let code;
    do { code = B.rid(6).toUpperCase(); } while (await s.get(`c/${code}`));
    const p = { id, email: email || null, emailHash: eh, firstName: firstName || "bae", code, tz, createdAt: Date.now(), sprinkles: 0, friends: [], friendOrders: [], claims: [], coupons: [] };

    // Joined from a friend's link: count it for them, and give this new friend 15% off.
    const ref = String(body.ref || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    if (ref) {
      const refId = await s.get(`c/${ref}`);
      const referrer = await load(s, refId);
      if (referrer && (!eh || referrer.emailHash !== eh) && body.deviceNew !== false) {
        p.referredBy = ref;
        referrer.friends = referrer.friends || [];
        referrer.friends.push({ emailHash: eh, firstName: firstName || "a friend", at: Date.now() });
        referrer.sprinkles = (referrer.sprinkles || 0) + B.FRIEND_JOIN_SPRINKLES;
        await save(s, referrer);
        p.friendCode = (await createCode({
          couponId: `nutribae-friend-${B.FRIEND_PERCENT}`, coupon: { percent_off: B.FRIEND_PERCENT, name: `Friend ${B.FRIEND_PERCENT}% off first order` },
          prefix: "FRIEND", days: 30, restrictions: { first_time_transaction: true }, metadata: { source: "bakery-referral", ref },
        })) || `FRIEND${B.FRIEND_PERCENT}`;
      }
    }
    if (eh) await s.set(`e/${eh}`, id);
    await s.set(`c/${code}`, id);
    await save(s, p);
    return json(200, { token: B.tokenFor(id), state: B.publicState(p, tz) });
  }

  /* ---------- everything else needs the player token ---------- */
  const id = B.playerIdFrom(event.headers["x-bakery-token"]);
  const p = await load(s, id);
  if (!p) return json(401, { error: "Start playing first." });
  if (tz) p.tz = tz;

  if (a === "me") return json(200, { state: B.publicState(p, tz) });

  if (a === "checkin") {
    const d = dayOf(p, tz);
    if (!d.checkin) { d.checkin = true; p.sprinkles = (p.sprinkles || 0) + B.CHECKIN_SPRINKLES; await save(s, p); }
    return json(200, { state: B.publicState(p, tz), earned: B.CHECKIN_SPRINKLES });
  }

  if (a === "play") {
    const st = B.publicState(p, tz);
    if (st.playsLeft <= 0) return json(429, { error: "No plays left today. Invite a friend for an extra play, or come back tomorrow!" });
    const d = dayOf(p, tz);
    d.plays += 1;
    const nonce = B.rid(8);
    d.nonces.push(nonce);
    await save(s, p);
    return json(200, { ticket: B.ticketFor(p.id, Date.now(), nonce), state: B.publicState(p, tz) });
  }

  if (a === "score") {
    const t = B.readTicket(p.id, body.ticket);
    const d = dayOf(p, tz);
    if (!t || !d.nonces.includes(t.nonce)) return json(400, { error: "That round can’t be scored." });
    d.nonces = d.nonces.filter((n) => n !== t.nonce); // one score per round
    const secs = (Date.now() - t.startedAt) / 1000;
    const score = Math.max(0, Math.min(20000, Number.parseInt(body.score, 10) || 0));
    let earned = 0;
    if (secs >= 20 && secs <= 3600) {
      earned = Math.min(B.PLAY_MAX_POINTS, Math.round(score / 12), B.TEST_MODE ? Infinity : Math.max(0, B.DAILY_GAME_CAP - d.game)); // Sweet Merge: ~12 points = 1 sprinkle
      d.game += earned;
      p.sprinkles = (p.sprinkles || 0) + earned;
      p.best = Math.max(p.best || 0, score);
    }
    await save(s, p);
    return json(200, { earned, capped: d.game >= B.DAILY_GAME_CAP, state: B.publicState(p, tz) });
  }

  if (a === "event") {
    const prize = B.PRIZES[body.prize];
    if (!prize) return json(400, { error: "Pick a product to play for." });
    const cur = B.progress(p);
    if (cur && !cur.expired && !cur.claimed && Date.now() <= cur.endsAt + B.CLAIM_GRACE_DAYS * 86400000) return json(409, { error: "You’re already playing for a product!" });
    const cd = B.publicState(p, tz).cooldowns[body.prize];
    if (cd) return json(409, { error: `You won one of these recently. It’s back on ${new Date(cd).toLocaleDateString("en-US", { month: "short", day: "numeric" })}.` });
    p.event = { prize: body.prize, startedAt: Date.now(), endsAt: Date.now() + B.EVENT_DAYS * 86400000, claimed: false };
    await save(s, p);
    return json(200, { state: B.publicState(p, tz) });
  }

  // Change the product you're playing for. Friends and orders already counted stay.
  if (a === "switch") {
    const prize = B.PRIZES[body.prize];
    const cur = B.progress(p);
    if (!prize) return json(400, { error: "Pick a product." });
    if (!cur || cur.claimed || cur.expired) return json(400, { error: "Start a new challenge instead." });
    if (B.publicState(p, tz).cooldowns[body.prize]) return json(409, { error: "You won one of these recently. Pick another product." });
    p.event.prize = body.prize;
    await save(s, p);
    return json(200, { state: B.publicState(p, tz) });
  }

  if (a === "claim") {
    const pr = B.progress(p);
    if (!pr || !pr.claimable) return json(400, { error: "This treat isn’t ready to claim yet." });
    const prize = B.PRIZES[pr.prize];
    const option = pr.prize; // one product per challenge
    let products = [];
    try { products = await shopify.fetchProducts(); } catch { /* handled below */ }
    const product = products.find((x) => x.id === option);
    if (!product || !product.variantId) return json(502, { error: "We couldn’t reach the shop. Try again in a minute." });

    if (prize.ship === "next-order") {
      p.pendingGift = { prize: pr.prize, handle: option, name: product.name, variantId: product.variantId, at: Date.now() };
    } else {
      const ad = body.address || {};
      const need = ["name", "line1", "city", "state", "zip", "phone", ...(p.email ? [] : ["email"])];
      if (need.some((k) => !String(ad[k] || "").trim())) return json(400, { error: "Add your full shipping address and phone." });
      if (!/^\d{5}(-\d{4})?$/.test(String(ad.zip).trim())) return json(400, { error: "We ship within the USA only. Check your ZIP code." });
      const [first, ...rest] = String(ad.name).trim().split(/\s+/);
      const addr = { firstName: first, lastName: rest.join(" ") || first, address1: String(ad.line1).trim(), address2: String(ad.line2 || "").trim(), city: String(ad.city).trim(), provinceCode: String(ad.state).trim().toUpperCase().slice(0, 2), countryCode: "US", zip: String(ad.zip).trim(), phone: String(ad.phone).trim() };
      try {
        const created = await shopify.createOrder({
          email: p.email || String(ad.email || "").trim(), phone: addr.phone, currency: "USD", financialStatus: "PAID",
          lineItems: [{ variantId: product.variantId, quantity: 1, priceSet: { shopMoney: { amount: "0.00", currencyCode: "USD" } } }],
          shippingAddress: addr, billingAddress: addr,
          shippingLines: [{ title: "Free shipping", priceSet: { shopMoney: { amount: "0.00", currencyCode: "USD" } } }],
          tags: ["website", "bakery-gift", `bakery-${p.code}`],
          note: `NutriBae Bakery free treat (${prize.name}) for player ${p.code}.`,
        });
        console.log("Bakery gift order:", created && created.name);
      } catch (err) {
        console.error("Bakery gift order error:", err.message);
        return json(502, { error: "We couldn’t place your free treat right now. Try again soon, or email us." });
      }
    }
    p.event.claimed = true;
    p.claims.push({ prize: pr.prize, option, at: Date.now(), ship: prize.ship });
    await save(s, p);
    return json(200, { state: B.publicState(p, tz), ship: prize.ship, name: product.name });
  }

  if (a === "redeem") {
    const tier = B.TIERS[body.tier];
    if (!tier) return json(400, { error: "Pick a reward." });
    if ((p.sprinkles || 0) < tier.cost) return json(400, { error: "Not enough stars yet. Keep playing!" });
    p.sprinkles -= tier.cost;
    await save(s, p); // take the sprinkles first so a double tap can't spend them twice
    const code = await createCode({
      couponId: `nutribae-sprinkles-${body.tier}`,
      coupon: tier.percentOff ? { percent_off: tier.percentOff, name: `Sprinkles: ${tier.label}` } : { amount_off: tier.amountOff, currency: "usd", name: `Sprinkles: ${tier.label}` },
      prefix: "SWEET", days: B.CODE_DAYS,
      restrictions: tier.minimum ? { minimum_amount: tier.minimum, minimum_amount_currency: "usd" } : {},
      metadata: { source: "bakery-sprinkles", player: p.code },
    });
    if (!code) {
      p.sprinkles += tier.cost; // give them back
      await save(s, p);
      return json(503, { error: "Coupons aren’t available right now. Your stars are safe, try again later." });
    }
    p.coupons = p.coupons || [];
    p.coupons.push({ code, label: tier.label, at: Date.now() });
    await save(s, p);
    return json(200, { code, label: tier.label, state: B.publicState(p, tz) });
  }

  return json(404, { error: "Unknown action." });
};
