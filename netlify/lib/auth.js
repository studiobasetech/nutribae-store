/* ==========================================================================
   Customer accounts: Sign in with Google and Sign in with Apple.
   - Verifies the ID token each provider returns (RS256 signature against the
     provider's public keys, issuer, audience, expiry and our one-time nonce).
   - Keeps accounts in Netlify Blobs ("accounts"):
       u/<uid>               { uid, email, name, picture, providers, createdAt, data, dataAt }
       idx/google/<sub>      uid
       idx/apple/<sub>       uid
       idx/email/<hash>      uid   (same verified email = same account)
   - Sessions are signed tokens kept in the browser (no passwords anywhere).
   Needs: GOOGLE_CLIENT_ID, APPLE_CLIENT_ID (Services ID), and AUTH_SECRET
   (falls back to BAKERY_SECRET / COOKBOOK_SECRET).
   ========================================================================== */
const crypto = require("crypto");
const { getStore, connectLambda } = require("@netlify/blobs");

const PROVIDERS = {
  google: { jwks: "https://www.googleapis.com/oauth2/v3/certs", iss: ["accounts.google.com", "https://accounts.google.com"], aud: () => process.env.GOOGLE_CLIENT_ID },
  apple: { jwks: "https://appleid.apple.com/auth/keys", iss: ["https://appleid.apple.com"], aud: () => process.env.APPLE_CLIENT_ID },
};
const SESSION_DAYS = 60;
const NONCE_MIN = 10;

function db(event) {
  if (event) { try { connectLambda(event); } catch { /* local dev */ } }
  return getStore("accounts");
}
function secret() {
  const s = process.env.AUTH_SECRET || process.env.BAKERY_SECRET || process.env.COOKBOOK_SECRET;
  if (!s) throw new Error("Set AUTH_SECRET in .env / Netlify.");
  return s;
}
const hmac = (v) => crypto.createHmac("sha256", secret()).update(v).digest("base64url");
const safeEq = (a, b) => typeof a === "string" && typeof b === "string" && a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
const hash = (s) => crypto.createHash("sha256").update(String(s).toLowerCase().trim()).digest("hex").slice(0, 40);

/* ---------- one-time nonce (stops a stolen token from being replayed) ---------- */
function newNonce() {
  const n = crypto.randomBytes(16).toString("base64url");
  const exp = Date.now() + NONCE_MIN * 60000;
  return { nonce: n, ticket: `${n}.${exp}.${hmac(`nonce:${n}:${exp}`).slice(0, 32)}` };
}
function readTicket(ticket) {
  const [n, exp, sig] = String(ticket || "").split(".");
  if (!n || !exp || !sig || Number(exp) < Date.now()) return null;
  return safeEq(sig, hmac(`nonce:${n}:${exp}`).slice(0, 32)) ? n : null;
}

/* ---------- sessions ---------- */
function sessionFor(uid) {
  const exp = Date.now() + SESSION_DAYS * 86400000;
  return `${uid}.${exp}.${hmac(`session:${uid}:${exp}`).slice(0, 40)}`;
}
function uidFrom(token) {
  const [uid, exp, sig] = String(token || "").split(".");
  if (!uid || !exp || !sig || !/^[A-Za-z0-9]{10,32}$/.test(uid) || Number(exp) < Date.now()) return null;
  return safeEq(sig, hmac(`session:${uid}:${exp}`).slice(0, 40)) ? uid : null;
}

/* ---------- ID token verification ---------- */
const keyCache = {};
async function keys(provider, force = false) {
  const c = keyCache[provider];
  if (!force && c && Date.now() - c.at < 6 * 3600000) return c.keys;
  const res = await fetch(PROVIDERS[provider].jwks);
  if (!res.ok) throw new Error(`Could not load ${provider} keys`);
  const { keys: k } = await res.json();
  keyCache[provider] = { at: Date.now(), keys: k };
  return k;
}
const part = (s) => JSON.parse(Buffer.from(s, "base64url").toString("utf8"));
async function verifyIdToken(provider, token, expectedNonce) {
  const p = PROVIDERS[provider];
  if (!p) throw new Error("Unknown provider");
  const aud = p.aud();
  if (!aud) throw new Error(`${provider === "google" ? "Google" : "Apple"} sign-in isn’t set up yet.`);
  const [h, b, s] = String(token || "").split(".");
  if (!h || !b || !s) throw new Error("Bad token");
  const header = part(h), payload = part(b);
  if (header.alg !== "RS256") throw new Error("Bad token");
  let jwk = (await keys(provider)).find((k) => k.kid === header.kid);
  if (!jwk) jwk = (await keys(provider, true)).find((k) => k.kid === header.kid);
  if (!jwk) throw new Error("Unknown key");
  const ok = crypto.verify("RSA-SHA256", Buffer.from(`${h}.${b}`), crypto.createPublicKey({ key: jwk, format: "jwk" }), Buffer.from(s, "base64url"));
  if (!ok) throw new Error("Bad signature");
  const now = Math.floor(Date.now() / 1000);
  const audOk = Array.isArray(payload.aud) ? payload.aud.includes(aud) : payload.aud === aud;
  if (!p.iss.includes(payload.iss) || !audOk || !(payload.exp > now - 60)) throw new Error("Token not valid");
  if (expectedNonce && payload.nonce !== expectedNonce) throw new Error("Sign-in expired, try again");
  const verified = payload.email_verified === true || payload.email_verified === "true";
  return { sub: String(payload.sub), email: verified && payload.email ? String(payload.email).toLowerCase() : null, name: payload.name || null, picture: payload.picture || null };
}

/* ---------- accounts ---------- */
const rid = () => crypto.randomBytes(12).toString("base64url").replace(/[-_]/g, "").slice(0, 16).padEnd(12, "x");
async function findOrCreate(s, provider, info, extraName) {
  let uid = await s.get(`idx/${provider}/${info.sub}`);
  if (!uid && info.email) uid = await s.get(`idx/email/${hash(info.email)}`);
  let user = uid ? await s.get(`u/${uid}`, { type: "json" }) : null;
  const now = Date.now();
  if (!user) {
    uid = rid();
    user = { uid, email: info.email, name: extraName || info.name || "", picture: info.picture || null, providers: {}, createdAt: now, data: {}, dataAt: 0 };
  }
  user.providers = { ...(user.providers || {}), [provider]: info.sub };
  if (!user.email && info.email) user.email = info.email;
  if (!user.name && (extraName || info.name)) user.name = extraName || info.name;
  if (info.picture) user.picture = info.picture;
  user.lastLogin = now;
  await s.setJSON(`u/${uid}`, user);
  await s.set(`idx/${provider}/${info.sub}`, uid);
  if (user.email) await s.set(`idx/email/${hash(user.email)}`, uid);
  return user;
}
const publicUser = (u) => ({ uid: u.uid, email: u.email, name: u.name, picture: u.picture, providers: Object.keys(u.providers || {}), createdAt: u.createdAt });

module.exports = { db, newNonce, readTicket, sessionFor, uidFrom, verifyIdToken, findOrCreate, publicUser, hash };
