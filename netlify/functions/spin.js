/* ==========================================================================
   POST /api/spin
   { firstName, email, birthday: { mm, dd, yyyy }, tz, kind: "first"|"birthday" }

   Rules (checked here, not in the browser):
   - Everyone gets ONE spin when they sign up with their info.
   - Then one more spin on their birthday each year (the birthday they gave
     when they signed up; it can't be changed later, and they must have signed
     up at least 7 days before). Birthday spins always win.
   Bonus spins (need the device's spin token, given after any spin or order):
   - after each paid order: one spin that always wins a code for the NEXT order
     (POST { claimOrder: "cs_..." } from the thank-you page adds it);
   - once a week for people with app notifications turned on.
   GET  /api/spin?status=1&endpoint=...  (x-spin-token) → what's available.
   POST { kind: "bonus", token, tz, endpoint } → uses the order spin first,
        then the weekly one.
   Winning creates a unique, one-time Stripe promotion code (e.g. BAE10-K7Q2M)
   that expires in 30 days. Entries are kept in Netlify Blobs ("spin-entries").
   The Stripe key needs Coupons: Write and Promotion Codes: Write.
   ========================================================================== */
const crypto = require("crypto");
const Stripe = require("stripe");
const { getStore, connectLambda } = require("@netlify/blobs");
const { SLICES, CODE_DAYS, pick } = require("../lib/spin-config");
const push = require("../lib/push-store");

/* ---------- device token (proves this browser spun with this email) ---------- */
function secret() { return process.env.BAKERY_SECRET || process.env.COOKBOOK_SECRET || ""; }
const tokenFor = (key) => { const sec = secret(); return sec ? `${key}.${crypto.createHmac("sha256", sec).update(`spin:${key}`).digest("base64url").slice(0, 24)}` : null; };
function keyFromToken(t) {
  const [key, sig] = String(t || "").split(".");
  const good = key && tokenFor(key);
  if (!good || !sig) return null;
  const g = good.split(".")[1];
  return sig.length === g.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(g)) ? key : null;
}
// Week number in the shopper's time zone (weekly spin resets on Monday).
function weekKey(today) {
  const d = new Date(Date.UTC(today.y, today.m - 1, today.d));
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10); // the Monday
}
function nextMonday(today) {
  const d = new Date(Date.UTC(today.y, today.m - 1, today.d));
  d.setUTCDate(d.getUTCDate() + (7 - ((d.getUTCDay() + 6) % 7)));
  return d.toISOString().slice(0, 10);
}
async function hasPush(event, endpoint) {
  if (typeof endpoint !== "string" || !/^https:\/\//.test(endpoint)) return false;
  try { return !!(await push.store(event).get(push.keyFor(endpoint))); } catch { return false; }
}
const WEEKLY_NO_DISCOUNT_DAYS = 30;

function json(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(body) };
}
// The birthday spin unlocks for people who signed up at least this many days
// before their birthday (stops "my birthday is today" sign-ups for a 2nd spin).
const BIRTHDAY_MIN_DAYS = 7;
const emailKey = (email) => crypto.createHash("sha256").update(email).digest("hex").slice(0, 40);

function localToday(tz) {
  let zone = "America/New_York";
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); zone = tz; } catch { /* default */ }
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day) };
}
function validBirthday(b) {
  if (!b) return null;
  const mm = Number.parseInt(b.mm, 10), dd = Number.parseInt(b.dd, 10);
  const yyyy = b.yyyy ? Number.parseInt(b.yyyy, 10) : null;
  if (!(mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31)) return null;
  const test = new Date(Date.UTC(yyyy || 2000, mm - 1, dd)); // 2000 is a leap year, so Feb 29 is allowed
  if (test.getUTCMonth() !== mm - 1) return null;
  if (yyyy && (yyyy < 1900 || yyyy > new Date().getUTCFullYear())) return null;
  return { mm, dd, yyyy };
}
function isBirthdayToday(bday, today) {
  if (!bday) return false;
  if (bday.mm === today.m && bday.dd === today.d) return true;
  // Feb 29 birthdays celebrate on Feb 28 in non-leap years
  const leap = (today.y % 4 === 0 && today.y % 100 !== 0) || today.y % 400 === 0;
  return bday.mm === 2 && bday.dd === 29 && !leap && today.m === 2 && today.d === 28;
}

async function couponFor(stripe, percent) {
  const id = `nutribae-spin-${percent}`;
  try { return await stripe.coupons.retrieve(id); } catch (err) { if (err.statusCode !== 404 && err.code !== "resource_missing") throw err; }
  return stripe.coupons.create({ id, percent_off: percent, duration: "once", name: `Spin to win ${percent}% off` });
}
async function makeCode(stripe, percent, email, kind) {
  const coupon = await couponFor(stripe, percent);
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const code = `BAE${percent}-` + Array.from(crypto.randomBytes(5), (b) => abc[b % abc.length]).join("");
  const base = {
    code,
    max_redemptions: 1,
    expires_at: Math.floor(Date.now() / 1000) + CODE_DAYS * 86400,
    metadata: { source: "spin-to-win", kind, email_hash: emailKey(email) },
  };
  try {
    await stripe.promotionCodes.create({ ...base, promotion: { type: "coupon", coupon: coupon.id } }); // current API
  } catch (err) {
    if (!/promotion/i.test(err.message || "")) throw err;
    await stripe.promotionCodes.create({ ...base, coupon: coupon.id }); // older API versions
  }
  return code;
}

// Every code this person won on the wheel, newest first.
function couponsOf(entry) {
  const all = [...(entry.wins || []), entry.lastWin, entry.firstSpin, entry.lastResult].filter((r) => r && r.code);
  const seen = new Set();
  return all.filter((r) => (seen.has(r.code) ? false : seen.add(r.code)))
    .sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 12)
    .map((r) => ({ code: r.code, label: r.label, percent: r.percent, kind: r.kind, at: r.at || null, expiresAt: r.at && !/^SPIN/.test(r.code) ? r.at + CODE_DAYS * 86400000 : null }));
}

async function bonusState(event, entry, today, endpoint) {
  const credits = entry.orderCredits || 0;
  const pushOn = await hasPush(event, endpoint);
  const weeklyFree = pushOn && entry.lastWeekly !== weekKey(today);
  return {
    available: credits > 0 ? "order" : weeklyFree ? "weekly" : null,
    orderCredits: credits,
    pushOn,
    nextWeekly: pushOn && !weeklyFree ? nextMonday(today) : null,
    lastWin: entry.lastWin || (entry.lastResult && entry.lastResult.code ? entry.lastResult : null),
    firstName: entry.firstName || "",
    birthday: entry.birthday ? { mm: entry.birthday.mm, dd: entry.birthday.dd } : null,
    coupons: couponsOf(entry),
  };
}

exports.handler = async (event) => {
  const qs = event.queryStringParameters || {};
  if (event.httpMethod === "GET" && qs.status) {
    const key = keyFromToken(event.headers["x-spin-token"]);
    if (!key) return json(401, { error: "No spin profile on this device." });
    try { connectLambda(event); } catch { /* local dev */ }
    const entry = await getStore("spin-entries").get(key, { type: "json" });
    if (!entry) return json(404, { error: "Not found." });
    return json(200, await bonusState(event, entry, localToday(qs.tz), qs.endpoint));
  }
  if (event.httpMethod !== "POST") return json(405, { error: "Use POST." });
  let b;
  try { b = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "Bad request." }); }

  /* ---------- an order earns a bonus spin (thank-you page) ---------- */
  if (b.claimOrder) {
    const sid = String(b.claimOrder).replace(/[^A-Za-z0-9_]/g, "").slice(0, 100);
    if (!sid.startsWith("cs_") || !process.env.STRIPE_SECRET_KEY) return json(200, { ok: false });
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-10-28.endive" });
      const session = await stripe.checkout.sessions.retrieve(sid);
      if (session.status !== "complete" || session.payment_status === "unpaid") return json(200, { ok: false });
      const mail = String(session.customer_details?.email || "").toLowerCase();
      if (!mail) return json(200, { ok: false });
      try { connectLambda(event); } catch { /* local dev */ }
      const st = getStore("spin-entries");
      const key = emailKey(mail);
      const entry = (await st.get(key, { type: "json" })) || {
        email: mail, firstName: String(session.customer_details?.name || "").split(" ")[0].slice(0, 60),
        birthday: null, createdAt: Date.now(), marketingConsent: session.consent?.promotions === "opt_in",
      };
      entry.orders = entry.orders || [];
      if (!entry.orders.includes(sid)) {
        entry.orders = [...entry.orders, sid].slice(-30);
        entry.orderCredits = (entry.orderCredits || 0) + 1;
        await st.setJSON(key, entry);
      }
      return json(200, { ok: true, token: tokenFor(key), orderCredits: entry.orderCredits || 0, email: mail, firstName: entry.firstName || "" });
    } catch (err) {
      console.error("spin claimOrder:", err.message);
      return json(200, { ok: false });
    }
  }

  /* ---------- add a birthday later (only if none was given) ---------- */
  if (b.setBirthday) {
    const key = keyFromToken(b.token);
    if (!key) return json(401, { error: "Spin once with your email first, bae 💗" });
    const bday = validBirthday(b.birthday);
    if (!bday) return json(400, { error: "Add a valid month and day." });
    try { connectLambda(event); } catch { /* local dev */ }
    const st = getStore("spin-entries");
    const entry = await st.get(key, { type: "json" });
    if (!entry) return json(404, { error: "Not found." });
    if (entry.birthday) return json(409, { error: "Your birthday is already saved 🎂", birthday: { mm: entry.birthday.mm, dd: entry.birthday.dd } });
    entry.birthday = bday;
    entry.birthdaySetAt = Date.now();
    await st.setJSON(key, entry);
    return json(200, { ok: true, birthday: { mm: bday.mm, dd: bday.dd } });
  }

  /* ---------- bonus spin: order credit first, then weekly ---------- */
  if (b.kind === "bonus") {
    const key = keyFromToken(b.token);
    if (!key) return json(401, { error: "Spin once with your email first, bae 💗" });
    try { connectLambda(event); } catch { /* local dev */ }
    const st = getStore("spin-entries");
    const entry = await st.get(key, { type: "json" });
    if (!entry) return json(404, { error: "Spin once with your email first, bae 💗" });
    const today = localToday(b.tz);
    const state = await bonusState(event, entry, today, b.endpoint);
    if (!state.available) return json(409, { error: state.pushOn ? "No free spin right now. Your next weekly spin is on Monday 💗" : "No free spin right now. Turn on notifications for a free spin every week 💗", state });
    const kind = state.available;
    const recentWin = entry.lastWin && Date.now() - entry.lastWin.at < WEEKLY_NO_DISCOUNT_DAYS * 86400000;
    const index = pick(kind, Math.random, { noDiscount: kind === "weekly" && recentWin });
    const slice = SLICES[index];
    // Reserve the spin before making the code, so a double tap can't spin twice.
    if (kind === "order") entry.orderCredits = Math.max(0, (entry.orderCredits || 0) - 1);
    else entry.lastWeekly = weekKey(today);
    await st.setJSON(key, entry);
    let code = null;
    if (slice.percent > 0) {
      try {
        if (!process.env.STRIPE_SECRET_KEY) throw new Error("no key");
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-10-28.endive" });
        code = await makeCode(stripe, slice.percent, entry.email, kind);
      } catch (err) {
        console.error("Spin code error:", err.message);
        code = `SPIN${slice.percent}`;
      }
    }
    const result = { index, label: slice.label, percent: slice.percent, code, kind, at: Date.now() };
    entry.lastResult = result;
    if (code) { entry.lastWin = result; entry.wins = [...(entry.wins || []), result].slice(-20); }
    await st.setJSON(key, entry);
    return json(200, { ...result, token: tokenFor(key), state: await bonusState(event, entry, today, b.endpoint) });
  }
  const firstName = String(b.firstName || "").trim().slice(0, 60);
  const email = String(b.email || "").trim().toLowerCase().slice(0, 200);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(400, { error: "Add a valid email to spin." });

  try { connectLambda(event); } catch { /* local dev */ }
  const store = getStore("spin-entries");
  const key = emailKey(email);
  const entry = await store.get(key, { type: "json" });
  const today = localToday(b.tz);

  let kind;
  if (!entry || !entry.firstSpin) { // new, or only known from an order so far
    if (!firstName) return json(400, { error: "Add your first name to spin." });
    kind = "first";
  } else if (isBirthdayToday(entry.birthday, today) && entry.lastBirthdaySpin !== today.y && Date.now() - (entry.birthdaySetAt || entry.createdAt) >= BIRTHDAY_MIN_DAYS * 86400000) {
    kind = "birthday";
  } else {
    return json(409, {
      error: entry.birthday
        ? "You’ve already spun, bae 💗 Come back on your birthday for another spin!"
        : "You’ve already spun with this email, bae 💗",
      result: entry.lastResult || null,
      birthday: entry.birthday ? { mm: entry.birthday.mm, dd: entry.birthday.dd } : null,
    });
  }

  const index = pick(kind);
  const slice = SLICES[index];
  let code = null, codeError = null;
  if (slice.percent > 0) {
    if (process.env.STRIPE_SECRET_KEY) {
      try {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-10-28.endive" });
        code = await makeCode(stripe, slice.percent, email, kind);
      } catch (err) {
        console.error("Spin code error:", err.type || "", err.code || "", err.message);
        codeError = true;
      }
    } else {
      codeError = true;
    }
    if (codeError) code = `SPIN${slice.percent}`; // shared fallback code (create it in Stripe) until the key works
  }

  const result = { index, label: slice.label, percent: slice.percent, code, kind, at: Date.now() };
  const known = entry && entry.firstSpin;
  const birthday = known ? entry.birthday : validBirthday(b.birthday);
  await store.setJSON(key, {
    email,
    firstName: known && entry.firstName ? entry.firstName : firstName || (entry && entry.firstName) || "",
    birthday,
    createdAt: entry ? entry.createdAt : Date.now(),
    firstSpin: known ? entry.firstSpin : result,
    lastBirthdaySpin: kind === "birthday" ? today.y : entry ? entry.lastBirthdaySpin || null : null,
    lastResult: result,
    lastWin: code ? result : entry ? entry.lastWin || null : null,
    wins: [...((entry && entry.wins) || []), ...(code ? [result] : [])].slice(-20),
    orders: entry ? entry.orders || [] : [],
    orderCredits: entry ? entry.orderCredits || 0 : 0,
    lastWeekly: entry ? entry.lastWeekly || null : null,
    birthdaySetAt: entry ? entry.birthdaySetAt || null : null,
    marketingConsent: true, // the popup says they're signing up for emails
  });
  return json(200, { ...result, token: tokenFor(key), birthday: birthday ? { mm: birthday.mm, dd: birthday.dd } : null });
};
