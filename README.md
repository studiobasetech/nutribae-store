# NutriBae store

Plain HTML, CSS and JavaScript, plus two small serverless functions for Stripe checkout. Hosted free on Netlify; you only pay Stripe’s fee per sale.

## Folder structure

```
public/                  The website (everything visitors can load)
  index.html             Home
  shop.html              Shop (built from js/products.js)
  about.html             About us
  faq.html               FAQ
  success.html           Thank-you page after payment
  css/styles.css         All styles. Brand colors at the top.
  js/products.js         YOUR PRODUCTS AND PRICES (also used by checkout)
  js/layout.js           Header, menu, footer, social links
  js/cart.js             Cart + "Check out" button
  js/spin.js             Spin to win: prizes, odds, codes
  assets/                Images and video
netlify/functions/
  checkout.js            Creates the Stripe checkout page
  stripe-webhook.js      Receives paid orders from Stripe
netlify.toml             Netlify settings + security headers
.env.example             Names of the secret keys (no values)
```

## 1. Preview the design (no checkout)

Open the folder in VS Code, install the **Live Server** extension, right-click `public/index.html` → **Open with Live Server**. Everything works except the Check out button, which needs step 2.

## 2. Run it locally with checkout (test mode)

You need [Node.js](https://nodejs.org) (LTS) installed. In the VS Code terminal (Terminal → New Terminal):

```bash
npm install
npm install -g netlify-cli @stripe/cli
```

**Get Stripe test keys**
1. Create a Stripe account at stripe.com (or run `stripe sandbox create` for a test-only account).
2. In the Dashboard, create a **sandbox** (a separate test environment).
3. In the sandbox: Developers → API keys → **Create restricted key**. Give it **Checkout Sessions: Write** and nothing else. It starts with `rk_test_`. If checkout ever fails with a permission (403) error, the terminal names the permission to add.

**Set up your local keys**
1. Copy `.env.example` to a new file named `.env`.
2. Paste the restricted key after `STRIPE_SECRET_KEY=`.
3. In a second terminal run `stripe login`, then:
   ```bash
   stripe listen --forward-to localhost:8888/api/stripe-webhook
   ```
   It prints a `whsec_...` secret. Paste it after `STRIPE_WEBHOOK_SECRET=` in `.env`.

`.env` is git-ignored. Only ever put **test** keys in it, never live ones.

**Run the site**
```bash
npm run dev
```
Open http://localhost:8888, add a product (it needs a price in `js/products.js`), check out, and pay with Stripe’s test card `4242 4242 4242 4242`, any future date, any CVC. You’ll see a `NEW ORDER` line in the terminal.

## 3. Go live on Netlify

1. Put the project on GitHub (VS Code: Source Control → Publish to GitHub). Check that `.env` is **not** in the list of files.
2. On netlify.com: Add new site → Import from GitHub → pick the repo. Settings are read from `netlify.toml`.
3. Site configuration → Environment variables. Add `STRIPE_SECRET_KEY` (a **live** restricted key, `rk_live_`, with Checkout Sessions: Write) and mark it **secret**.
4. In Stripe (live mode): Developers → Webhooks → Add endpoint
   - URL: `https://YOUR-SITE.netlify.app/api/stripe-webhook`
   - Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`
   - Copy its signing secret into Netlify as `STRIPE_WEBHOOK_SECRET` (secret), then redeploy.
5. Domain: Netlify → Domain management → add your domain and follow the DNS steps.

Drag-and-drop deploys don’t run functions, so use the GitHub import.

## 4. Stripe settings to turn on

- **Receipts**: Settings → Customer emails → turn on emails for successful payments.
- **Spin to win codes**: Product catalog → Coupons → create 10%, 15% and 30% coupons, then add promotion codes `SPIN10`, `SPIN15`, `SPIN30` (or change the codes in `js/spin.js`). Consider “Eligible for first-time order only” and a redemption limit, since codes can be shared.
- **Payment methods**: Settings → Payment methods. Apple Pay, Google Pay, Link and others are shown automatically when eligible.
- **Sales tax**: off for now. Ask your accountant which states you must collect in. Once registered, you can turn on Stripe Tax.
- **Security**: turn on two-factor login with an authenticator app or passkey.

## Handling orders (Supliful)

Every paid order shows up in Stripe → Payments, and as a `NEW ORDER` line in Netlify → Logs → Functions (name, address, items). Place it in Supliful from there. When you’re ready, `stripe-webhook.js` has marked spots to email yourself each order and send the cookbook link automatically.

## Before launch checklist

- [ ] Prices set in `public/js/products.js`
- [ ] Original images from Shopify in `public/assets/images/` (same file names)
- [ ] Video at `public/assets/videos/nutribae.mp4`
- [ ] Countries you ship to in `netlify/functions/checkout.js` (`SHIP_TO`)
- [ ] Search for `TODO` and the yellow placeholder text in about, FAQ and success pages
- [ ] Protein per serving matches your label (copy says 20g, pouch says 25g)
- [ ] One real test purchase in live mode, then refund it

## Shopify + Supliful (background)

Shopify stays as a hidden "warehouse": customers only see this website and the app.

- **Products** come from Shopify (`/api/products`, `netlify/functions/products.js`). Publish products from Supliful to Shopify and they appear on the site. `public/js/products.js` is only the fallback, plus extra info (details, disclaimer, size) matched by Shopify handle.
- **Orders**: after a Stripe payment, `netlify/functions/stripe-webhook.js` creates the paid order in Shopify, and Shopify routes it to Supliful.
- **Connection**: Dev Dashboard app "NutriBae Website" installed on the store. Env vars: `SHOPIFY_SHOP`, `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET` (in `.env` locally, in Netlify for live).
- **Stripe restricted key** needs: Checkout Sessions (write) and Products (read).
- **Before selling**: Shopify must be on a regular plan (Pause and Build can't complete orders), and automatic fulfillment for Supliful must be on.

## Subscribe & Save and bundles

- **Subscribe & Save**: 15% off, delivered monthly (`SUBSCRIBE` in `public/js/products.js`). Checkout switches to a Stripe subscription. The first order is created in Shopify on `checkout.session.completed`; each monthly renewal creates a new Shopify order on `invoice.paid` (address and products are saved on the Stripe subscription).
  - Add `invoice.paid` to the Stripe webhook events.
  - Restricted key needs: Checkout Sessions (write), Subscriptions (write), Invoices (read), Products (read).
  - Turn on the Stripe customer portal (Settings → Billing → Customer portal) so subscribers can skip/cancel, and paste its login link into `STRIPE_PORTAL_URL` in `public/js/layout.js` to show "Manage subscription" in the footer.
  - Appstle Subscription is no longer used by the site (it only works with Shopify's checkout).
- **Bundles**: defined in `BUNDLES` in `public/js/products.js` (product handles + discount). Prices come from Shopify; each bundle becomes its separate products in the Shopify order so Supliful ships them.
- **Reviews**: `/api/reviews?summary=1` gives star ratings for cards and badges; they stay hidden until Judge.me has real reviews.

## App features (v1)

| Page | What it does |
|---|---|
| `recipes.html` | Sweet Kitchen: the 25 cookbook recipes (`js/recipes-data.js`, photos in `assets/recipes/`), filters, favorites, cook mode (step by step, timers, screen stays on), "Buy what's missing". |
| `plan.html` | Sweet Plan quiz: 6 questions → product picks, daily routine, recipes, one-tap subscribe. |
| `my-day.html` | My Sweet Day: water, scoops, movement, "How do I feel today?" log, Bae Points and badges, smart refill estimates, Apple Watch / Fitbit section. |
| `swap.html` | Sweet Swap: craving → NutriBae recipe with a protein/carbs/calories comparison. |

- Shared state lives in `js/app-store.js` and is saved in the browser (localStorage) for now. Customer accounts (e.g. Supabase) will let points, plans and logs follow the customer across devices.
- Installable: `manifest.webmanifest` + `sw.js` (network first, works offline). On the live HTTPS site, "Add to Home Screen" gives the app icon and the bottom tab bar.
- Wearables: the legacy Fitbit Web API was retired by Google in 2026, and Apple Health can only be read from a native iPhone app. Both arrive with the native app (Capacitor + HealthKit on iPhone, Health Connect on Android). Until then, movement is typed in.

## Free cookbook (customers only)

- The cart shows "Add my free cookbook" (ticked by default). Checkout marks the Stripe session `cookbook: 1`.
- Right after payment, `success.html` calls `/api/cookbook?unlock=<session>`. That returns a signed token, which is saved on the device and unlocks the PDF download and the full recipes.
- The webhook puts the same link on the Shopify order (attribute **Cookbook download**, tag `cookbook`) and asks Shopify to send its order confirmation email. To show the link in that email, paste this into Shopify admin → Settings → Notifications → Order confirmation:

  ```liquid
  {% for attribute in attributes %}{% if attribute.first == 'Cookbook download' %}
  <p><a href="{{ attribute.last }}">Download your free Wellness Made Sweet cookbook</a></p>
  {% endif %}{% endfor %}
  ```

- The PDF (`netlify/assets/`, compressed to 3.8 MB) and the full recipes (`netlify/lib/recipes-full.json`) are not public. `public/js/recipes-data.js` only holds the previews.
- `COOKBOOK_SECRET` signs the links. It's already in `.env`; add the same value in Netlify before launch, and never change it.

## Discount codes

- Codes can be typed in the cart ("Discount code" → Apply) or on the Stripe payment page. A Spin to Win code is filled in automatically.
- Create them in Stripe → Product catalog → Coupons → promotion code (e.g. SPIN10, SPIN15). The Stripe key needs **Promotion Codes: Read** and **Coupons: Read**.

## App notifications (Web Push)

- Customers turn them on in **My Sweet Day → Notifications**, choosing a daily check-in reminder (and its time), water reminders (11am and 3pm), refill alerts, and deals & new flavors.
- `netlify/functions/push-daily.js` runs every hour and sends the reminders each person turned on, at their own local time. Subscriptions are kept in Netlify Blobs.
- Announcements: open `/notify.html`, type your `PUSH_ADMIN_KEY` password, and write the message. It goes to everyone who turned on deals.
- `.env` already has `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT`. Set `VAPID_SUBJECT` to `mailto:` your support email, choose a `PUSH_ADMIN_KEY`, and copy all four to Netlify. Never change the VAPID keys after launch, or existing subscriptions stop working.
- iPhone: notifications work after "Add to Home Screen" (iOS 16.4+). Android and desktop browsers work right away. Push only works on the live HTTPS site (or localhost in Chrome).

## Spin to win (discount wheel)

- `/api/spin` (`netlify/functions/spin.js`) picks the prize on the server, using the odds in `netlify/lib/spin-config.js` (never above 15%).
- Rules: one spin when someone signs up with their info, then one spin on their birthday each year. The birthday is the one they gave at sign-up, they must have signed up at least 7 days before, and every birthday spin wins.
- Each win creates a unique one-time Stripe code (e.g. `BAE10-K7Q2M`), valid 30 days, on the coupons `nutribae-spin-10` / `nutribae-spin-15`. These are created automatically. The Stripe key needs **Coupons: Write** and **Promotion Codes: Write**.
- Without a working Stripe key, the wheel falls back to the shared codes `SPIN10` / `SPIN15`.
- Sign-ups (name, email, birthday) are saved in Netlify Blobs (`spin-entries`). Connecting Klaviyo or Mailchimp is next.

## Play To Win (NutriBae Run game + referrals)

- **Page:** `bakery.html` (`js/bakery.js`, game in `js/bakery-game.js`). **Server:** `/api/bakery` (`netlify/functions/bakery.js`, rules in `netlify/lib/bakery.js`). Data is kept in Netlify Blobs (`bakery`).
- **NutriBae Run:** a pixel-art runner (`js/bakery-game.js`). Collect NutriBae products (real photos, pixelated), dodge junk food, 3 hearts. About 12 points = 1 star. 3 plays a day, plus 1 extra per friend who joins that day. Max 60 sprinkles a day; the server checks every round (minimum length, one score per round).
- **Sprinkle shop:** 500 = $3 off $30+, 1,000 = $5 off $40+, 2,500 = 15% off. Each is a unique one-time Stripe code, valid 60 days.
- **Bake your free treat:** 7 days to finish.

  | Treat | Friends who join | Friends' first orders | How it ships |
  |---|---|---|---|
  | Probiotic | 3 | 1 | free with the next order |
  | Energy or Hydration | 5 | 2 | on its own |
  | Protein tub | 8 | 3 | on its own |

  Gifts that ship on their own become a $0 Shopify order (tag `bakery-gift`), and Supliful ships them. Each treat can be won once every 30 days.
- **Referrals:** invite links are `/bakery.html?ref=CODE`. The friend gets 15% off their first order (unique code, first-time customers only). The checkout passes `ref` to Stripe, and the webhook counts only the friend's FIRST paid order (and never the referrer's own email). The referrer earns +25 sprinkles per friend who joins and +100 per friend's first order.
- **Settings:** `BAKERY_SECRET` (optional; falls back to `COOKBOOK_SECRET`) signs player tokens. Stripe key permissions: Coupons Write and Promotion Codes Write.
- **To add later:** phone verification for friends (needs an SMS service such as Twilio) and moving a bakery to a new device (needs customer accounts).

## Sales boosters (Nov 2026)

**Subscribe & Save** — product pages default to it; cart lines have a "Subscribe & save 15%" toggle; shop cards show the monthly price. Renewals create a Shopify order every month (`invoice.paid` in the webhook). Subscribers manage/cancel at `/api/portal`:
- Stripe → Settings → Billing → Customer portal → turn on the **Login link** → copy it into `STRIPE_PORTAL_LOGIN_URL`.

**Bundles + spend-more-save-more** — `public/js/products.js`: `BUNDLES` (now 3, incl. Sweet Starter Kit) and `CART_TIERS` (10% from $75, 15% from $110, on one-time single products). The cart shows a progress bar; checkout applies the same prices on the server.

**One-tap add-on after checkout** — `netlify/functions/upsell.js` (offers in `OFFERS`). Checkout saves the card (`setup_future_usage`), the thank-you page offers one product for 15 minutes, one tap charges it and adds it to the same Shopify order.
- Stripe key permissions: PaymentIntents **Write**, Customers **Read**, Checkout Sessions **Read**, Subscriptions **Read**.
- Shopify app scopes: add **write_order_edits** (plus write_orders / read_orders).

**Abandoned cart reminders** — `cart-reminder.js` saves carts of shoppers who gave their email (Spin to Win) or turned on notifications; `reminders.js` (hourly) sends a push + email at 1h and 24h, stops when they buy. Stripe checkouts that expire unpaid also get a reminder email if the shopper ticked "email me" on the Stripe page.
- Add the webhook event **checkout.session.expired** in Stripe.
- Emails need Resend (free tier): `RESEND_API_KEY` and `EMAIL_FROM` ("NutriBae <hello@yourdomain.com>", domain verified in Resend). Without them only push reminders go out. Every email has a one-click unsubscribe.

**Reviews with photos** — product pages have "Write a review" (stars, text, up to 3 photos). Only verified buyers (checked against their Shopify orders by email) can post; reviews go to Judge.me with your moderation settings. Reviewers earn +20 stars (+50 with a photo) in Play To Win, for any rating. A push 10 days after an order asks for a review; turn on Judge.me's own review-request emails too (Judge.me → Settings → Review requests).

**Search** — the magnifier opens `js/search.js` (products, bundles, recipes, pages).

## Spin to win: bonus spins + My rewards
- After the first spin the side tab becomes **My rewards** (latest code, next spins, stars), or **Free spin! 🎁** when one is waiting.
- **Order spin:** the thank-you page claims a bonus spin for each paid order (`claimOrder`); it always wins a 10% or 15% code for the next order.
- **Weekly spin:** once a week (resets Monday) for devices with notifications on; mostly fun slices, 10% sometimes, never if they won a code in the last 30 days. A push goes out Mondays at 11am.
- Odds per spin type: `netlify/lib/spin-config.js` (`orderWeight`, `weeklyWeight`). Device tokens use `BAKERY_SECRET`/`COOKBOOK_SECRET`.

## Customer accounts: Sign in with Google + Apple
My profile has a sign-in card. Once signed in, the profile, favorites, addresses, orders, coupons/rewards tokens and My Sweet Day progress sync to the account (Netlify Blobs store "accounts") and show up on every device. No passwords are stored. Files: `netlify/lib/auth.js`, `netlify/functions/auth.js`, `public/js/auth.js`.

Env vars: `GOOGLE_CLIENT_ID`, `APPLE_CLIENT_ID`, `APPLE_REDIRECT_URI` (optional, default `<site>/profile.html`), `AUTH_SECRET` (any long random text; falls back to BAKERY_SECRET / COOKBOOK_SECRET).

**Google (free):**
1. console.cloud.google.com → create a project "NutriBae".
2. APIs & Services → OAuth consent screen → External → app name NutriBae, your support email, logo, privacy policy + terms links → publish.
3. Credentials → Create credentials → OAuth client ID → Web application.
4. Authorized JavaScript origins: `http://localhost:8888`, `http://localhost`, and your live site (e.g. `https://nutribae.com`). No redirect URI needed.
5. Copy the Client ID into `GOOGLE_CLIENT_ID` (it is public, not a secret).

**Apple (needs the Apple Developer Program, $99/year):**
1. developer.apple.com → Certificates, Identifiers & Profiles → Identifiers → + → App IDs → turn on "Sign in with Apple".
2. Identifiers → + → Services IDs → e.g. `com.nutribae.web` → turn on Sign in with Apple → Configure: primary App ID from step 1, Domains: your live domain, Return URL: `https://yourdomain.com/profile.html`.
3. Put the Services ID in `APPLE_CLIENT_ID` and the return URL in `APPLE_REDIRECT_URI`.
4. Apple only works on the live https site (not on localhost).
