/* NutriBae service worker — lets the app open offline.
   Network first (so you always see the latest site), cached copy when offline.
   Never caches the API or checkout. Bump VERSION to clear old caches. */
const VERSION = "nb-v9";
const SHELL = [
  "/", "/index.html", "/shop.html", "/recipes.html", "/plan.html", "/my-day.html", "/swap.html",
  "/css/styles.css", "/css/app.css",
  "/js/products.js", "/js/layout.js", "/js/cart.js", "/js/app-store.js", "/js/recipes-data.js",
  "/bakery.html", "/js/bakery.js", "/js/bakery-game.js", "/js/recipes.js", "/js/quizzes-data.js", "/js/plan.js", "/js/myday.js", "/js/swap.js",
  "/assets/images/logo.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/.netlify/")) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && res.type === "basic") {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: req.mode === "navigate" }).then((hit) => hit || caches.match("/my-day.html")))
  );
});

/* ---------- App notifications ---------- */
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  const title = d.title || "NutriBae";
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || "",
    icon: "/assets/images/app-icon-192.png",
    badge: "/assets/images/favicon-32.png",
    tag: d.tag || undefined,
    renotify: !!d.tag,
    data: { url: d.url || "/my-day.html" },
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "/", self.location.origin).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of wins) {
      if (new URL(w.url).origin === self.location.origin) { await w.focus(); return w.navigate(url); }
    }
    return self.clients.openWindow(url);
  })());
});
