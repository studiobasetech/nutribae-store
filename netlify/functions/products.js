/* ==========================================================================
   GET /api/products
   Reads the products from Shopify (the ones Supliful published there) and
   returns them to the website and the app. Cached for 5 minutes so the site
   stays fast. If Shopify isn't connected yet, the site falls back to
   public/js/products.js.
   ========================================================================== */

const shopify = require("../lib/shopify");

exports.handler = async () => {
  if (!shopify.isConfigured()) {
    return { statusCode: 503, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "Shopify isn't connected yet." }) };
  }
  try {
    const products = await shopify.fetchProducts();
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60, s-maxage=300",
      },
      body: JSON.stringify({ products }),
    };
  } catch (err) {
    console.error("Products error:", err.message);
    return { statusCode: 502, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "Products are unavailable right now." }) };
  }
};
