/* ==========================================================================
   POST /api/push-send  (used by notify.html)
   Header: x-admin-key: <PUSH_ADMIN_KEY>
   Body: { title, body, url, test }  → sends to everyone who turned on
   "Deals & new flavors" (or only to the device in `test`).
   ========================================================================== */
const crypto = require("crypto");
const { store, all } = require("../lib/push-store");
const webpush = require("../lib/webpush");

function json(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(body) };
}
function sameText(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Use POST." });
  const admin = process.env.PUSH_ADMIN_KEY;
  if (!admin || admin.length < 12) return json(500, { error: "Set PUSH_ADMIN_KEY (12+ characters) in .env / Netlify first." });
  if (!sameText(event.headers["x-admin-key"] || "", admin)) return json(401, { error: "Wrong password." });
  let b;
  try { b = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "Bad request." }); }
  const title = String(b.title || "").trim().slice(0, 60);
  const text = String(b.body || "").trim().slice(0, 180);
  let url = String(b.url || "/").trim();
  if (!url.startsWith("/")) url = "/";
  if (!title || !text) return json(400, { error: "Add a title and a message." });

  const s = store(event);
  const subs = (await all(s)).filter((x) => x.prefs && x.prefs.deals);
  let sent = 0, removed = 0, failed = 0;
  for (const sub of subs) {
    try {
      const r = await webpush.send(sub.subscription, { title, body: text, url, tag: "news" });
      if (r.gone) { await s.delete(sub.key); removed++; } else if (r.ok) sent++; else failed++;
    } catch { failed++; }
  }
  return json(200, { devices: subs.length, sent, removed, failed });
};
