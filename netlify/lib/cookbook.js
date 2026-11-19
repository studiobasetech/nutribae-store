/* Cookbook access tokens.
   A customer who added the free Wellness Made Sweet cookbook to a paid order
   gets a token tied to their Stripe checkout session. The token unlocks the
   PDF download and the full recipes in the app. It's signed, so it can't be
   made up, and needs no database.

   Set COOKBOOK_SECRET in .env / Netlify to any long random text. Until then a
   key derived from STRIPE_SECRET_KEY is used (changing that key would make old
   links stop working, so set COOKBOOK_SECRET before launch). */
const crypto = require("crypto");

function key() {
  if (process.env.COOKBOOK_SECRET) return process.env.COOKBOOK_SECRET;
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("COOKBOOK_SECRET is not set.");
  return crypto.createHash("sha256").update(`nutribae-cookbook:${process.env.STRIPE_SECRET_KEY}`).digest("hex");
}

const b64url = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const sign = (id) => b64url(crypto.createHmac("sha256", key()).update(`cookbook:${id}`).digest()).slice(0, 32);

function makeToken(sessionId) {
  return `${b64url(sessionId)}.${sign(sessionId)}`;
}

// Returns the checkout session id if the token is genuine, otherwise null.
function verifyToken(token) {
  if (typeof token !== "string" || token.length > 400 || !token.includes(".")) return null;
  const [idPart, sig] = token.split(".");
  let id;
  try { id = Buffer.from(idPart.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"); } catch { return null; }
  if (!/^cs_[A-Za-z0-9_]+$/.test(id)) return null;
  const good = sign(id);
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  return id;
}

function link(token) {
  const site = process.env.URL || "http://localhost:8888";
  return `${site}/cookbook.html?t=${encodeURIComponent(token)}`;
}

module.exports = { makeToken, verifyToken, link };
