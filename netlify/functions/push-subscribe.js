/* ==========================================================================
   /api/push
     GET                → { publicKey } so the browser can subscribe
     POST { subscription, prefs, tz, refills } → saves / updates this device
     DELETE { endpoint } → turns notifications off for this device
   ========================================================================== */
const { store, keyFor } = require("../lib/push-store");

function json(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(body) };
}
const okEndpoint = (u) => { try { const x = new URL(u); return x.protocol === "https:"; } catch { return false; } };

function cleanPrefs(p = {}) {
  const hour = Number.parseInt(p.hour, 10);
  return {
    daily: p.daily !== false,
    hour: Number.isInteger(hour) && hour >= 5 && hour <= 22 ? hour : 9,
    water: !!p.water,
    refill: p.refill !== false,
    deals: p.deals !== false,
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === "GET") {
    if (!process.env.VAPID_PUBLIC_KEY) return json(500, { error: "Notifications aren't set up yet." });
    return json(200, { publicKey: process.env.VAPID_PUBLIC_KEY });
  }
  let body;
  try { body = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "Bad request." }); }
  const s = store(event);

  if (event.httpMethod === "DELETE") {
    if (!okEndpoint(body.endpoint)) return json(400, { error: "Bad request." });
    await s.delete(keyFor(body.endpoint));
    return json(200, { ok: true });
  }

  if (event.httpMethod === "POST") {
    const sub = body.subscription || {};
    if (!okEndpoint(sub.endpoint) || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) return json(400, { error: "Bad subscription." });
    let tz = String(body.tz || "America/New_York").slice(0, 60);
    try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); } catch { tz = "America/New_York"; }
    const refills = (Array.isArray(body.refills) ? body.refills : []).slice(0, 8)
      .filter((r) => r && /^\d{4}-\d{2}-\d{2}$/.test(r.date))
      .map((r) => ({ name: String(r.name || "your NutriBae").slice(0, 80), date: r.date }));
    const key = keyFor(sub.endpoint);
    const prev = (await s.get(key, { type: "json" })) || {};
    await s.setJSON(key, {
      subscription: { endpoint: sub.endpoint, keys: { p256dh: String(sub.keys.p256dh), auth: String(sub.keys.auth) } },
      prefs: cleanPrefs(body.prefs),
      tz,
      refills,
      sent: prev.sent || {},
      createdAt: prev.createdAt || Date.now(),
      updatedAt: Date.now(),
    });
    return json(200, { ok: true });
  }
  return json(405, { error: "Method not allowed." });
};
