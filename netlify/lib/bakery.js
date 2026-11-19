/* ==========================================================================
   NutriBae Bakery — rules, storage and helpers (server side).
   Everything that has value (sprinkles, plays, friends, prizes, codes) is
   decided here, never in the browser.

   Costs used to balance the prizes (Shopify cost per item, Nov 2026):
   Protein $27.75 · Energy $15.25 · Hydration $14.79 · Probiotic $9.55
   + about $6 shipping when a gift ships on its own.
   ========================================================================== */
const crypto = require("crypto");
const { getStore, connectLambda } = require("@netlify/blobs");

const H = {
  vanilla: "vanilla-birthday-cake-plant-based-protein-powder",
  chocolate: "chocolate-brownie-delight-plant-based-protein-powder",
  strawberry: "energy-powder-strawberry-shortcake",
  cotton: "energy-powder-cotton-candy",
  hydration: "hydration-powder-peach-mango",
  probiotic: "probiotic-20-billion",
};

// Free treats. signups = friends who open their own bakery from your link;
// orders = friends whose FIRST order ships. Both must happen inside the 7 days.
// One prize per product. Requirements follow the product's cost (Shopify):
// Probiotic $9.55 · Energy/Hydration ~$15 · Protein $27.75 (+ ~$6 shipping).
const PRIZE_TIERS = {
  probiotic: { signups: 3, orders: 1, ship: "next-order" },
  treat: { signups: 5, orders: 2, ship: "own" },
  protein: { signups: 8, orders: 3, ship: "own" },
};
const PRIZES = {
  [H.vanilla]: { name: "Vanilla Birthday Cake Protein", tier: "protein" },
  [H.chocolate]: { name: "Chocolate Brownie Delight Protein", tier: "protein" },
  [H.strawberry]: { name: "Strawberry Shortcake Energy", tier: "treat" },
  [H.cotton]: { name: "Cotton Candy Energy", tier: "treat" },
  [H.hydration]: { name: "Peach Mango Hydration", tier: "treat" },
  [H.probiotic]: { name: "Probiotic 20 Billion", tier: "probiotic" },
};
Object.values(PRIZES).forEach((p) => Object.assign(p, PRIZE_TIERS[p.tier], { options: [] }));
Object.entries(PRIZES).forEach(([handle, p]) => { p.options = [handle]; });
const EVENT_DAYS = 7;
const CLAIM_GRACE_DAYS = 2;       // time to claim after the timer ends
const PRIZE_COOLDOWN_DAYS = 30;   // each prize once a month per person

// Sprinkles (the game points) and the coupons they buy.
const DAILY_GAME_CAP = 60;        // sprinkles per day from the mini-game
const PLAY_MAX_POINTS = 30;       // per round
const FREE_PLAYS = 3;             // per day, +1 per friend who joins that day
const CHECKIN_SPRINKLES = 5;
const FRIEND_JOIN_SPRINKLES = 25;
const FRIEND_ORDER_SPRINKLES = 100;
const TIERS = {
  t3: { cost: 500, label: "$3 off orders of $30+", amountOff: 300, minimum: 3000 },
  t5: { cost: 1000, label: "$5 off orders of $40+", amountOff: 500, minimum: 4000 },
  t15: { cost: 2500, label: "15% off one order", percentOff: 15 },
};
const FRIEND_PERCENT = 15;
// Test mode: unlimited plays and no daily star limit. On automatically while
// running locally (netlify dev); on the live site only if BAKERY_TEST_MODE=true.
const TEST_MODE = process.env.BAKERY_TEST_MODE === "true" || process.env.NETLIFY_DEV === "true";        // the invited friend's first-order discount
const CODE_DAYS = 60;

/* ---------- storage ---------- */
function db(event) {
  if (event) { try { connectLambda(event); } catch { /* local dev */ } }
  return getStore("bakery");
}
const hash = (s) => crypto.createHash("sha256").update(String(s).toLowerCase().trim()).digest("hex").slice(0, 40);
const rid = (n = 12) => crypto.randomBytes(n).toString("base64url").replace(/[-_]/g, "").slice(0, n);

/* ---------- player tokens (no passwords; saved on the device) ---------- */
function secret() {
  const s = process.env.BAKERY_SECRET || process.env.COOKBOOK_SECRET;
  if (!s) throw new Error("Set BAKERY_SECRET (or COOKBOOK_SECRET) in .env / Netlify.");
  return s;
}
const sign = (v) => crypto.createHmac("sha256", secret()).update(v).digest("base64url").slice(0, 32);
const tokenFor = (playerId) => `${playerId}.${sign(`player:${playerId}`)}`;
function playerIdFrom(token) {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const [id, sig] = token.split(".");
  if (!/^[A-Za-z0-9]{8,24}$/.test(id)) return null;
  const good = sign(`player:${id}`);
  return sig && sig.length === good.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good)) ? id : null;
}
const ticketFor = (playerId, startedAt, nonce) => `${startedAt}.${nonce}.${sign(`play:${playerId}:${startedAt}:${nonce}`)}`;
function readTicket(playerId, ticket) {
  const [t, n, sig] = String(ticket || "").split(".");
  if (!t || !n || !sig) return null;
  const good = sign(`play:${playerId}:${t}:${n}`);
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  return { startedAt: Number(t), nonce: n };
}

/* ---------- dates in the player's time zone ---------- */
function dayKey(tz, d = new Date()) {
  let zone = "America/New_York";
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); zone = tz; } catch { /* default */ }
  return new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/* ---------- event progress ---------- */
function progress(p, now = Date.now()) {
  const e = p.event;
  if (!e || !PRIZES[e.prize]) return null; // older test events used other keys
  const prize = PRIZES[e.prize];
  const inWindow = (t) => t >= e.startedAt && t <= e.endsAt;
  const signups = (p.friends || []).filter((f) => inWindow(f.at)).length;
  const orders = (p.friendOrders || []).filter((o) => inWindow(o.at)).length;
  const done = signups >= prize.signups && orders >= prize.orders;
  const claimable = done && !e.claimed && now <= e.endsAt + CLAIM_GRACE_DAYS * 86400000;
  const expired = !done && now > e.endsAt;
  return { prize: e.prize, startedAt: e.startedAt, endsAt: e.endsAt, signups, orders, needSignups: prize.signups, needOrders: prize.orders, done, claimable, claimed: !!e.claimed, expired };
}

// What the browser is allowed to see about the player.
function publicState(p, tz) {
  const today = dayKey(tz || p.tz);
  const d = (p.days || {})[today] || {};
  const extra = (p.friends || []).filter((f) => dayKey(tz || p.tz, new Date(f.at)) === today).length;
  return {
    firstName: p.firstName,
    hasEmail: !!p.email,
    code: p.code,
    sprinkles: p.sprinkles || 0,
    playsLeft: TEST_MODE ? 99 : Math.max(0, FREE_PLAYS + extra - (d.plays || 0)),
    testMode: TEST_MODE,
    gameSprinklesToday: d.game || 0,
    dailyCap: DAILY_GAME_CAP,
    checkedIn: !!d.checkin,
    friendsTotal: (p.friends || []).length,
    friendOrdersTotal: (p.friendOrders || []).length,
    event: progress(p),
    // Each price tier (Protein / Energy & Hydration / Probiotic) once a month.
    cooldowns: Object.fromEntries(Object.keys(PRIZES).map((k) => {
      const tier = PRIZES[k].tier;
      const last = (p.claims || []).filter((c) => (PRIZES[c.prize] ? PRIZES[c.prize].tier : c.prize) === tier).map((c) => c.at).sort().pop();
      return [k, last && Date.now() - last < PRIZE_COOLDOWN_DAYS * 86400000 ? last + PRIZE_COOLDOWN_DAYS * 86400000 : null];
    })),
    pendingGift: p.pendingGift ? { prize: p.pendingGift.prize, name: p.pendingGift.name } : null,
    coupons: (p.coupons || []).slice(-10).reverse(),
    friendCode: p.friendCode || null,
  };
}

module.exports = {
  H, PRIZES, EVENT_DAYS, CLAIM_GRACE_DAYS, PRIZE_COOLDOWN_DAYS,
  DAILY_GAME_CAP, PLAY_MAX_POINTS, FREE_PLAYS, CHECKIN_SPRINKLES, FRIEND_JOIN_SPRINKLES, FRIEND_ORDER_SPRINKLES,
  TIERS, FRIEND_PERCENT, CODE_DAYS, TEST_MODE,
  db, hash, rid, tokenFor, playerIdFrom, ticketFor, readTicket, dayKey, progress, publicState,
};
