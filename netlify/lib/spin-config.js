/* Spin to win prizes. The ORDER must match the wheel drawn in public/js/spin.js
   (12 slices). The server picks the prize, so the odds can't be changed from
   the browser. weight = chance on the first spin; birthdayWeight = chance on
   the birthday spin (every birthday spin wins). percent > 15 never wins. */
const MAX_PERCENT = 15;
const CODE_DAYS = 30; // each code expires after this many days

// orderWeight = bonus spin after an order (always wins a code for the NEXT order).
// weeklyWeight = weekly spin for app users with notifications on (mostly fun,
// sometimes 10%; no discount if they won one in the last 30 days).
const SLICES = [
  { label: "Almost",   percent: 0,  weight: 15, birthdayWeight: 0,  orderWeight: 0,  weeklyWeight: 20 },
  { label: "10% OFF",  percent: 10, weight: 25, birthdayWeight: 35, orderWeight: 40, weeklyWeight: 10 },
  { label: "No luck",  percent: 0,  weight: 15, birthdayWeight: 0,  orderWeight: 0,  weeklyWeight: 20 },
  { label: "15% OFF",  percent: 15, weight: 10, birthdayWeight: 15, orderWeight: 10, weeklyWeight: 0 },
  { label: "Sorry...", percent: 0,  weight: 15, birthdayWeight: 0,  orderWeight: 0,  weeklyWeight: 20 },
  { label: "30% OFF",  percent: 30, weight: 0,  birthdayWeight: 0,  orderWeight: 0,  weeklyWeight: 0 },
  { label: "Almost",   percent: 0,  weight: 0,  birthdayWeight: 0,  orderWeight: 0,  weeklyWeight: 10 },
  { label: "10% OFF",  percent: 10, weight: 20, birthdayWeight: 35, orderWeight: 40, weeklyWeight: 10 },
  { label: "No luck",  percent: 0,  weight: 0,  birthdayWeight: 0,  orderWeight: 0,  weeklyWeight: 10 },
  { label: "15% OFF",  percent: 15, weight: 0,  birthdayWeight: 15, orderWeight: 10, weeklyWeight: 0 },
  { label: "Sorry...", percent: 0,  weight: 0,  birthdayWeight: 0,  orderWeight: 0,  weeklyWeight: 0 },
  { label: "30% OFF",  percent: 30, weight: 0,  birthdayWeight: 0,  orderWeight: 0,  weeklyWeight: 0 },
].map((s) => (s.percent > MAX_PERCENT ? { ...s, weight: 0, birthdayWeight: 0, orderWeight: 0, weeklyWeight: 0 } : s));

function pick(kind, rand = Math.random, { noDiscount = false } = {}) {
  const key = { birthday: "birthdayWeight", order: "orderWeight", weekly: "weeklyWeight" }[kind] || "weight";
  const w = (s) => (noDiscount && s.percent > 0 ? 0 : s[key]);
  const total = SLICES.reduce((a, s) => a + w(s), 0);
  let r = rand() * total;
  for (let i = 0; i < SLICES.length; i++) { r -= w(SLICES[i]); if (r < 0) return i; }
  return SLICES.findIndex((s) => w(s) > 0);
}

module.exports = { SLICES, MAX_PERCENT, CODE_DAYS, pick };
