/* Sends email through Resend (resend.com, free up to 3,000 emails a month).
   Needs RESEND_API_KEY and EMAIL_FROM (e.g. "NutriBae <hello@yourdomain.com>",
   a domain you verified in Resend). Without them, emails are skipped. */
const crypto = require("crypto");

const configured = () => !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

async function send({ to, subject, html, text }) {
  if (!configured() || !to) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, html, text }),
    });
    if (!res.ok) console.error("Email error:", res.status, (await res.text()).slice(0, 200));
    return res.ok;
  } catch (err) {
    console.error("Email error:", err.message);
    return false;
  }
}

// Signed one-click unsubscribe links.
function secret() { return process.env.BAKERY_SECRET || process.env.COOKBOOK_SECRET || "nutribae-dev"; }
const hash = (email) => crypto.createHash("sha256").update(String(email).toLowerCase().trim()).digest("hex").slice(0, 40);
const unsubToken = (email) => { const h = hash(email); return `${h}.${crypto.createHmac("sha256", secret()).update(`unsub:${h}`).digest("base64url").slice(0, 22)}`; };
function readUnsub(token) {
  const [h, sig] = String(token || "").split(".");
  if (!h || !sig) return null;
  const good = crypto.createHmac("sha256", secret()).update(`unsub:${h}`).digest("base64url").slice(0, 22);
  return sig.length === good.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good)) ? h : null;
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Simple branded layout (pink, black, white).
function layout({ title, intro, items = [], button, buttonUrl, note = "", unsubUrl }) {
  const site = process.env.URL || "";
  const rows = items.map((i) => `<tr><td style="padding:8px 0;width:64px">${i.image ? `<img src="${esc(i.image)}" width="56" height="56" style="border-radius:10px;object-fit:cover;background:#FFF3F9" alt="">` : ""}</td><td style="padding:8px 0 8px 12px;font-size:15px;color:#111">${esc(i.name)}${i.qty > 1 ? ` × ${i.qty}` : ""}</td></tr>`).join("");
  return `<!doctype html><html><body style="margin:0;background:#FFF3F9;font-family:Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 12px">
  <table role="presentation" width="100%" style="max-width:520px;background:#fff;border-radius:20px;padding:28px" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding-bottom:16px">${site ? `<img src="${site}/assets/images/logo.png" width="120" alt="NutriBae">` : `<strong style="color:#F19EC8;font-size:22px">NutriBae</strong>`}</td></tr>
    <tr><td style="font-size:22px;font-weight:700;color:#111;text-align:center;padding-bottom:8px">${esc(title)}</td></tr>
    <tr><td style="font-size:15px;line-height:1.5;color:#111;text-align:center;padding-bottom:16px">${intro}</td></tr>
    ${rows ? `<tr><td><table role="presentation" width="100%">${rows}</table></td></tr>` : ""}
    <tr><td align="center" style="padding:20px 0 8px"><a href="${esc(buttonUrl)}" style="display:inline-block;background:#F19EC8;color:#fff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:999px;font-size:16px">${esc(button)}</a></td></tr>
    ${note ? `<tr><td style="font-size:13px;color:#111;text-align:center;padding-top:8px">${note}</td></tr>` : ""}
  </table>
  ${unsubUrl ? `<p style="font-size:12px;color:#111;opacity:.6;margin-top:16px">Don’t want these reminders? <a href="${esc(unsubUrl)}" style="color:#111">Unsubscribe</a></p>` : ""}
  </td></tr></table></body></html>`;
}

module.exports = { configured, send, hash, unsubToken, readUnsub, layout, esc };
