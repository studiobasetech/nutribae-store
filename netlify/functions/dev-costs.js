/* Local-only helper: product price vs. cost per item from Shopify, used to
   balance the game rewards. Only answers under `netlify dev`. */
const shopify = require("../lib/shopify");
exports.handler = async () => {
  if (process.env.NETLIFY_DEV !== "true") return { statusCode: 404, body: "Not found" };
  try {
    const d = await shopify.gql(`{ products(first: 30) { nodes { title handle variants(first: 3) { nodes { price inventoryItem { unitCost { amount } } } } } } }`);
    const rows = d.products.nodes.map((p) => ({ title: p.title, handle: p.handle, variants: p.variants.nodes.map((v) => ({ price: v.price, cost: v.inventoryItem && v.inventoryItem.unitCost ? v.inventoryItem.unitCost.amount : null })) }));
    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(rows) };
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ error: err.message.slice(0, 300) }) };
  }
};
