/* Web Push (the notifications phones and browsers show), built on Node's
   crypto so no extra package is needed.
   - VAPID (RFC 8292) identifies NutriBae to the push services.
   - Payloads are encrypted with aes128gcm (RFC 8291), as browsers require.
   Keys: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY (base64url) and VAPID_SUBJECT
   (mailto: your support email) in .env / Netlify. */
const crypto = require("crypto");

const b64u = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64u = (s) => Buffer.from(String(s).replace(/-/g, "+").replace(/_/g, "/"), "base64");

function hmac(key, data) { return crypto.createHmac("sha256", key).update(data).digest(); }

// One-time helper: node -e "console.log(require('./netlify/lib/webpush').generateKeys())"
function generateKeys() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = privateKey.export({ format: "jwk" });
  const pub = publicKey.export({ format: "jwk" });
  return {
    publicKey: b64u(Buffer.concat([Buffer.from([4]), fromB64u(pub.x), fromB64u(pub.y)])),
    privateKey: jwk.d,
  };
}

function vapidKeyObject() {
  const pub = fromB64u(process.env.VAPID_PUBLIC_KEY || "");
  if (pub.length !== 65) throw new Error("VAPID_PUBLIC_KEY is missing or invalid.");
  return crypto.createPrivateKey({
    format: "jwk",
    key: { kty: "EC", crv: "P-256", d: process.env.VAPID_PRIVATE_KEY, x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) },
  });
}

function vapidHeader(endpoint) {
  const aud = new URL(endpoint).origin;
  const header = b64u(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const claims = b64u(JSON.stringify({
    aud,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: process.env.VAPID_SUBJECT || "mailto:hello@example.com",
  }));
  const unsigned = `${header}.${claims}`;
  const sig = crypto.sign("sha256", Buffer.from(unsigned), { key: vapidKeyObject(), dsaEncoding: "ieee-p1363" });
  return `vapid t=${unsigned}.${b64u(sig)}, k=${process.env.VAPID_PUBLIC_KEY}`;
}

// RFC 8291: encrypt one record for the browser's subscription keys.
function encrypt(payload, keys) {
  const uaPublic = fromB64u(keys.p256dh);
  const authSecret = fromB64u(keys.auth);
  if (uaPublic.length !== 65 || authSecret.length < 16) throw new Error("Bad subscription keys.");

  const ecdh = crypto.createECDH("prime256v1");
  const asPublic = ecdh.generateKeys();
  const shared = ecdh.computeSecret(uaPublic);
  const salt = crypto.randomBytes(16);

  const prkKey = hmac(authSecret, shared);
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic]);
  const ikm = hmac(prkKey, Buffer.concat([keyInfo, Buffer.from([1])])).subarray(0, 32);
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.from("Content-Encoding: aes128gcm\0\x01")).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from("Content-Encoding: nonce\0\x01")).subarray(0, 12);

  const cipher = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const body = Buffer.concat([cipher.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);

  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic, body]);
}

// Sends one notification. Returns { ok, status, gone } (gone = unsubscribed, delete it).
async function send(subscription, message, { ttl = 86400, urgency = "normal" } = {}) {
  const body = encrypt(JSON.stringify(message), subscription.keys);
  const res = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: vapidHeader(subscription.endpoint),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: String(ttl),
      Urgency: urgency,
    },
    body,
  });
  return { ok: res.ok, status: res.status, gone: res.status === 404 || res.status === 410 };
}

module.exports = { generateKeys, encrypt, send, vapidHeader };
