/* ==========================================================================
   /api/auth?a=<action>   Customer accounts
   Google / Apple:
   GET  a=config            → public client IDs for the sign-in buttons
   GET  a=nonce             → { nonce, ticket }  one-time, 10 minutes
   POST a=google { credential, ticket }        → { session, user, data }
   POST a=apple  { id_token, ticket, name? }   → { session, user, data }
   Email + password:
   POST a=signup { name, email, password }     → { session, user, data }
   POST a=login  { email, password }           → { session, user, data }
   POST a=reset-start  { email }               → emails a 6-digit code
   POST a=reset-finish { email, code, password } → { session, user, data }
   Signed in (x-nb-auth):
   GET  a=me                                   → { user, data }
   POST a=sync   { data }                      → saves this device's merged data
   POST a=delete                               → deletes the account
   ========================================================================== */
const A = require("../lib/auth");
const PW = require("../lib/passwords");
const email = require("../lib/email");

const json = (statusCode, body) => ({ statusCode, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(body) });
const MAX_DATA = 400 * 1024; // what one account may store (favorites, addresses, app progress…)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// "email" isn't shown as a sign-in button name in the profile.
const pub = (u) => { const p = A.publicUser(u); p.providers = p.providers.filter((x) => x !== "email"); p.hasPassword = !!u.password; p.birthday = u.birthday || null; return p; };
// Birthday: month + day required, year optional. Feb 29 allowed.
function validBirthday(b) {
  if (!b) return null;
  const mm = Number.parseInt(b.mm, 10), dd = Number.parseInt(b.dd, 10);
  const yyyy = b.yyyy ? Number.parseInt(b.yyyy, 10) : null;
  if (!(mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31)) return null;
  if (new Date(Date.UTC(yyyy || 2000, mm - 1, dd)).getUTCMonth() !== mm - 1) return null;
  if (yyyy && (yyyy < 1900 || yyyy > new Date().getUTCFullYear())) return null;
  return { mm, dd, yyyy };
}
const signedIn = (user) => json(200, { session: A.sessionFor(user.uid), user: pub(user), data: user.data || {}, dataAt: user.dataAt || 0 });

exports.handler = async (event) => {
  const a = (event.queryStringParameters || {}).a;
  if (a === "config") {
    return json(200, {
      google: process.env.GOOGLE_CLIENT_ID || null,
      apple: process.env.APPLE_CLIENT_ID || null,
      appleRedirect: process.env.APPLE_REDIRECT_URI || `${process.env.URL || ""}/profile.html`,
      resetByEmail: email.configured(),
    });
  }
  let s;
  try { s = A.db(event); A.newNonce(); } catch (err) { return json(500, { error: err.message }); }
  if (a === "nonce") return json(200, A.newNonce());

  let body = {};
  if (event.httpMethod === "POST") { try { body = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "Bad request." }); } }

  /* ---------- Google / Apple ---------- */
  if (a === "google" || a === "apple") {
    const nonce = A.readTicket(body.ticket);
    if (!nonce) return json(400, { error: "Sign-in expired. Please try again." });
    try {
      const token = a === "google" ? body.credential : body.id_token;
      const info = await A.verifyIdToken(a, token, nonce);
      // Apple sends the name only on the very first sign-in, outside the token.
      const name = a === "apple" ? String(body.name || "").trim().slice(0, 60) || null : null;
      const user = await A.findOrCreate(s, a, info, name);
      return signedIn(user);
    } catch (err) {
      console.error(`${a} sign-in:`, err.message);
      return json(401, { error: /set up/.test(err.message) ? err.message : "We couldn’t sign you in. Please try again." });
    }
  }

  /* ---------- Email + password ---------- */
  if (a === "signup" || a === "login" || a === "reset-start" || a === "reset-finish") {
    const mail = String(body.email || "").trim().toLowerCase().slice(0, 200);
    if (!EMAIL_RE.test(mail)) return json(400, { error: "Enter a valid email address." });
    const eh = A.hash(mail);
    const uid = await s.get(`idx/email/${eh}`);
    const user = uid ? await s.get(`u/${uid}`, { type: "json" }) : null;

    if (a === "signup") {
      const name = String(body.name || "").trim().slice(0, 60);
      if (!name) return json(400, { error: "Add your first name." });
      const birthday = validBirthday(body.birthday);
      if (!birthday) return json(400, { error: "Add your birthday (month and day)." });
      const bad = PW.passwordProblem(body.password);
      if (bad) return json(400, { error: bad });
      if (user && user.password) return json(409, { error: "There’s already an account with this email. Sign in instead." });
      if (user) {
        const via = Object.keys(user.providers || {}).filter((p) => p !== "email").map((p) => (p === "google" ? "Google" : "Apple")).join(" or ");
        return json(409, { error: `This email already has an account${via ? ` with ${via}` : ""}. Use that button to sign in.` });
      }
      const now = Date.now();
      const crypto = require("crypto");
      const newUid = crypto.randomBytes(12).toString("base64url").replace(/[-_]/g, "").slice(0, 16).padEnd(12, "x");
      const fresh = { uid: newUid, email: mail, name, picture: null, providers: { email: eh }, password: await PW.hashPassword(body.password), birthday, createdAt: now, lastLogin: now, data: {}, dataAt: 0 };
      await s.setJSON(`u/${newUid}`, fresh);
      await s.set(`idx/email/${eh}`, newUid);
      return signedIn(fresh);
    }

    if (a === "login") {
      const until = await PW.locked(s, eh);
      if (until) return json(429, { error: `Too many tries. Please wait ${Math.ceil((until - Date.now()) / 60000)} minutes or reset your password.` });
      const ok = user && user.password && (await PW.checkPassword(String(body.password || ""), user.password));
      if (!ok) {
        await PW.failed(s, eh);
        if (user && !user.password) {
          const via = Object.keys(user.providers || {}).map((p) => (p === "google" ? "Google" : p === "apple" ? "Apple" : "")).filter(Boolean).join(" or ");
          return json(401, { error: `This email signs in with ${via || "another method"}. Use that button above.` });
        }
        return json(401, { error: "That email and password don’t match. Try again or reset your password." });
      }
      await PW.cleared(s, eh);
      user.lastLogin = Date.now();
      await s.setJSON(`u/${user.uid}`, user);
      return signedIn(user);
    }

    if (a === "reset-start") {
      // Same answer whether or not the email exists (no account fishing).
      const generic = json(200, { ok: true, message: `If there’s an account for ${mail}, we sent a 6-digit code. It’s valid for ${PW.RESET_MIN} minutes.` });
      if (!email.configured()) return json(503, { error: "Password reset by email isn’t set up yet. Please email us and we’ll help you." });
      if (!user) return generic;
      const code = await PW.newResetCode(s, eh);
      await email.send({
        to: mail,
        subject: `Your NutriBae code: ${code}`,
        html: email.layout({ title: "Reset your password", intro: `Your code is <strong style="font-size:26px;letter-spacing:4px">${code}</strong><br>It’s valid for ${PW.RESET_MIN} minutes. If you didn’t ask for this, you can ignore this email.`, button: "Open NutriBae", buttonUrl: `${process.env.URL || ""}/login.html` }),
        text: `Your NutriBae code is ${code}. It’s valid for ${PW.RESET_MIN} minutes.`,
      });
      return generic;
    }

    if (a === "reset-finish") {
      const bad = PW.passwordProblem(body.password);
      if (bad) return json(400, { error: bad });
      if (!user || !(await PW.useResetCode(s, eh, body.code))) return json(400, { error: "That code isn’t right or has expired. Ask for a new one." });
      user.password = await PW.hashPassword(body.password);
      user.providers = { ...(user.providers || {}), email: eh };
      user.lastLogin = Date.now();
      await s.setJSON(`u/${user.uid}`, user);
      await PW.cleared(s, eh);
      return signedIn(user);
    }
  }

  /* ---------- signed in ---------- */
  const uid = A.uidFrom(event.headers["x-nb-auth"]);
  const user = uid ? await s.get(`u/${uid}`, { type: "json" }) : null;
  if (!user) return json(401, { error: "Please sign in again." });

  if (a === "me") return json(200, { user: pub(user), data: user.data || {}, dataAt: user.dataAt || 0 });

  if (a === "sync") {
    const data = body.data && typeof body.data === "object" ? body.data : null;
    if (!data) return json(400, { error: "Nothing to save." });
    const raw = JSON.stringify(data);
    if (raw.length > MAX_DATA) return json(413, { error: "Too much data to save." });
    user.data = data;
    user.dataAt = Date.now();
    if (typeof body.name === "string" && body.name.trim()) user.name = body.name.trim().slice(0, 60);
    if (body.birthday && !user.birthday) user.birthday = validBirthday(body.birthday) || undefined;
    await s.setJSON(`u/${uid}`, user);
    return json(200, { ok: true, dataAt: user.dataAt });
  }

  if (a === "delete") {
    await Promise.all([
      s.delete(`u/${uid}`),
      ...Object.entries(user.providers || {}).filter(([p]) => p !== "email").map(([p, sub]) => s.delete(`idx/${p}/${sub}`)),
      user.email ? s.delete(`idx/email/${A.hash(user.email)}`) : null,
    ].filter(Boolean));
    return json(200, { ok: true });
  }
  return json(404, { error: "Unknown action." });
};
