/* ==========================================================================
   GET /api/cookbook
     ?unlock=<checkout session id>  → { token, link } after a paid order that
                                      included the free cookbook (success page)
     ?t=<token>&get=recipes         → the 25 full recipes for the app
     ?t=<token>&get=pdf             → the Wellness Made Sweet PDF
   The PDF lives in netlify/assets (not public), so only customers can get it.
   ========================================================================== */
const fs = require("fs");
const path = require("path");
const Stripe = require("stripe");
const { makeToken, verifyToken, link } = require("../lib/cookbook");
const RECIPES = require("../lib/recipes-full.json");

const PDF_NAME = "Wellness-Made-Sweet-Cookbook.pdf";

function json(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(body) };
}

function readPdf() {
  const candidates = [
    path.resolve("netlify/assets", PDF_NAME),
    path.join(__dirname, "../assets", PDF_NAME),
    path.join(__dirname, "netlify/assets", PDF_NAME),
    path.join(process.env.LAMBDA_TASK_ROOT || "", "netlify/assets", PDF_NAME),
  ];
  for (const p of candidates) { try { return fs.readFileSync(p); } catch { /* try next */ } }
  throw new Error("Cookbook PDF not found in the function bundle.");
}

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") return json(405, { error: "Use GET." });
  const q = event.queryStringParameters || {};

  // 1) Unlock right after checkout
  if (q.unlock) {
    if (!/^cs_[A-Za-z0-9_]+$/.test(q.unlock)) return json(400, { error: "Invalid order." });
    if (!process.env.STRIPE_SECRET_KEY) return json(500, { error: "Not set up yet." });
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-10-28.endive" });
      const s = await stripe.checkout.sessions.retrieve(q.unlock);
      const paid = s.payment_status === "paid" || s.payment_status === "no_payment_required";
      if (!paid) return json(402, { error: "Your payment is still processing. Your cookbook link will be in your order email." });
      if (s.metadata?.cookbook !== "1") return json(404, { included: false });
      const token = makeToken(s.id);
      return json(200, { included: true, token, link: link(token) });
    } catch (err) {
      console.error("Cookbook unlock error:", err.type || "", err.message);
      return json(502, { error: "We couldn't check your order right now. Your cookbook link is in your order email." });
    }
  }

  // 2) Token-protected content
  const sessionId = verifyToken(q.t);
  if (!sessionId) return json(403, { error: "This cookbook link isn't valid." });

  if (q.get === "recipes") return json(200, { recipes: RECIPES });

  if (q.get === "pdf") {
    try {
      const pdf = readPdf();
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${PDF_NAME}"`,
          "Cache-Control": "private, no-store",
        },
        body: pdf.toString("base64"),
        isBase64Encoded: true,
      };
    } catch (err) {
      console.error(err.message);
      return json(500, { error: "The cookbook file is missing. Email us and we'll send it." });
    }
  }

  return json(200, { ok: true });
};
