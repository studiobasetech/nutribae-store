/* ==========================================================================
   Email + password accounts (for people who don't use Google or Apple).
   - Passwords are never stored: only a scrypt hash with its own salt.
   - Too many wrong passwords lock that email for 15 minutes.
   - "Forgot password" emails a 6-digit code (needs RESEND_API_KEY + EMAIL_FROM).
   Storage (Netlify Blobs "accounts"):
     rl/<emailHash>     { fails, until }   wrong-password counter
     reset/<emailHash>  { code, exp, tries }  hashed reset code, 15 minutes
   ========================================================================== */
const crypto = require("crypto");

const N = 16384, R = 8, P = 1, KEYLEN = 64;
const MAX_FAILS = 8, LOCK_MIN = 15, RESET_MIN = 15;

const scrypt = (pw, salt) => new Promise((res, rej) => crypto.scrypt(pw, salt, KEYLEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 }, (e, k) => (e ? rej(e) : res(k))));

async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(String(pw).normalize("NFKC"), salt);
  return { alg: "scrypt", N, r: R, p: P, salt: salt.toString("base64"), hash: key.toString("base64") };
}
async function checkPassword(pw, stored) {
  if (!stored || stored.alg !== "scrypt") return false;
  const key = await scrypt(String(pw).normalize("NFKC"), Buffer.from(stored.salt, "base64"));
  const want = Buffer.from(stored.hash, "base64");
  return key.length === want.length && crypto.timingSafeEqual(key, want);
}

function passwordProblem(pw) {
  const s = String(pw || "");
  if (s.length < 8) return "Use at least 8 characters for your password.";
  if (s.length > 200) return "That password is too long.";
  if (!/[A-Za-z]/.test(s) || !/[0-9]/.test(s)) return "Use letters and at least one number.";
  return null;
}

async function locked(s, eh) {
  const r = await s.get(`rl/${eh}`, { type: "json" });
  return r && r.until && r.until > Date.now() ? r.until : 0;
}
async function failed(s, eh) {
  const r = (await s.get(`rl/${eh}`, { type: "json" })) || { fails: 0 };
  r.fails = (r.fails || 0) + 1;
  if (r.fails >= MAX_FAILS) { r.until = Date.now() + LOCK_MIN * 60000; r.fails = 0; }
  await s.setJSON(`rl/${eh}`, r);
}
const cleared = (s, eh) => s.delete(`rl/${eh}`);

const codeHash = (eh, code) => crypto.createHash("sha256").update(`${eh}:${code}`).digest("hex");
async function newResetCode(s, eh) {
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  await s.setJSON(`reset/${eh}`, { code: codeHash(eh, code), exp: Date.now() + RESET_MIN * 60000, tries: 0 });
  return code;
}
async function useResetCode(s, eh, code) {
  const r = await s.get(`reset/${eh}`, { type: "json" });
  if (!r || r.exp < Date.now() || r.tries >= 5) return false;
  const ok = codeHash(eh, String(code || "").trim()) === r.code;
  if (!ok) { r.tries += 1; await s.setJSON(`reset/${eh}`, r); return false; }
  await s.delete(`reset/${eh}`);
  return true;
}

module.exports = { hashPassword, checkPassword, passwordProblem, locked, failed, cleared, newResetCode, useResetCode, RESET_MIN };
