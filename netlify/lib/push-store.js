/* Where notification subscriptions are kept: Netlify Blobs (free, built in).
   One entry per device: { subscription, prefs, tz, refills, createdAt }. */
const crypto = require("crypto");
const { getStore, connectLambda } = require("@netlify/blobs");

function store(event) {
  if (event) { try { connectLambda(event); } catch { /* local dev or already connected */ } }
  return getStore("push-subscriptions");
}
const keyFor = (endpoint) => crypto.createHash("sha256").update(String(endpoint)).digest("hex").slice(0, 40);

async function all(s) {
  const out = [];
  const { blobs } = await s.list();
  for (const b of blobs) {
    const v = await s.get(b.key, { type: "json" });
    if (v) out.push({ key: b.key, ...v });
  }
  return out;
}

module.exports = { store, keyFor, all };
