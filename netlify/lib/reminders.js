/* Storage for cart reminders, review reminders and post-checkout add-ons
   (Netlify Blobs).
   cart/<id>      { lines, names, email, pushKey, recovery, updatedAt, sent: {} }
   review/<id>    { pushKey, items: [{ handle, name }], due, sent }
   upsell/<sess>  { status, handle, variantId, price, pi, included, editedAt }
   order/<sess>   { orderId, name, at }
   unsub/<hash>   1 */
const { getStore, connectLambda } = require("@netlify/blobs");

function db(event) {
  if (event) { try { connectLambda(event); } catch { /* local dev or already connected */ } }
  return getStore("reminders");
}

module.exports = { db };
