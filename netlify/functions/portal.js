/* /api/portal → Stripe's customer portal, where subscribers skip, change the
   card or cancel their Subscribe & Save (they log in with their email).
   Set STRIPE_PORTAL_LOGIN_URL: Stripe → Settings → Billing → Customer portal →
   turn on "Login link" and copy it (https://billing.stripe.com/p/login/...). */
exports.handler = async () => {
  const url = process.env.STRIPE_PORTAL_LOGIN_URL;
  const ok = typeof url === "string" && /^https:\/\/billing\.stripe\.com\//.test(url);
  return { statusCode: 302, headers: { Location: ok ? url : "/faq.html#subscriptions", "Cache-Control": "no-store" }, body: "" };
};
