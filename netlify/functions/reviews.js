/* ==========================================================================
   GET /api/reviews?handle=<shopify product handle>&page=1
   Real customer reviews from Judge.me (the reviews app on your Shopify).
   Returns the rating summary (average, total, stars breakdown) and one page
   of reviews, newest first. Cached for 10 minutes.

   Needs JUDGEME_PRIVATE_TOKEN (Judge.me → Settings → Integrations →
   View API tokens → Private token) and SHOPIFY_SHOP. Server side only.
   ========================================================================== */

const shopify = require("../lib/shopify");

const API = "https://api.judge.me/api/v1";
const PER_PAGE = 10;
const MAX_FOR_SUMMARY = 1000; // reviews read to work out the average
const CACHE_MS = 10 * 60 * 1000;

const cache = new Map(); // handle -> { at, all }

function json(statusCode, body, maxAge = 0) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", ...(maxAge ? { "Cache-Control": `public, max-age=${maxAge}` } : {}) },
    body: JSON.stringify(body),
  };
}

function auth() {
  return `shop_domain=${encodeURIComponent(`${process.env.SHOPIFY_SHOP}.myshopify.com`)}&api_token=${encodeURIComponent(process.env.JUDGEME_PRIVATE_TOKEN)}`;
}

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Judge.me ${res.status}`);
  return res.json();
}

async function allReviewsFor(handle) {
  const hit = cache.get(handle);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.all;

  const prod = await getJson(`${API}/products/-1?${auth()}&handle=${encodeURIComponent(handle)}`);
  const productId = prod?.product?.id;
  if (!productId) return [];

  const pages = Math.ceil(MAX_FOR_SUMMARY / 100);
  const all = [];
  for (let page = 1; page <= pages; page++) {
    const data = await getJson(`${API}/reviews?${auth()}&product_id=${productId}&per_page=100&page=${page}`);
    all.push(...(data.reviews || []));
    if (!data.reviews || data.reviews.length < 100) break;
  }

  // Only published, visible reviews for this product.
  const clean = all
    .filter((r) => r.published !== false && r.hidden !== true && r.curated !== "spam")
    .filter((r) => !r.product_handle || r.product_handle === handle)
    .map((r) => ({
      id: r.id,
      rating: Number(r.rating) || 0,
      title: r.title || "",
      body: r.body || "",
      name: r.reviewer?.name || "Verified customer",
      verified: r.verified === "buyer" || r.verified === "verified-purchase" || r.verified === true,
      date: r.created_at,
      pictures: (r.pictures || []).map((p) => p.urls?.compact || p.urls?.original).filter(Boolean),
    }))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  cache.set(handle, { at: Date.now(), all: clean });
  return clean;
}

function summarize(all) {
  const total = all.length;
  const average = total ? all.reduce((s, r) => s + r.rating, 0) / total : 0;
  return { average: Math.round(average * 10) / 10, total };
}

// GET /api/reviews?summary=1 → rating + count for every product and overall.
async function storeSummary() {
  const products = await shopify.fetchProducts();
  const per = {};
  let sum = 0, total = 0;
  for (const p of products) {
    const all = await allReviewsFor(p.id);
    per[p.id] = summarize(all);
    sum += all.reduce((s, r) => s + r.rating, 0);
    total += all.length;
  }
  return { overall: { average: total ? Math.round((sum / total) * 10) / 10 : 0, total }, products: per };
}

/* ---------- Write a review (POST) ----------
   Only people who bought the product (checked on their Shopify orders by
   email) can post. Photos are saved in Netlify Blobs and sent to Judge.me,
   which publishes the review (with your moderation settings).
   A review earns stars in Play To Win no matter the rating: +20, or +50
   with a photo, once per product. */
const crypto = require("crypto");
const { getStore, connectLambda } = require("@netlify/blobs");
const bakery = require("../lib/bakery");
const REVIEW_STARS = { text: 20, photo: 50 };

function photos(event) {
  try { connectLambda(event); } catch { /* local dev */ }
  return getStore("review-photos");
}

async function writeReview(event) {
  let b;
  try { b = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "Bad request." }); }
  const handle = String(b.handle || "").trim();
  const rating = Number.parseInt(b.rating, 10);
  const name = String(b.name || "").trim().slice(0, 60);
  const email = String(b.email || "").trim().toLowerCase().slice(0, 200);
  const title = String(b.title || "").trim().slice(0, 120);
  const body = String(b.body || "").trim().slice(0, 3000);
  if (!/^[a-z0-9-]+$/.test(handle)) return json(400, { error: "Missing product." });
  if (!(rating >= 1 && rating <= 5)) return json(400, { error: "Tap the stars to rate it." });
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(400, { error: "Add your name and the email you ordered with." });
  if (body.length < 10) return json(400, { error: "Tell us a little more (at least a sentence)." });
  if (!process.env.JUDGEME_PRIVATE_TOKEN || !shopify.isConfigured()) return json(503, { error: "Reviews aren’t connected yet." });

  const eh = crypto.createHash("sha256").update(email).digest("hex").slice(0, 40);
  const st = photos(event);
  if (await st.get(`done/${eh}/${handle}`)) return json(409, { error: "You already reviewed this product. Thank you! 💗" });

  let bought = false;
  try { bought = await shopify.boughtProduct(email, handle); } catch (err) { console.error("review buyer check:", err.message); return json(502, { error: "We couldn’t check your order right now. Try again in a minute." }); }
  if (!bought) return json(403, { error: "We couldn’t find an order of this product with that email. Use the email from your order confirmation." });

  const products = await shopify.fetchProducts();
  const prod = products.find((p) => p.id === handle);
  if (!prod || !prod.productId) return json(400, { error: "Product not found." });

  // Photos: up to 3 JPEG/PNG/WebP data URLs, 2 MB each (resized in the browser).
  const site = process.env.URL || "";
  const urls = [];
  for (const d of (Array.isArray(b.photos) ? b.photos : []).slice(0, 3)) {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(d));
    if (!m) continue;
    const buf = Buffer.from(m[2], "base64");
    if (buf.length > 2 * 1024 * 1024) return json(413, { error: "A photo is too big. Try a smaller one." });
    const id = crypto.randomBytes(12).toString("hex");
    await st.set(`img/${id}`, buf, { metadata: { type: m[1] } });
    urls.push(`${site}/api/reviews?photo=${id}`);
  }

  const res = await fetch(`${API}/reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      shop_domain: `${process.env.SHOPIFY_SHOP}.myshopify.com`, platform: "shopify", api_token: process.env.JUDGEME_PRIVATE_TOKEN,
      id: Number(prod.productId), name, email, rating, title, body, ...(urls.length ? { picture_urls: urls } : {}),
    }),
  });
  if (!res.ok) { console.error("Judge.me create review:", res.status, (await res.text()).slice(0, 200)); return json(502, { error: "We couldn’t post your review right now. Try again soon." }); }
  await st.set(`done/${eh}/${handle}`, String(Date.now()));
  cache.delete(handle);

  // Stars reward in Play To Win (any rating).
  let earned = 0;
  try {
    const pid = bakery.playerIdFrom(String(b.bakeryToken || ""));
    if (pid) {
      const s = bakery.db(event);
      const player = await s.get(`p/${pid}`, { type: "json" });
      if (player) {
        player.reviewed = player.reviewed || {};
        if (!player.reviewed[handle]) {
          earned = urls.length ? REVIEW_STARS.photo : REVIEW_STARS.text;
          player.reviewed[handle] = Date.now();
          player.sprinkles = (player.sprinkles || 0) + earned;
          await s.setJSON(`p/${pid}`, player);
        }
      }
    }
  } catch (err) { console.error("review stars:", err.message); }
  return json(200, { ok: true, earned });
}

async function servePhoto(event, id) {
  if (!/^[a-f0-9]{24}$/.test(id)) return { statusCode: 404, body: "" };
  const st = photos(event);
  const got = await st.getWithMetadata(`img/${id}`, { type: "arrayBuffer" });
  if (!got) return { statusCode: 404, body: "" };
  return { statusCode: 200, headers: { "Content-Type": got.metadata?.type || "image/jpeg", "Cache-Control": "public, max-age=31536000, immutable" }, body: Buffer.from(got.data).toString("base64"), isBase64Encoded: true };
}

exports.handler = async (event) => {
  if (event.httpMethod === "POST") return writeReview(event);
  if (event.queryStringParameters?.photo) return servePhoto(event, String(event.queryStringParameters.photo));
  // GET /api/reviews?recent=1 → newest 4–5 star reviews across all products
  // (photos first) + the overall rating of ALL reviews, for the home page.
  if (event.queryStringParameters?.recent) {
    if (!process.env.JUDGEME_PRIVATE_TOKEN || !shopify.isConfigured()) return json(503, { error: "Reviews aren't connected yet." });
    try {
      const products = await shopify.fetchProducts();
      let all = [], sum = 0;
      for (const p of products) {
        const list = await allReviewsFor(p.id);
        sum += list.reduce((t, r) => t + r.rating, 0);
        all = all.concat(list.map((r) => ({ ...r, handle: p.id, product: p.name })));
      }
      const total = all.length;
      const picks = all
        .filter((r) => r.rating >= 4 && r.body.trim().length >= 20)
        .sort((a, b) => (b.pictures.length > 0) - (a.pictures.length > 0) || new Date(b.date) - new Date(a.date))
        .slice(0, 10)
        .map((r) => ({ name: r.name, rating: r.rating, title: r.title, body: r.body, verified: r.verified, picture: r.pictures[0] || null, handle: r.handle, product: r.product }));
      return json(200, { overall: { average: total ? Math.round((sum / total) * 10) / 10 : 0, total }, reviews: picks }, 300);
    } catch (err) {
      console.error("Recent reviews error:", err.message);
      return json(502, { error: "Reviews are unavailable right now." });
    }
  }
  if (event.queryStringParameters?.summary) {
    if (!process.env.JUDGEME_PRIVATE_TOKEN || !shopify.isConfigured()) return json(503, { error: "Reviews aren't connected yet." });
    try {
      return json(200, await storeSummary(), 300);
    } catch (err) {
      console.error("Reviews summary error:", err.message);
      return json(502, { error: "Reviews are unavailable right now." });
    }
  }
  const handle = String(event.queryStringParameters?.handle || "").trim();
  const page = Math.max(1, Number.parseInt(event.queryStringParameters?.page || "1", 10) || 1);
  if (!handle || !/^[a-z0-9-]+$/.test(handle)) return json(400, { error: "Missing product." });
  if (!process.env.JUDGEME_PRIVATE_TOKEN || !process.env.SHOPIFY_SHOP) {
    return json(503, { error: "Reviews aren't connected yet." });
  }
  try {
    const all = await allReviewsFor(handle);
    const total = all.length;
    const breakdown = [5, 4, 3, 2, 1].map((stars) => ({ stars, count: all.filter((r) => Math.round(r.rating) === stars).length }));
    const average = total ? all.reduce((s, r) => s + r.rating, 0) / total : 0;
    const start = (page - 1) * PER_PAGE;
    return json(200, {
      summary: { average: Math.round(average * 10) / 10, total, breakdown },
      reviews: all.slice(start, start + PER_PAGE),
      page,
      hasMore: start + PER_PAGE < total,
    }, 300);
  } catch (err) {
    console.error("Reviews error:", err.message);
    return json(502, { error: "Reviews are unavailable right now." });
  }
};
