/* Stripe coupons + unique one-time promotion codes (used by the Bakery).
   The Stripe key needs Coupons: Write and Promotion Codes: Write. */
const crypto = require("crypto");
const Stripe = require("stripe");

function client() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-10-28.endive" });
}

async function ensureCoupon(stripe, id, params) {
  try { return await stripe.coupons.retrieve(id); } catch (err) { if (err.statusCode !== 404 && err.code !== "resource_missing") throw err; }
  return stripe.coupons.create({ id, duration: "once", ...params });
}

function randomCode(prefix) {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return `${prefix}-` + Array.from(crypto.randomBytes(5), (b) => abc[b % abc.length]).join("");
}

// Returns the code string, or null if Stripe isn't set up / fails.
async function createCode({ couponId, coupon, prefix, days = 60, restrictions = {}, metadata = {} }) {
  const stripe = client();
  if (!stripe) return null;
  try {
    const c = await ensureCoupon(stripe, couponId, coupon);
    const code = randomCode(prefix);
    const base = { code, max_redemptions: 1, expires_at: Math.floor(Date.now() / 1000) + days * 86400, metadata, ...(Object.keys(restrictions).length ? { restrictions } : {}) };
    try {
      await stripe.promotionCodes.create({ ...base, promotion: { type: "coupon", coupon: c.id } });
    } catch (err) {
      if (!/promotion/i.test(err.message || "")) throw err;
      await stripe.promotionCodes.create({ ...base, coupon: c.id });
    }
    return code;
  } catch (err) {
    console.error("Promo code error:", err.type || "", err.code || "", err.message);
    return null;
  }
}

module.exports = { createCode };
