/* ==========================================================================
   Scheduled every hour (netlify.toml). Sends each device the reminders it
   turned on, at its own local time:
   - daily check-in at the hour they chose
   - water reminders at 11am and 3pm
   - refill alert on the "reorder by" date My Sweet Day worked out
   - Monday 11am: weekly free spin on the wheel
   ========================================================================== */
const { store, all } = require("../lib/push-store");
const webpush = require("../lib/webpush");

const CHECKIN = [
  { title: "Your sweet check-in 💗", body: "How are you feeling today, bae? Log it in 10 seconds." },
  { title: "Time for something sweet 🍰", body: "Shake, smoothie or a 5-minute recipe? Your NutriBae is waiting." },
  { title: "Keep your streak going 🔥", body: "Tap to log today in My Sweet Day." },
];
const WATER = { title: "Sip sip, bae 💧", body: "Quick water break. Your glasses are waiting in My Sweet Day." };

function local(tz) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date()).map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

async function run(event) {
  if (!process.env.VAPID_PUBLIC_KEY) return { sent: 0 };
  const s = store(event);
  const subs = await all(s);
  let sent = 0, removed = 0;
  for (const sub of subs) {
    const { date, hour } = local(sub.tz || "America/New_York");
    const p = sub.prefs || {};
    const msgs = [];
    if (p.daily && hour === p.hour) msgs.push({ ...CHECKIN[new Date(date).getUTCDate() % CHECKIN.length], url: "/my-day.html#feel", tag: "checkin", once: `checkin:${date}` });
    if (p.water && (hour === 11 || hour === 15)) msgs.push({ ...WATER, url: "/my-day.html#today", tag: "water", once: `water:${date}:${hour}` });
    if (p.refill && hour === (p.hour || 9)) {
      (sub.refills || []).filter((r) => r.date === date).forEach((r) => msgs.push({
        title: "Running low? 🛒", body: `Time to reorder ${r.name} so you don't run out.`, url: "/my-day.html#refill", tag: "refill", once: `refill:${r.name}:${date}`,
      }));
    }
    // Monday 11am: weekly free spin is ready (Spin to win).
    if (new Date(`${date}T12:00:00Z`).getUTCDay() === 1 && hour === 11) {
      msgs.push({ title: "Your weekly free spin is ready 🎡", body: "Spin the NutriBae wheel for a chance at a discount. Good luck, bae!", url: "/shop.html", tag: "spin", once: `spin:${date}` });
    }
    const done = sub.sent || {};
    for (const m of msgs) {
      if (done[m.once]) continue;
      try {
        const r = await webpush.send(sub.subscription, { title: m.title, body: m.body, url: m.url, tag: m.tag });
        if (r.gone) { await s.delete(sub.key); removed++; break; }
        if (r.ok) { done[m.once] = Date.now(); sent++; }
      } catch (err) { console.error("push error:", err.message); }
    }
    // keep the "already sent" list short
    const recent = Object.fromEntries(Object.entries(done).filter(([, t]) => Date.now() - t < 3 * 86400000));
    if (msgs.length) await s.setJSON(sub.key, { ...sub, key: undefined, sent: recent });
  }
  console.log("push-daily", JSON.stringify({ devices: subs.length, sent, removed }));
  return { devices: subs.length, sent, removed };
}

exports.handler = async (event) => {
  const result = await run(event);
  return { statusCode: 200, body: JSON.stringify(result) };
};
