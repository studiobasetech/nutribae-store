// cookbook.html?t=<token>: the link in the order email. Saves access on this
// device (unlocks the Recipes tab) and offers the PDF download.
(function () {
  const $ = (s) => document.querySelector(s);
  const qs = new URLSearchParams(location.search);
  let token = qs.get("t");
  try { token = token || localStorage.getItem("nb_cookbook"); } catch { /* ignore */ }
  const fail = (msg) => {
    $("[data-cookbook-title]").textContent = "This link didn’t work";
    $("[data-cookbook-msg]").innerHTML = msg;
  };
  if (!token) return fail('Open the cookbook link from your order confirmation email, or <a href="shop.html">get it free with any purchase</a>.');
  fetch(`/api/cookbook?t=${encodeURIComponent(token)}`)
    .then((r) => {
      if (!r.ok) return fail('Please open the link from your order email again, or email us and we’ll help.');
      try { localStorage.setItem("nb_cookbook", token); } catch { /* ignore */ }
      if (qs.get("t")) history.replaceState(null, "", location.pathname);
      $("[data-cookbook-title]").textContent = "Your cookbook is ready";
      $("[data-cookbook-msg]").textContent = "Download the PDF, and find all 25 recipes, with cook mode and timers, in the Recipes tab on this device.";
      $("[data-cookbook-pdf]").href = `/api/cookbook?t=${encodeURIComponent(token)}&get=pdf`;
      $("[data-cookbook-btns]").hidden = false;
    })
    .catch(() => fail("We couldn’t check your link right now. Try again in a minute."));
})();
