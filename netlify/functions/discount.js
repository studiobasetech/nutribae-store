/* ==========================================================================
   GET /api/discount?code=SPIN10
   Checks a discount code against your Stripe promotion codes so the cart can
   show it before checkout. Create codes in Stripe → Product catalog →
   Coupons → add a promotion code (e.g. SPIN10). The real discount is applied
   by Stripe at checkout, so the cart's number is only a preview.
   The Stripe key needs Promotion Codes: Read and Coupons: Read.
   ========================================================================== */
const Stripe = require("stripe");

function json(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(body) };
}

async function findCode(stripe, code) {
  const list = await stripe.promotionCodes.list({ code, active: true, limit: 1, expand: ["data.promotion.coupon"] });
  const pc = list.data[0];
  if (!pc) return null;
  // Coupon location differs between API versions.
  let coupon = pc.coupon || pc.promotion?.coupon;
  if (typeof coupon === "string") coupon = await stripe.coupons.retrieve(coupon);
  if (!coupon || coupon.valid === false) return null;
  return { pc, coupon };
}

exports.handler = async (event) => {
  const code = String((event.queryStringParameters || {}).code || "").trim().toUpperCase();
  if (!/^[A-Z0-9_-]{2,40}$/.test(code)) return json(400, { valid: false, error: "Enter a valid code." });
  if (!process.env.STRIPE_SECRET_KEY) return json(500, { valid: false, error: "Discount codes aren't set up yet." });
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-10-28.endive" });
    const found = await findCode(stripe, code);
    if (!found) return json(404, { valid: false, error: "That code isn't valid or has expired." });
    const { pc, coupon } = found;
    return json(200, {
      valid: true,
      code: pc.code,
      percentOff: coupon.percent_off || null,
      amountOff: coupon.amount_off ? coupon.amount_off / 100 : null,
      minimum: pc.restrictions?.minimum_amount ? pc.restrictions.minimum_amount / 100 : null,
      firstOrderOnly: !!pc.restrictions?.first_time_transaction,
    });
  } catch (err) {
    console.error("Discount lookup error:", err.type || "", err.code || "", err.message);
    return json(502, { valid: false, error: "We couldn't check that code right now. You can also enter it on the payment page." });
  }
};

module.exports.findCode = findCode;
