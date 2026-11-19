/* Sign-in page (login.html): opens from the profile icon before My profile.
   Tabs: Sign in · Create account. Google, Apple, or email + password,
   plus "Forgot password?" with a 6-digit email code. Signed in already →
   straight to My profile. */
(function () {
  const next = new URLSearchParams(location.search).get("next");
  const dest = next && /^[a-z-]+\.html(#[a-z-]+)?$/.test(next) ? next : "profile.html";
  let signed = false; try { signed = !!localStorage.getItem("nb_auth"); } catch { /* ignore */ }
  if (signed) { location.replace(dest); return; }

  const $ = (s) => document.querySelector(s);
  const form = $("[data-lg-form]");
  const msg = $("[data-lg-msg]");
  const say = (t, good) => { msg.textContent = t || ""; msg.classList.toggle("is-good", !!good); };
  const field = (n) => form.querySelector(`[data-field="${n}"]`);
  let mode = new URLSearchParams(location.search).get("mode") === "signup" ? "signup" : "signin"; // signin | signup | reset | reset2
  let resetEmail = "";

  const TEXT = {
    signin: { title: "Welcome back, bae\u00a0💗", sub: "Sign in to see your profile, orders and rewards on every device.", submit: "Sign in", apple: "Continue with Apple" },
    signup: { title: "Join NutriBae\u00a0💗", sub: "Create your free account to keep your coupons, favorites and rewards on every device.", submit: "Create my account", apple: "Sign up with Apple" },
    reset: { title: "Reset your password", sub: "Enter your email and we’ll send you a 6-digit code.", submit: "Send my code" },
    reset2: { title: "Check your email", sub: "Enter the 6-digit code we sent and choose a new password.", submit: "Save new password" },
  };

  function draw() {
    const t = TEXT[mode];
    $("[data-lg-title]").textContent = t.title;
    $("[data-lg-sub]").textContent = t.sub;
    $("[data-lg-submit]").textContent = t.submit;
    if (t.apple) $("[data-lg-apple-label]").textContent = t.apple;
    const resetting = mode === "reset" || mode === "reset2";
    document.querySelectorAll("[data-lg-tab]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.lgTab === mode)));
    $(".lg-tabs").hidden = resetting;
    $(".lg-btns").hidden = resetting;
    document.querySelectorAll(".lg-panel .lg-or").forEach((el) => { el.hidden = resetting; });
    $("#lg-panel").setAttribute("aria-labelledby", mode === "signup" ? "tab-up" : "tab-in");
    field("name").hidden = mode !== "signup";
    field("birthday").hidden = mode !== "signup";
    field("email").hidden = mode === "reset2";
    field("code").hidden = mode !== "reset2";
    field("password").hidden = mode === "reset";
    $("[data-lg-pwhint]").hidden = !(mode === "signup" || mode === "reset2");
    form.password.autocomplete = mode === "signin" ? "current-password" : "new-password";
    form.password.placeholder = mode === "signin" ? "Your password" : "Create a password";
    field("password").firstChild.textContent = mode === "reset2" ? "New password" : "Password";
    $("[data-lg-forgot]").hidden = mode !== "signin";
    $("[data-lg-back]").hidden = !resetting;
    say("");
  }

  document.querySelectorAll("[data-lg-tab]").forEach((b) => b.addEventListener("click", () => { mode = b.dataset.lgTab; draw(); }));
  $("[data-lg-forgot]").addEventListener("click", () => { mode = "reset"; draw(); form.email.focus(); });
  $("[data-lg-back]").addEventListener("click", () => { mode = "signin"; draw(); });
  $("[data-lg-showpw]").addEventListener("click", (e) => {
    const show = form.password.type === "password";
    form.password.type = show ? "text" : "password";
    e.currentTarget.textContent = show ? "Hide" : "Show";
    e.currentTarget.setAttribute("aria-label", show ? "Hide password" : "Show password");
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const A = window.NB_auth;
    if (!A) { say("One moment, still loading…"); return; }
    const email = form.email.value.trim();
    const pw = form.password.value;
    const btn = $("[data-lg-submit]");
    const label = btn.textContent;
    if (mode !== "reset2" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { say("Enter a valid email address."); form.email.focus(); return; }
    if (mode === "signup" && !form.name.value.trim()) { say("Add your first name."); form.name.focus(); return; }
    const mm = +form.mm.value, dd = +form.dd.value, yyyy = form.yyyy.value.trim();
    if (mode === "signup") {
      const ok = mm >= 1 && mm <= 12 && dd >= 1 && new Date(2000, mm - 1, dd).getMonth() === mm - 1;
      if (!ok) { say("Add your birthday: month (1–12) and day."); form.mm.focus(); return; }
      if (yyyy && !(/^\d{4}$/.test(yyyy) && +yyyy >= 1900 && +yyyy <= new Date().getFullYear())) { say("Check your birth year, or leave it empty."); form.yyyy.focus(); return; }
    }
    if ((mode === "signin" || mode === "signup" || mode === "reset2") && !pw) { say("Enter your password."); form.password.focus(); return; }
    if (mode === "reset2" && !/^\d{6}$/.test(form.code.value.trim())) { say("Enter the 6-digit code from the email."); form.code.focus(); return; }
    btn.disabled = true; btn.textContent = "One moment…"; say("");
    try {
      if (mode === "signin") await A.emailSignIn(email, pw);
      else if (mode === "signup") await A.emailSignUp(form.name.value.trim(), email, pw, { mm, dd, yyyy: yyyy ? +yyyy : null });
      else if (mode === "reset") {
        const r = await A.resetStart(email);
        resetEmail = email; mode = "reset2"; draw();
        say(r.message || "We sent you a code.", true);
        form.code.focus();
        btn.disabled = false;
        return;
      } else await A.resetFinish(resetEmail, form.code.value.trim(), pw);
      btn.textContent = "Signed in ✓";
    } catch (err) {
      say(err.message);
      btn.disabled = false; btn.textContent = label;
    }
  });

  // Guest: remember the choice so the profile icon stops asking on this device.
  const guest = $("[data-lg-guest]");
  guest.href = dest;
  guest.addEventListener("click", () => { try { localStorage.setItem("nb_guest", "1"); } catch { /* ignore */ } });

  // Google + Apple buttons
  function start(tries = 0) {
    const A = window.NB_auth;
    if (!A) { if (tries < 50) setTimeout(() => start(tries + 1), 100); return; }
    A.afterSignIn = dest; // auth.js goes here after a successful sign-in
    A.google($("[data-lg-google]"), (m) => say(m))
      .then((ok) => { if (!ok) $("[data-lg-social-note]").hidden = false; })
      .catch((err) => say(err.message));
    $("[data-lg-apple]").addEventListener("click", async (e) => {
      const b = e.currentTarget; b.disabled = true; say("");
      try { await A.apple(); } catch (err) { say(err.message); }
      b.disabled = false;
    });
  }
  draw();
  start();
})();
