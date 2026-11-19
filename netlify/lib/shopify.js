/* ==========================================================================
   Shopify connection (server side only).
   Shopify runs in the background as the "warehouse": it holds the products
   Supliful publishes, and receives orders so Supliful fulfills them.
   Customers never see Shopify.

   Needs these environment variables (in .env locally, in Netlify for live):
     SHOPIFY_SHOP           store subdomain, e.g. xve3b8-xs
     SHOPIFY_CLIENT_ID      from Dev Dashboard → NutriBae Website → Settings
     SHOPIFY_CLIENT_SECRET  same page (keep it secret, never in code)
   ========================================================================== */

const API_VERSION = "2026-10";

let cachedToken = null; // { token, expiresAt }

function isConfigured() {
  return Boolean(process.env.SHOPIFY_SHOP && process.env.SHOPIFY_CLIENT_ID && process.env.SHOPIFY_CLIENT_SECRET);
}

function shopHost() {
  return `${process.env.SHOPIFY_SHOP}.myshopify.com`;
}

// Tokens last 24 hours. We cache one and get a fresh one a few minutes early.
async function getToken() {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.token;
  const res = await fetch(`https://${shopHost()}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.SHOPIFY_CLIENT_ID,
      client_secret: process.env.SHOPIFY_CLIENT_SECRET,
    }),
  });
  if (!res.ok) throw new Error(`Shopify token request failed (${res.status})`);
  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + Math.max(60, (data.expires_in || 86399) - 300) * 1000,
  };
  return cachedToken.token;
}

async function gql(query, variables = {}) {
  const token = await getToken();
  const res = await fetch(`https://${shopHost()}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query, variables }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.errors) {
    const msg = data.errors ? JSON.stringify(data.errors).slice(0, 500) : `HTTP ${res.status}`;
    throw new Error(`Shopify API error: ${msg}`);
  }
  return data.data;
}

/* ---------- Products ---------- */

const PRODUCTS_QUERY = `
  query Products($cursor: String) {
    products(first: 50, after: $cursor, query: "status:active") {
      pageInfo { hasNextPage endCursor }
      nodes {
        handle
        legacyResourceId
        title
        productType
        description
        descriptionHtml
        featuredMedia { preview { image { url altText } } }
        images(first: 12) { nodes { url altText } }
        variants(first: 20) {
          nodes { id title price sku availableForSale }
        }
      }
    }
  }`;

// Returns products in the same shape the website already uses.
async function fetchProducts() {
  const out = [];
  let cursor = null;
  do {
    const data = await gql(PRODUCTS_QUERY, { cursor });
    for (const p of data.products.nodes) {
      const v = p.variants.nodes.find((x) => x.availableForSale) || p.variants.nodes[0];
      if (!v) continue;
      const img = p.featuredMedia?.preview?.image;
      out.push({
        id: p.handle,
        productId: p.legacyResourceId || null,
        name: p.title,
        shortName: p.title,
        category: p.productType || "",
        price: v.price != null ? Number(v.price) : null,
        variantId: v.id,
        sku: v.sku || "",
        available: Boolean(v.availableForSale),
        image: img?.url || null,
        imageAlt: img?.altText || p.title,
        images: (p.images?.nodes || []).map((i) => ({ url: i.url, alt: i.altText || p.title })),
        description: p.description || "",
        descriptionHtml: p.descriptionHtml || "",
      });
    }
    cursor = data.products.pageInfo.hasNextPage ? data.products.pageInfo.endCursor : null;
  } while (cursor);
  return out;
}

/* ---------- Orders ---------- */

async function findOrderByTag(tag) {
  const data = await gql(
    `query($q: String!) { orders(first: 1, query: $q) { nodes { id name } } }`,
    { q: `tag:'${tag}'` }
  );
  return data.orders.nodes[0] || null;
}

const ORDER_CREATE = `
  mutation OrderCreate($order: OrderCreateOrderInput!, $options: OrderCreateOptionsInput) {
    orderCreate(order: $order, options: $options) {
      order { id name }
      userErrors { field message }
    }
  }`;

// sendReceipt: Shopify emails its order confirmation (used for cookbook
// orders, so the confirmation can carry the download link).
async function createOrder(order, { sendReceipt = false } = {}) {
  const data = await gql(ORDER_CREATE, {
    order,
    options: { sendReceipt, sendFulfillmentReceipt: true },
  });
  const r = data.orderCreate;
  if (r.userErrors && r.userErrors.length) {
    throw new Error(`Shopify orderCreate: ${JSON.stringify(r.userErrors).slice(0, 500)}`);
  }
  return r.order;
}

/* ---------- Add a paid item to an existing order (post-checkout add-on) ----------
   Needs the Shopify app scopes write_orders and write_order_edits. */
async function addPaidItem(orderId, { variantId, price, currency = "USD", note = "" }) {
  const check = (r, step) => { if (r.userErrors && r.userErrors.length) throw new Error(`Shopify ${step}: ${JSON.stringify(r.userErrors).slice(0, 300)}`); return r; };
  const begin = check((await gql(`mutation($id: ID!) { orderEditBegin(id: $id) { calculatedOrder { id } userErrors { field message } } }`, { id: orderId })).orderEditBegin, "orderEditBegin");
  const calcId = begin.calculatedOrder.id;
  const added = check((await gql(`mutation($id: ID!, $v: ID!) { orderEditAddVariant(id: $id, variantId: $v, quantity: 1, allowDuplicates: true) { calculatedLineItem { id originalUnitPriceSet { shopMoney { amount } } } userErrors { field message } } }`, { id: calcId, v: variantId })).orderEditAddVariant, "orderEditAddVariant");
  const li = added.calculatedLineItem;
  const full = Number(li.originalUnitPriceSet?.shopMoney?.amount || 0);
  const off = Math.max(0, Math.round((full - price) * 100) / 100);
  if (off > 0) {
    check((await gql(`mutation($id: ID!, $li: ID!, $d: OrderEditAppliedDiscountInput!) { orderEditAddLineItemDiscount(id: $id, lineItemId: $li, discount: $d) { userErrors { field message } } }`,
      { id: calcId, li: li.id, d: { fixedValue: { amount: off.toFixed(2), currencyCode: currency }, description: "Add-on offer" } })).orderEditAddLineItemDiscount, "orderEditAddLineItemDiscount");
  }
  check((await gql(`mutation($id: ID!, $n: String) { orderEditCommit(id: $id, notifyCustomer: false, staffNote: $n) { order { id } userErrors { field message } } }`, { id: calcId, n: note })).orderEditCommit, "orderEditCommit");
  // It was paid on Stripe: mark the new balance as paid.
  try {
    check((await gql(`mutation($input: OrderMarkAsPaidInput!) { orderMarkAsPaid(input: $input) { userErrors { field message } } }`, { input: { id: orderId } })).orderMarkAsPaid, "orderMarkAsPaid");
  } catch (err) { console.error(err.message); }
}

// Did this email buy this product? (used to only accept reviews from buyers)
async function boughtProduct(email, handle) {
  const data = await gql(
    `query($q: String!) { orders(first: 30, query: $q, sortKey: CREATED_AT, reverse: true) { nodes { id lineItems(first: 30) { nodes { product { handle } } } } } }`,
    { q: `email:"${String(email).replace(/"/g, "")}"` }
  );
  return data.orders.nodes.some((o) => o.lineItems.nodes.some((li) => li.product && li.product.handle === handle));
}

module.exports = { isConfigured, gql, fetchProducts, findOrderByTag, createOrder, addPaidItem, boughtProduct };
