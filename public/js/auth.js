/* ==========================================================================
   Customer accounts in the browser: Google, Apple, or email + password.
   Once signed in, this device's NutriBae data (profile, favorites,
   addresses, orders, coupons, rewards, My Sweet Day progress) is merged with
   the account and kept in sync, so it shows up on every device.
   window.NB_auth: { user, signedIn, google(el), apple(), emailSignUp(), emailSignIn(),
                     resetStart(), resetFinish(), signOut(), deleteAccount(), onChange(fn) }
   ========================================================================== */
(function () {
  const SESSION = "nb_auth";
  const USER = "nb_auth_user";
  const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const set = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* ignore */ } };
  const parse = (v, d) => { try { return v == null ? d : JSON.parse(v); } catch { return d; } };

  // What an account keeps. Values are the localStorage keys.
  const KEYS = {
    profile: "nb_spin_profile", favProducts: "nb_fav_products", addresses: "nb_addresses", orders: "nb_orders",
    app: "nb_app_v1", spinToken: "nb_spin_token", spinResult: "nb_spin_result", bakeryToken: "nb_bakery_token", cookbook: "nb_cookbook",
  };
  const RAW = new Set(["spinToken", "bakeryToken", "cookbook"]); // plain strings, not JSON

  function readLocal() {
    const d = {};
    for (const [k, key] of Object.entries(KEYS)) {
      const v = get(key);
      if (v == null || v === "") continue;
      d[k] = RAW.has(k) ? v : parse(v, null);
    }
    return d;
  }
  function writeLocal(d) {
    for (const [k, key] of Object.entries(KEYS)) {
      if (d[k] == null) continue;
      set(key, RAW.has(k) ? String(d[k]) : JSON.stringify(d[k]));
    }
  }

  /* ---------- merging two devices (nothing is lost) ---------- */
  const unionBy = (a = [], b = [], key) => { const seen = new Set(); return [...a, ...b].filter((x) => { const k = key ? x && x[key] : x; if (k == null || seen.has(k)) return false; seen.add(k); return true; }); };
  function mergeApp(a, b) {
    if (!a) return b; if (!b) return a;
    const days = { ...b.days };
    for (const [d, v] of Object.entries(a.days || {})) {
      const o = days[d];
      if (!o) { days[d] = v; continue; }
      days[d] = {
        water: Math.max(o.water || 0, v.water || 0),
        scoops: { ...(o.scoops || {}), ...(v.scoops || {}) },
        activity: (v.activity && (!o.activity || (v.activity.steps || 0) >= (o.activity.steps || 0))) ? v.activity : o.activity,
        feel: v.feel || o.feel,
      };
    }
    return {
      ...b, ...a,
      days,
      points: Math.max(a.points || 0, b.points || 0),
      history: unionBy(a.history, b.history, "key").slice(0, 300),
      badges: unionBy(a.badges, b.badges),
      favs: unionBy(a.favs, b.favs),
      pantry: unionBy(a.pantry, b.pantry),
      cooked: unionBy(a.cooked, b.cooked, "at"),
      swaps: unionBy(a.swaps, b.swaps),
      refill: { ...(b.refill || {}), ...(a.refill || {}) },
      plan: a.plan || b.plan || null,
    };
  }
  function merge(local, remote) {
    const out = { ...remote, ...local };
    out.profile = { ...(remote.profile || {}), ...(local.profile || {}) };
    out.favProducts = unionBy(local.favProducts, remote.favProducts).slice(0, 50);
    let addrs = unionBy(local.addresses, remote.addresses, "id").slice(0, 10);
    if (addrs.filter((x) => x.def).length > 1) { let seen = false; addrs = addrs.map((x) => { if (x.def && !seen) { seen = true; return x; } return { ...x, def: false }; }); }
    out.addresses = addrs;
    out.orders = unionBy(local.orders, remote.orders, "id").sort((x, y) => (y.at || 0) - (x.at || 0)).slice(0, 30);
    out.app = mergeApp(local.app, remote.app);
    for (const k of ["spinToken", "bakeryToken", "cookbook", "spinResult"]) out[k] = local[k] || remote[k] || undefined;
    return out;
  }

  /* ---------- server ---------- */
  async function api(a, body, method = "POST") {
    const res = await fetch(`/api/auth?a=${a}`, {
      method, headers: { "Content-Type": "application/json", ...(get(SESSION) ? { "x-nb-auth": get(SESSION) } : {}) },
      body: method === "POST" ? JSON.stringify(body || {}) : undefined,
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { const e = new Error(d.error || "Something went wrong."); e.status = res.status; throw e; }
    return d;
  }

  const listeners = [];
  const state = { user: parse(get(USER), null) };
  const emit = () => { listeners.forEach((f) => { try { f(state.user); } catch { /* ignore */ } }); window.dispatchEvent(new Event("nb:auth")); };

  let syncTimer = null, syncing = false;
  function queueSync() {
    if (!get(SESSION)) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(pushNow, 1500);
  }
  async function pushNow() {
    if (!get(SESSION) || syncing) return;
    syncing = true;
    try { await api("sync", { data: readLocal() }); } catch (err) { if (err.status === 401) signOutLocal(); }
    syncing = false;
  }

  async function finishSignIn(d) {
    set(SESSION, d.session);
    const merged = merge(readLocal(), d.data || {});
    if (d.user && d.user.name && !(merged.profile && merged.profile.firstName)) merged.profile = { ...(merged.profile || {}), firstName: d.user.name.split(" ")[0] };
    if (d.user && d.user.email && !(merged.profile && merged.profile.email)) merged.profile = { ...(merged.profile || {}), email: d.user.email };
    if (d.user && d.user.birthday && !(merged.profile && merged.profile.birthday)) merged.profile = { ...(merged.profile || {}), birthday: d.user.birthday };
    writeLocal(merged);
    state.user = d.user;
    set(USER, JSON.stringify(d.user));
    await api("sync", { data: merged }).catch(() => {});
    emit();
    // Pages read their data on load: open the next page, or refresh this one.
    set("nb_guest", null);
    setTimeout(() => { if (window.NB_auth && window.NB_auth.afterSignIn) location.href = window.NB_auth.afterSignIn; else location.reload(); }, 400);
  }

  // On every page while signed in: pull the account, merge, and push back.
  async function refreshFromServer() {
    if (!get(SESSION)) return;
    try {
      const d = await api("me", null, "GET");
      const local = readLocal();
      const merged = merge(local, d.data || {});
      const changed = JSON.stringify(merged) !== JSON.stringify(local);
      if (changed) writeLocal(merged);
      state.user = d.user; set(USER, JSON.stringify(d.user)); emit();
      if (JSON.stringify(merged) !== JSON.stringify(d.data || {})) queueSync();
      // New data from another device: show it (once per visit).
      let shown = false; try { shown = sessionStorage.getItem("nb_auth_pulled") === "1"; sessionStorage.setItem("nb_auth_pulled", "1"); } catch { /* ignore */ }
      if (changed && !shown) location.reload();
    } catch (err) { if (err.status === 401) signOutLocal(); }
  }

  function signOutLocal() {
    set(SESSION, null); set(USER, null); set("nb_guest", null); state.user = null; emit();
  }

  /* ---------- Google / Apple ---------- */
  let cfg = null;
  const config = () => cfg || (cfg = fetch("/api/auth?a=config").then((r) => r.json()).catch(() => ({})));
  const loadScript = (src) => new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) return res();
    const sc = document.createElement("script"); sc.src = src; sc.async = true; sc.onload = res; sc.onerror = () => rej(new Error("Could not load sign-in.")); document.head.appendChild(sc);
  });

  // Renders Google's official button into `el`.
  async function google(el, onError) {
    const c = await config();
    if (!c.google) { el.innerHTML = `<button class="auth-btn auth-btn--google" type="button" disabled><span class="auth-btn__g" aria-hidden="true">G</span>Continue with Google</button>`; return false; }
    await loadScript("https://accounts.google.com/gsi/client");
    const { nonce, ticket } = await api("nonce", null, "GET");
    window.google.accounts.id.initialize({
      client_id: c.google, nonce, ux_mode: "popup", auto_select: false, itp_support: true,
      callback: async (resp) => {
        try { await finishSignIn(await api("google", { credential: resp.credential, ticket })); }
        catch (err) { onError && onError(err.message); }
      },
    });
    el.innerHTML = "";
    window.google.accounts.id.renderButton(el, { type: "standard", theme: "outline", size: "large", shape: "pill", text: "continue_with", logo_alignment: "left", width: Math.min(360, el.clientWidth || 320) });
    return true;
  }

  async function apple() {
    const c = await config();
    if (!c.apple) throw new Error("Apple sign-in isn’t set up yet.");
    await loadScript("https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js");
    const { nonce, ticket } = await api("nonce", null, "GET");
    window.AppleID.auth.init({ clientId: c.apple, scope: "name email", redirectURI: c.appleRedirect, usePopup: true, nonce });
    let r;
    try { r = await window.AppleID.auth.signIn(); }
    catch (err) { if (err && err.error === "popup_closed_by_user") return; throw new Error("Apple sign-in was cancelled or blocked. Try again."); }
    const n = r.user && r.user.name ? [r.user.name.firstName, r.user.name.lastName].filter(Boolean).join(" ") : "";
    await finishSignIn(await api("apple", { id_token: r.authorization.id_token, ticket, name: n }));
  }

  /* ---------- Email + password ---------- */
  const emailSignUp = async (name, email, password, birthday) => finishSignIn(await api("signup", { name, email, password, birthday }));
  const emailSignIn = async (email, password) => finishSignIn(await api("login", { email, password }));
  const resetStart = (email) => api("reset-start", { email });
  const resetFinish = async (email, code, password) => finishSignIn(await api("reset-finish", { email, code, password }));

  async function signOut() {
    await pushNow().catch(() => {});
    try { window.google && window.google.accounts && window.google.accounts.id.disableAutoSelect(); } catch { /* ignore */ }
    signOutLocal();
  }
  async function deleteAccount() {
    await api("delete");
    signOutLocal();
  }

  /* ---------- keep the account in sync ---------- */
  ["nb:favs", "nb:app"].forEach((ev) => window.addEventListener(ev, queueSync));
  // localStorage writes from other scripts (addresses, orders, coupons…)
  const origSet = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) {
    origSet.call(this, k, v);
    if (this === window.localStorage && Object.values(KEYS).includes(k)) queueSync();
  };
  window.addEventListener("pagehide", () => {
    if (!get(SESSION) || !syncTimer) return;
    clearTimeout(syncTimer);
    try { fetch("/api/auth?a=sync", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json", "x-nb-auth": get(SESSION) }, body: JSON.stringify({ data: readLocal() }) }); } catch { /* ignore */ }
  });

  window.NB_auth = {
    get user() { return state.user; },
    get signedIn() { return !!get(SESSION); },
    config, google, apple, emailSignUp, emailSignIn, resetStart, resetFinish, signOut, deleteAccount, refresh: refreshFromServer,
    onChange(fn) { listeners.push(fn); },
  };
  refreshFromServer();
})();
