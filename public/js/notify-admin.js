// notify.html: send an announcement to everyone who opted in to deals.
(function () {
  const f = document.querySelector("[data-notify-form]");
  const msg = document.querySelector("[data-notify-msg]");
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!confirm("Send this notification to everyone now?")) return;
    const btn = f.querySelector("button");
    btn.disabled = true; msg.textContent = "Sending…";
    try {
      const res = await fetch("/api/push-send", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": f.key.value },
        body: JSON.stringify({ title: f.title.value, body: f.body.value, url: f.url.value }),
      });
      const d = await res.json().catch(() => ({}));
      msg.textContent = res.ok ? `Sent to ${d.sent} of ${d.devices} devices.${d.removed ? ` ${d.removed} old devices removed.` : ""}` : (d.error || "Couldn’t send.");
    } catch { msg.textContent = "Couldn’t send. Check your connection."; }
    btn.disabled = false;
  });
})();
