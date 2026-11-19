/* ==========================================================================
   Product page (product.html?handle=...)
   Photos, price, description and Add to cart from Shopify; real customer
   reviews from Judge.me (/api/reviews).
   ========================================================================== */

(function () {
  const handle = new URLSearchParams(location.search).get("handle") || "";
  const root = document.querySelector("[data-pdp]");
  const reviewsBox = document.querySelector("[data-reviews]");

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function stars(rating, size = 18) {
    const pct = Math.max(0, Math.min(100, (rating / 5) * 100));
    const star = '<path d="M10 1.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L10 15l-5.2 2.7 1-5.9L1.5 7.7l5.9-.8z"/>';
    const row = Array.from({ length: 5 }, (_, i) => `<svg viewBox="0 0 20 20" width="${size}" height="${size}" x="${i * (size + 2)}">${star}</svg>`).join("");
    const w = 5 * size + 8;
    return `<span class="stars" role="img" aria-label="${rating.toFixed(1)} out of 5 stars" style="width:${w}px;height:${size}px">
      <span class="stars__base"><svg width="${w}" height="${size}" aria-hidden="true">${row}</svg></span>
      <span class="stars__fill" style="width:${pct}%"><svg width="${w}" height="${size}" aria-hidden="true">${row}</svg></span>
    </span>`;
  }

  function renderNotFound() {
    root.innerHTML = `<div class="pdp__empty">
      <h1 class="h-section">We couldn’t find that product</h1>
      <p>It may have sold out or moved.</p>
      <a class="btn" href="shop.html">See all products</a>
    </div>`;
  }

  function render(p) {
    document.title = `${p.name} — NutriBae`;
    const imgs = (p.images && p.images.length ? p.images : (p.image ? [{ url: p.image, alt: p.name }] : []));
    const thumbs = imgs.length > 1
      ? `<div class="pdp__thumbs" role="list">${imgs.map((im, i) => `
          <button class="pdp__thumb${i === 0 ? " is-active" : ""}" type="button" role="listitem" data-thumb="${i}" aria-label="Show photo ${i + 1} of ${imgs.length}">
            <img src="${esc(im.url)}" alt="" loading="lazy">
          </button>`).join("")}</div>`
      : "";

    root.innerHTML = `
      <nav class="pdp__crumbs" aria-label="Breadcrumb"><a href="shop.html">Shop</a> <span aria-hidden="true">/</span> <span>${esc(p.name)}</span></nav>
      <div class="pdp__grid">
        <div class="pdp__gallery">
          <div class="pdp__main">
            ${imgs.length ? `<img src="${esc(imgs[0].url)}" alt="${esc(imgs[0].alt || p.name)}" data-main-img>` : `<div class="ph">Photo coming soon</div>`}
          </div>
          ${thumbs}
        </div>
        <div class="pdp__info">
          ${p.category ? `<span class="tag">${esc(p.category)}</span>` : ""}
          <div class="pdp__titlerow"><h1 class="pdp__title">${esc(p.name)}</h1><button class="fav-btn fav-btn--lg" type="button" data-fav-product="${esc(p.id)}" aria-pressed="false" aria-label="Save to favorites"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.9c0 5.4-7.5 10-7.5 10z"/></svg></button></div>
          <a class="pdp__rating" href="#reviews" data-rating-link hidden></a>
          <p class="pdp__price">${window.NB_formatPrice(p.price)}</p>
          ${p.size ? `<p class="pdp__meta">${esc(p.size)}</p>` : ""}
          ${p.price != null ? `
          <fieldset class="plan">
            <legend class="sr-only">Purchase option</legend>
            <label class="plan__opt">
              <input type="radio" name="plan" value="sub" checked>
              <span class="plan__body">
                <span class="plan__top"><strong>Subscribe &amp; save 15%</strong><span class="plan__price">${window.NB_formatPrice(window.NB_linePrice(p, "sub"))}</span></span>
                <span class="plan__note">Sweeten your routine. ${esc(window.NB_SUBSCRIBE.label)}, free shipping, skip or cancel anytime.</span>
              </span>
            </label>
            <label class="plan__opt">
              <input type="radio" name="plan" value="once">
              <span class="plan__body">
                <span class="plan__top"><strong>One-time purchase</strong><span class="plan__price">${window.NB_formatPrice(p.price)}</span></span>
              </span>
            </label>
          </fieldset>` : ""}
          <div class="pdp__buy">
            <div class="qty qty--lg" role="group" aria-label="Quantity">
              <button type="button" aria-label="Decrease quantity" data-pdp-qty="-1">−</button>
              <span data-pdp-qty-val>1</span>
              <button type="button" aria-label="Increase quantity" data-pdp-qty="1">+</button>
            </div>
            ${p.available === false || p.price == null
              ? `<button class="btn pdp__add" type="button" disabled>${p.price == null ? "Coming soon" : "Sold out"}</button>`
              : `<button class="btn pdp__add" type="button" data-pdp-add>Add to cart</button>`}
          </div>
          <ul class="pdp__perks">
            <li>Free shipping in the USA</li>
            <li>Free Wellness Made Sweet cookbook with any purchase</li>
          </ul>
          <div class="pdp__desc">${p.descriptionHtml || (p.description ? `<p>${esc(p.description)}</p>` : "")}</div>
          ${(p.details || []).map((d) => `
            <details class="product-card__more">
              <summary>${esc(d.title)}</summary>
              ${d.list ? `<ul>${d.list.map((li) => `<li>${esc(li)}</li>`).join("")}</ul>` : `<p>${esc(d.text)}</p>`}
            </details>`).join("")}
          ${p.disclaimer ? `<p class="product-card__disclaimer">${esc(p.disclaimer)}</p>` : ""}
        </div>
      </div>`;

    groupBadges(root.querySelector(".pdp__desc"));

    // Gallery
    const main = root.querySelector("[data-main-img]");
    root.querySelectorAll("[data-thumb]").forEach((b) => b.addEventListener("click", () => {
      const im = imgs[Number(b.dataset.thumb)];
      main.src = im.url; main.alt = im.alt || p.name;
      root.querySelectorAll("[data-thumb]").forEach((x) => x.classList.toggle("is-active", x === b));
    }));

    // Quantity + add to cart
    let qty = 1;
    const qv = root.querySelector("[data-pdp-qty-val]");
    root.querySelectorAll("[data-pdp-qty]").forEach((b) => b.addEventListener("click", () => {
      qty = Math.max(1, Math.min(10, qty + Number(b.dataset.pdpQty)));
      qv.textContent = qty;
    }));
    const add = root.querySelector("[data-pdp-add]");
    if (add) add.addEventListener("click", () => {
      const plan = root.querySelector('input[name="plan"]:checked')?.value || "once";
      window.NB_cart.add(p.id, qty, plan);
      window.NB_openDrawer && window.NB_openDrawer("cart-drawer");
    });

    loadReviews(p);
    setupWriteReview(p);
    window.NB_paintFavs && window.NB_paintFavs();
  }

  // The Shopify description has the certification icons (Gluten-free, Vegan…)
  // as images in one paragraph. Images are blocks on this site, so they would
  // stack; lay any paragraph that holds only icons out as one row.
  function groupBadges(desc) {
    if (!desc) return;
    desc.querySelectorAll("p").forEach((el) => {
      const imgs = el.querySelectorAll("img");
      const onlyImgs = [...el.childNodes].every((n) => n.nodeName === "IMG" || n.nodeName === "BR" || (n.nodeType === 3 && !n.textContent.trim()));
      if (imgs.length > 1 && onlyImgs) {
        el.classList.add("pdp__badges");
        imgs.forEach((img) => img.removeAttribute("style"));
      }
    });
  }

  /* ---------- Reviews (Judge.me) ---------- */
  let page = 1;

  async function loadReviews(p) {
    try {
      const res = await fetch(`/api/reviews?handle=${encodeURIComponent(p.id)}&page=${page}`);
      if (!res.ok) return; // reviews not connected: keep the section hidden (the write form needs Judge.me too)
      const data = await res.json();
      if (page === 1) renderSummary(data.summary);
      appendReviews(data.reviews);
      const more = document.querySelector("[data-reviews-more]");
      more.hidden = !data.hasMore;
      more.onclick = () => { page += 1; loadReviews(p); };
      reviewsBox.hidden = false;
    } catch { /* offline */ }
  }

  function renderSummary(s) {
    const box = document.querySelector("[data-reviews-summary]");
    const link = root.querySelector("[data-rating-link]");
    if (!s.total) {
      box.innerHTML = `<p class="reviews__empty">No reviews yet. Bought this? Be the first to share how it tastes.</p>`;
      return;
    }
    if (link) {
      link.innerHTML = `${stars(s.average, 16)} <span>${s.average.toFixed(1)} · ${s.total.toLocaleString("en-US")} reviews</span>`;
      link.hidden = false;
    }
    box.innerHTML = `
      <div class="reviews__score">
        <p class="reviews__avg">${s.average.toFixed(1)}</p>
        ${stars(s.average, 22)}
        <p class="reviews__count">Based on ${s.total.toLocaleString("en-US")} reviews</p>
      </div>
      <ul class="reviews__bars">
        ${s.breakdown.map((b) => {
          const pct = s.total ? Math.round((b.count / s.total) * 100) : 0;
          return `<li><span>${b.stars} ★</span><span class="reviews__bar"><span style="width:${pct}%"></span></span><span>${b.count.toLocaleString("en-US")}</span></li>`;
        }).join("")}
      </ul>`;
  }

  function appendReviews(list) {
    const ul = document.querySelector("[data-reviews-list]");
    ul.insertAdjacentHTML("beforeend", list.map((r) => `
      <li class="review">
        <div class="review__head">
          ${stars(r.rating, 16)}
          <time datetime="${esc(r.date)}">${r.date ? new Date(r.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}</time>
        </div>
        <p class="review__name">${esc(r.name)}${r.verified ? ` <span class="review__badge">Verified buyer</span>` : ""}</p>
        ${r.title ? `<h3 class="review__title">${esc(r.title)}</h3>` : ""}
        <p class="review__body">${esc(r.body)}</p>
        ${r.pictures.length ? `<div class="review__pics">${r.pictures.slice(0, 4).map((u) => `<img src="${esc(u)}" alt="Photo from ${esc(r.name)}" loading="lazy">`).join("")}</div>` : ""}
      </li>`).join(""));
  }

  /* ---------- Write a review (verified buyers, photos welcome) ---------- */
  function setupWriteReview(p) {
    const box = document.querySelector("[data-write-review]");
    if (!box) return;
    let rating = 0, pics = [];
    let profile = {};
    try { profile = JSON.parse(localStorage.getItem("nb_spin_profile")) || {}; } catch { /* none */ }
    box.innerHTML = `
      <div class="wr__cta">
        <div><strong>Tried it? Tell us how it tastes</strong><span>Earn <b>+50 ⭐</b> in Play To Win with a photo (+20 without)</span></div>
        <button class="btn" type="button" data-wr-open>Write a review</button>
      </div>
      <form class="wr__form" data-wr-form hidden novalidate>
        <h3>Review ${esc(p.shortName || p.name)}</h3>
        <div class="wr__stars" role="radiogroup" aria-label="Your rating">
          ${[1, 2, 3, 4, 5].map((n) => `<button type="button" role="radio" aria-checked="false" aria-label="${n} star${n > 1 ? "s" : ""}" data-wr-star="${n}">★</button>`).join("")}
        </div>
        <label>Title <input name="title" maxlength="120" placeholder="Sum it up in a few words"></label>
        <label>Your review <textarea name="body" rows="4" maxlength="3000" required placeholder="How does it taste? How do you use it?"></textarea></label>
        <div class="wr__photos">
          <label class="wr__add"><input type="file" accept="image/*" multiple data-wr-files hidden><span>📸 Add photos</span></label>
          <div class="wr__thumbs" data-wr-thumbs></div>
        </div>
        <div class="wr__row">
          <label>Name <input name="name" maxlength="60" autocomplete="given-name" required value="${esc(profile.firstName || "")}"></label>
          <label>Order email <input name="email" type="email" autocomplete="email" required value="${esc(profile.email || "")}"></label>
        </div>
        <p class="wr__fine">Only verified buyers can post. Use the email from your order. Stars are given for any honest review, whatever the rating.</p>
        <button class="btn btn--block" type="submit">Post my review</button>
        <p class="wr__msg" role="status" data-wr-msg></p>
      </form>`;
    const form = box.querySelector("[data-wr-form]");
    const msg = box.querySelector("[data-wr-msg]");
    const paintStars = () => box.querySelectorAll("[data-wr-star]").forEach((b) => {
      const on = Number(b.dataset.wrStar) <= rating;
      b.classList.toggle("is-on", on); b.setAttribute("aria-checked", String(Number(b.dataset.wrStar) === rating));
    });
    const paintThumbs = () => {
      box.querySelector("[data-wr-thumbs]").innerHTML = pics.map((d, i) => `<span class="wr__thumb"><img src="${d}" alt=""><button type="button" aria-label="Remove photo" data-wr-rm="${i}">✕</button></span>`).join("");
    };
    // Shrink photos in the browser so uploads stay small.
    const shrink = (file) => new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => {
        const img = new Image();
        img.onload = () => {
          const k = Math.min(1, 1200 / Math.max(img.width, img.height));
          const c = document.createElement("canvas");
          c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL("image/jpeg", 0.82));
        };
        img.onerror = () => resolve(null);
        img.src = r.result;
      };
      r.onerror = () => resolve(null);
      r.readAsDataURL(file);
    });
    box.addEventListener("click", (e) => {
      if (e.target.closest("[data-wr-open]")) { form.hidden = false; box.querySelector(".wr__cta").hidden = true; form.querySelector("[data-wr-star]").focus(); return; }
      const st = e.target.closest("[data-wr-star]");
      if (st) { rating = Number(st.dataset.wrStar); paintStars(); return; }
      const rm = e.target.closest("[data-wr-rm]");
      if (rm) { pics.splice(Number(rm.dataset.wrRm), 1); paintThumbs(); }
    });
    box.querySelector("[data-wr-files]").addEventListener("change", async (e) => {
      for (const f of [...e.target.files].slice(0, 3 - pics.length)) { const d = await shrink(f); if (d) pics.push(d); }
      e.target.value = ""; paintThumbs();
    });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!rating) { msg.textContent = "Tap the stars to rate it."; return; }
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = "Posting…"; msg.textContent = "";
      try {
        const res = await fetch("/api/reviews", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            handle: p.id, rating, title: form.title.value, body: form.body.value, name: form.name.value, email: form.email.value, photos: pics,
            bakeryToken: (() => { try { return localStorage.getItem("nb_bakery_token") || ""; } catch { return ""; } })(),
          }),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.error || "We couldn’t post your review. Try again soon.");
        box.innerHTML = `<div class="wr__done"><strong>Thank you, ${esc(form.name.value)}! 💗</strong><span>Your review was sent and will show up here soon.${d.earned ? ` You earned <b>+${d.earned} ⭐</b> in Play To Win.` : ` <a href="bakery.html">Play To Win</a> to collect stars next time.`}</span></div>`;
      } catch (err) {
        msg.textContent = err.message; btn.disabled = false; btn.textContent = "Post my review";
      }
    });
    if (location.hash === "#write-review") setTimeout(() => { box.scrollIntoView({ block: "center" }); box.querySelector("[data-wr-open]").click(); }, 400);
  }

  /* ---------- Start once products are loaded ---------- */
  function start() {
    const p = window.NB_findProduct(handle);
    p ? render(p) : renderNotFound();
  }
  if (window.NB_productsLoaded) start();
  else window.addEventListener("nb:products", start, { once: true });
})();
