// =====================================================================
//  I Love Smash Burger – order backend (Cloudflare Worker + D1)
//
//  Public API (called by the website):
//    GET  /api/menu                    menu, prices, pickup slots, open/paused
//    POST /api/orders                  place an order → { payUrl } or confirmation
//    GET  /api/orders/:id?t=TOKEN      order status for the customer
//    POST /api/sumup/webhook           SumUp "checkout status changed" callback
//
//  Owner dashboard:
//    GET  /dashboard                   the dashboard app (PIN login)
//    /api/admin/...                    dashboard API (cookie session)
//
//  Test mode (SUMUP_MODE = "mock"): a fake payment page at /mock-pay/:id
// =====================================================================
import { SHOP, ITEMS, SAUCES, WITHOUT } from "./menu.js";
import DASHBOARD_HTML from "./dashboard.html";

const TZ = "Europe/Amsterdam";
const STATUSES = ["pending_payment", "new", "accepted", "ready", "picked_up", "cancelled", "payment_failed"];
const ADMIN_SET = ["new", "accepted", "ready", "picked_up", "cancelled"];

export default {
  async fetch(request, env, ctx) {
    try {
      return await route(request, env, ctx);
    } catch (err) {
      console.error("Unhandled error", err && err.stack || err);
      return json({ error: "server_error" }, 500, corsHeaders(request, env));
    }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(cleanup(env));
  },
};

// ---------------------------------------------------------------- router
async function route(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const method = request.method;
  const cors = corsHeaders(request, env);

  if (method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  // public
  if (path === "/api/menu" && method === "GET") return json(await menuPayload(env), 200, cors);
  if (path === "/api/orders" && method === "POST") return json(...(await createOrder(request, env, ctx, url)), cors);
  let m = path.match(/^\/api\/orders\/([a-f0-9-]{36})$/);
  if (m && method === "GET") return json(...(await orderStatus(m[1], url.searchParams.get("t"), env)), cors);
  if (path === "/api/sumup/webhook" && method === "POST") {
    let body = null;
    try { body = await request.json(); } catch (e) {}
    if (body && body.event_type === "CHECKOUT_STATUS_CHANGED" && typeof body.id === "string") {
      ctx.waitUntil(syncCheckout(body.id, env));
    }
    return new Response(null, { status: 204 });
  }

  // test-mode payment page
  m = path.match(/^\/mock-pay\/([a-f0-9-]{36})$/);
  if (m && env.SUMUP_MODE !== "live") {
    if (method === "GET") return mockPayPage(m[1], url.searchParams.get("t"), env);
    if (method === "POST") return mockPayResult(m[1], request, env);
  }

  // home-screen app manifest for the dashboard (icon = I Love Smash logo)
  if (path === "/manifest.webmanifest" && method === "GET") {
    return new Response(JSON.stringify({
      name: "I Love Smash · Bestellingen", short_name: "Bestellingen",
      start_url: "/dashboard", scope: "/", display: "standalone",
      background_color: "#0A0E1A", theme_color: "#0A0E1A",
      icons: [
        { src: "https://www.ilovesmash.nl/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "https://www.ilovesmash.nl/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
      ],
    }), { headers: { "content-type": "application/manifest+json", "cache-control": "public, max-age=3600" } });
  }

  // dashboard
  if ((path === "/" || path === "/dashboard") && method === "GET") {
    return new Response(DASHBOARD_HTML, { headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-frame-options": "DENY",
      "referrer-policy": "no-referrer",
    }});
  }
  if (path.startsWith("/api/admin/")) return admin(path, request, env, url);

  return json({ error: "not_found" }, 404, cors);
}

// ---------------------------------------------------------------- helpers
function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });
}
function corsHeaders(request, env) {
  const origin = request.headers.get("origin") || "";
  const allowed = String(env.ALLOWED_ORIGIN || "").split(",").map(s => s.trim()).filter(Boolean);
  const ok = allowed.includes("*") || allowed.includes(origin);
  return ok && origin ? {
    "access-control-allow-origin": allowed.includes("*") ? "*" : origin,
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    "vary": "origin",
  } : {};
}
function nowIso() { return new Date().toISOString(); }
function amsNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false }).formatToParts(date);
  const g = t => parts.find(p => p.type === t).value;
  const wd = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }[g("weekday")];
  return { day: `${g("year")}-${g("month")}-${g("day")}`, weekday: wd, mins: (parseInt(g("hour")) % 24) * 60 + parseInt(g("minute")) };
}
const toMins = hhmm => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
const hhmm = mins => `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
function randomToken(bytes = 24) {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function safeEqual(a, b) {
  a = String(a || ""); b = String(b || "");
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
const euro = c => "€ " + (c / 100).toFixed(2).replace(".", ",");
const clean = (s, max) => String(s == null ? "" : s).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
async function getSetting(env, key, fallback = null) {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = ?").bind(key).first();
  return row ? row.value : fallback;
}
async function setSetting(env, key, value) {
  await env.DB.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(key, String(value)).run();
}

// ---------------------------------------------------------------- opening hours & slots
function todaySchedule(now = amsNow()) {
  const h = SHOP.hours[now.weekday];
  if (!h || SHOP.closedDates.includes(now.day)) return null;
  return { open: toMins(h.open), close: toMins(h.close) };
}
function pickupInfo(now = amsNow()) {
  const sch = todaySchedule(now);
  if (!sch) return { openNow: false, asap: false, slots: [], hours: null };
  const lastOrder = sch.close - SHOP.lastOrderMinutes;
  const openNow = now.mins >= sch.open && now.mins < lastOrder;
  const earliest = Math.max(now.mins + SHOP.prepMinutes[0], sch.open + SHOP.prepMinutes[0]);
  const first = Math.ceil(earliest / SHOP.slotMinutes) * SHOP.slotMinutes;
  const slots = [];
  if (now.mins < lastOrder) for (let t = first; t <= sch.close - 5; t += SHOP.slotMinutes) slots.push(hhmm(t));
  return { openNow, asap: openNow, slots, hours: { open: hhmm(sch.open), close: hhmm(sch.close) } };
}

// ---------------------------------------------------------------- menu
async function menuPayload(env) {
  const paused = (await getSetting(env, "paused", "0")) === "1";
  const info = pickupInfo();
  return {
    shop: { name: SHOP.name, pickupAddress: SHOP.pickupAddress, prepMinutes: SHOP.prepMinutes, payAtPickup: SHOP.payAtPickup, hours: SHOP.hours },
    paused, ...info,
    accepting: !paused && (info.asap || info.slots.length > 0),
    items: ITEMS.filter(i => i.available !== false),
    sauces: SAUCES, without: WITHOUT,
    payment: env.SUMUP_MODE === "live" ? "live" : "test",
  };
}

// ---------------------------------------------------------------- pricing (server is the source of truth)
function priceLines(lines) {
  if (!Array.isArray(lines) || lines.length === 0) throw new UserError("empty_cart");
  if (lines.length > 40) throw new UserError("too_many_lines");
  let count = 0, total = 0;
  const out = lines.map(raw => {
    const it = ITEMS.find(i => i.id === raw.id && i.available !== false);
    if (!it) throw new UserError("unknown_item");
    const qty = Number(raw.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > 20) throw new UserError("bad_qty");
    let unit = it.price;
    const line = { id: it.id, name: it.name, qty };
    // combo (fries + included sauce) or an item whose price includes one sauce
    const findSauce = id => { const x = SAUCES.find(x => x.id === id && x.available !== false); if (!x) throw new UserError("bad_sauce"); return x; };
    if (raw.menu) {
      if (it.combo == null) throw new UserError("bad_menu");
      unit += it.combo; line.menu = true;
    }
    if (raw.menu || it.inclSauce) {
      line.sauce = findSauce(raw.sauce).l.nl;            // included, free
    } else if (raw.sauce != null) throw new UserError("bad_sauce");
    const extra = Array.isArray(raw.extraSauces) ? [...new Set(raw.extraSauces)] : [];
    if (extra.length > SAUCES.length) throw new UserError("bad_sauce");
    line.extraSauces = extra.map(id => { const x = findSauce(id); unit += x.price; return x.l.nl; });
    const woList = WITHOUT[it.type] || [];
    const without = Array.isArray(raw.without) ? [...new Set(raw.without)] : [];
    line.without = without.map(id => {
      const w = woList.find(w => w.id === id);
      if (!w) throw new UserError("bad_without");
      return w.l.nl;
    });
    const note = clean(raw.note, 140);
    if (note) line.note = note;
    line.unit = unit; line.sum = unit * qty;
    count += qty; total += line.sum;
    return line;
  });
  if (count > SHOP.maxItems) throw new UserError("too_many_items");
  return { lines: out, total };
}
class UserError extends Error {}

// ---------------------------------------------------------------- create order
async function createOrder(request, env, ctx, url) {
  let body;
  try { body = await request.json(); } catch (e) { return [{ error: "bad_json" }, 400]; }
  try {
    if ((await getSetting(env, "paused", "0")) === "1") throw new UserError("paused");
    const now = amsNow();
    const info = pickupInfo(now);
    let asap = false, pickup;
    if (body.time === "asap") {
      if (!info.asap) throw new UserError("closed");
      asap = true; pickup = hhmm(Math.min(now.mins + SHOP.prepMinutes[1], 24 * 60 - 1));
    } else {
      if (!info.slots.includes(body.time)) throw new UserError("bad_time");
      pickup = body.time;
    }
    const { lines, total } = priceLines(body.lines);
    const c = body.customer || {};
    const name = clean(c.name, 60), phone = clean(c.phone, 20).replace(/\s/g, ""), email = clean(c.email, 120).toLowerCase(), note = clean(c.note, 200);
    if (name.length < 2) throw new UserError("bad_name");
    if (!/^(\+31|0031|0)[1-9][0-9-]{7,11}$/.test(phone) && !/^\+[1-9][0-9]{7,14}$/.test(phone)) throw new UserError("bad_phone");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new UserError("bad_email");
    const pay = body.pay === "at_pickup" ? "at_pickup" : "online";
    if (pay === "at_pickup" && !SHOP.payAtPickup) throw new UserError("bad_pay");
    const lang = body.lang === "en" ? "en" : "nl";

    const id = crypto.randomUUID(), token = randomToken();
    const ctr = await env.DB.prepare("INSERT INTO day_counter (day, last) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET last = last + 1 RETURNING last").bind(now.day).first();
    const number = String(ctr.last).padStart(3, "0");
    const status = pay === "online" ? "pending_payment" : "new";
    const ts = nowIso();
    await env.DB.prepare(`INSERT INTO orders (id, token, number, day, created_at, pickup_at, asap, status, pay_method, paid, name, phone, email, note, lang, items_json, total_cents, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, token, number, now.day, ts, `${now.day} ${pickup}`, asap ? 1 : 0, status, pay, name, phone, email, note || null, lang, JSON.stringify(lines), total, ts).run();

    const order = { id, token, number, total };
    if (pay === "at_pickup") {
      ctx.waitUntil(sendMail(env, email, lang, "confirm", { number, pickup, asap, total, lines }));
      return [{ id, token, number, total_cents: total, status, payUrl: null }, 201];
    }
    const checkout = await createCheckout(env, order, url.origin);
    await env.DB.prepare("UPDATE orders SET sumup_checkout_id = ?, updated_at = ? WHERE id = ?").bind(checkout.id, nowIso(), id).run();
    return [{ id, token, number, total_cents: total, status, payUrl: checkout.url }, 201];
  } catch (e) {
    if (e instanceof UserError) return [{ error: e.message }, 400];
    if (e instanceof PaymentError) return [{ error: "payment_unavailable" }, 502];
    throw e;
  }
}

// ---------------------------------------------------------------- SumUp
class PaymentError extends Error {}
function siteReturnUrl(env, order) {
  const base = String(env.SITE_URL || "").replace(/\/+$/, "") + "/";
  return `${base}?order=${order.id}&t=${encodeURIComponent(order.token)}`;
}
async function createCheckout(env, order, workerOrigin) {
  if (env.SUMUP_MODE !== "live") {
    return { id: "mock_" + order.id, url: `${workerOrigin}/mock-pay/${order.id}?t=${encodeURIComponent(order.token)}` };
  }
  const res = await fetch("https://api.sumup.com/v0.1/checkouts", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env.SUMUP_API_KEY}` },
    body: JSON.stringify({
      checkout_reference: order.id,
      amount: Number((order.total / 100).toFixed(2)),
      currency: "EUR",
      merchant_code: env.SUMUP_MERCHANT_CODE,
      description: `${SHOP.name} – bestelling ${order.number}`,
      return_url: `${workerOrigin}/api/sumup/webhook`,
      redirect_url: siteReturnUrl(env, order),
      hosted_checkout: { enabled: true },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.hosted_checkout_url) {
    console.error("SumUp checkout failed", res.status, JSON.stringify(data));
    throw new PaymentError("checkout_failed");
  }
  return { id: data.id, url: data.hosted_checkout_url };
}
async function fetchCheckoutStatus(env, checkoutId) {
  const res = await fetch(`https://api.sumup.com/v0.1/checkouts/${encodeURIComponent(checkoutId)}`, {
    headers: { authorization: `Bearer ${env.SUMUP_API_KEY}` },
  });
  if (!res.ok) return null;
  const d = await res.json();
  const tx = (d.transactions || []).find(t => t.status === "SUCCESSFUL");
  return { status: d.status, txCode: d.transaction_code || (tx && tx.transaction_code) || null, amount: d.amount };
}
// Called by the webhook and when the customer checks the status. Always asks SumUp itself.
async function syncCheckout(checkoutId, env) {
  if (env.SUMUP_MODE !== "live") return;
  const order = await env.DB.prepare("SELECT * FROM orders WHERE sumup_checkout_id = ?").bind(checkoutId).first();
  if (!order || order.status !== "pending_payment") return;
  const st = await fetchCheckoutStatus(env, checkoutId);
  if (!st) return;
  if (st.status === "PAID" && Math.round(Number(st.amount) * 100) === order.total_cents) {
    await markPaid(env, order, st.txCode);
  } else if (st.status === "FAILED" || st.status === "EXPIRED") {
    await env.DB.prepare("UPDATE orders SET status = 'payment_failed', updated_at = ? WHERE id = ? AND status = 'pending_payment'").bind(nowIso(), order.id).run();
  }
}
async function markPaid(env, order, txCode) {
  const r = await env.DB.prepare("UPDATE orders SET status = 'new', paid = 1, sumup_tx_code = ?, updated_at = ? WHERE id = ? AND status = 'pending_payment'")
    .bind(txCode || null, nowIso(), order.id).run();
  if (r.meta && r.meta.changes) {
    await sendMail(env, order.email, order.lang, "confirm", { number: order.number, pickup: order.pickup_at.slice(11), asap: !!order.asap, total: order.total_cents, lines: JSON.parse(order.items_json) });
  }
}

// ---------------------------------------------------------------- customer status
async function orderStatus(id, token, env) {
  let o = await env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first();
  if (!o || !safeEqual(o.token, token)) return [{ error: "not_found" }, 404];
  if (o.status === "pending_payment" && o.sumup_checkout_id && env.SUMUP_MODE === "live") {
    await syncCheckout(o.sumup_checkout_id, env);
    o = await env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first();
  }
  return [{
    number: o.number, status: o.status, paid: !!o.paid, pay_method: o.pay_method,
    pickup_at: o.pickup_at, asap: !!o.asap, total_cents: o.total_cents,
    items: JSON.parse(o.items_json), pickupAddress: SHOP.pickupAddress,
  }, 200];
}

// ---------------------------------------------------------------- test-mode payment page
async function mockPayPage(id, token, env) {
  const o = await env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first();
  if (!o || !safeEqual(o.token, token)) return new Response("Niet gevonden", { status: 404 });
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const html = `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Testbetaling</title>
<style>body{margin:0;font-family:system-ui,sans-serif;background:#f3f4f6;color:#111;display:grid;place-items:center;min-height:100vh}
.c{background:#fff;border-radius:16px;padding:28px;max-width:380px;width:calc(100% - 32px);box-shadow:0 10px 30px rgba(0,0,0,.1)}
.tag{display:inline-block;background:#fde68a;color:#7c4a03;font-weight:700;font-size:12px;padding:4px 10px;border-radius:99px;margin-bottom:12px}
h1{font-size:20px;margin:0 0 6px}.amt{font-size:34px;font-weight:800;margin:14px 0 20px}
button{width:100%;padding:14px;border:0;border-radius:10px;font-size:16px;font-weight:700;cursor:pointer;margin-top:10px}
.ok{background:#16a34a;color:#fff}.no{background:#e5e7eb;color:#111}p{color:#555;font-size:14px;line-height:1.45}</style></head>
<body><form class="c" method="post"><span class="tag">TESTMODUS – er wordt niets afgeschreven</span>
<h1>${esc(SHOP.name)}</h1><p>Bestelling ${esc(o.number)}</p><div class="amt">${esc(euro(o.total_cents))}</div>
<input type="hidden" name="t" value="${esc(token)}">
<button class="ok" name="result" value="paid">Testbetaling geslaagd</button>
<button class="no" name="result" value="failed">Betaling mislukt</button>
<p>Dit scherm vervangt straks de echte betaalpagina van SumUp.</p></form></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
async function mockPayResult(id, request, env) {
  const form = await request.formData();
  const o = await env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first();
  if (!o || !safeEqual(o.token, form.get("t"))) return new Response("Niet gevonden", { status: 404 });
  if (o.status === "pending_payment") {
    if (form.get("result") === "paid") await markPaid(env, o, "TEST-" + o.number);
    else await env.DB.prepare("UPDATE orders SET status = 'payment_failed', updated_at = ? WHERE id = ?").bind(nowIso(), id).run();
  }
  return Response.redirect(siteReturnUrl(env, o), 303);
}

// ---------------------------------------------------------------- e-mail (optional, via Resend)
async function sendMail(env, to, lang, kind, d) {
  if (!env.RESEND_API_KEY || !env.MAIL_FROM || !to) return;
  const nl = lang !== "en";
  const when = d.asap ? (nl ? `zo snel mogelijk (rond ${d.pickup})` : `as soon as possible (around ${d.pickup})`) : d.pickup;
  const lines = (d.lines || []).map(l => `<li>${l.qty}× ${l.name}${l.menu ? (nl ? " (menu)" : " (meal)") : ""}${l.without && l.without.length ? " – " + l.without.join(", ") : ""}</li>`).join("");
  const subject = kind === "ready"
    ? (nl ? `Je bestelling ${d.number} staat klaar!` : `Your order ${d.number} is ready!`)
    : (nl ? `Bestelling ${d.number} ontvangen` : `Order ${d.number} received`);
  const html = kind === "ready"
    ? `<p>${nl ? "Je bestelling staat klaar om op te halen bij" : "Your order is ready for pickup at"} ${SHOP.pickupAddress}.</p><p><b>${nl ? "Bestelnummer" : "Order number"}: ${d.number}</b></p>`
    : `<p>${nl ? "Bedankt voor je bestelling!" : "Thanks for your order!"}</p><p><b>${nl ? "Bestelnummer" : "Order number"}: ${d.number}</b><br>${nl ? "Ophalen" : "Pickup"}: ${when}<br>${SHOP.pickupAddress}</p><ul>${lines}</ul><p>${nl ? "Totaal" : "Total"}: ${euro(d.total)}</p>`;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${env.RESEND_API_KEY}` },
      body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject, html }),
    });
    if (!r.ok) console.error("Mail failed", r.status, await r.text());
  } catch (e) { console.error("Mail error", e); }
}

// ---------------------------------------------------------------- admin (dashboard API)
async function sessionKey(env) {
  const secret = env.SESSION_SECRET || ("pin:" + (env.DASHBOARD_PIN || ""));
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
async function sign(env, msg) {
  const sig = await crypto.subtle.sign("HMAC", await sessionKey(env), new TextEncoder().encode(msg));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function isAdmin(request, env) {
  const c = (request.headers.get("cookie") || "").split(/;\s*/).find(s => s.startsWith("ils_admin="));
  if (!c) return false;
  const [exp, sig] = decodeURIComponent(c.slice(10)).split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return safeEqual(sig, await sign(env, exp));
}
async function admin(path, request, env, url) {
  const method = request.method;
  const isHttps = url.protocol === "https:";
  if (path === "/api/admin/login" && method === "POST") {
    if (!env.DASHBOARD_PIN) return json({ error: "no_pin_configured" }, 500);
    const fail = JSON.parse(await getSetting(env, "login_fail", '{"n":0,"t":0}'));
    if (fail.n >= 5 && Date.now() - fail.t < 10 * 60 * 1000) return json({ error: "locked" }, 429);
    let body = {}; try { body = await request.json(); } catch (e) {}
    if (!safeEqual(String(body.pin || ""), String(env.DASHBOARD_PIN))) {
      const n = Date.now() - fail.t < 10 * 60 * 1000 ? fail.n + 1 : 1;
      await setSetting(env, "login_fail", JSON.stringify({ n, t: Date.now() }));
      return json({ error: "wrong_pin" }, 401);
    }
    await setSetting(env, "login_fail", '{"n":0,"t":0}');
    const exp = String(Date.now() + 30 * 24 * 3600 * 1000);
    const cookie = `ils_admin=${encodeURIComponent(exp + "." + await sign(env, exp))}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${30 * 24 * 3600}${isHttps ? "; Secure" : ""}`;
    return json({ ok: true }, 200, { "set-cookie": cookie });
  }
  if (path === "/api/admin/logout" && method === "POST") {
    return json({ ok: true }, 200, { "set-cookie": `ils_admin=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${isHttps ? "; Secure" : ""}` });
  }
  if (!(await isAdmin(request, env))) return json({ error: "unauthorized" }, 401);

  if (path === "/api/admin/orders" && method === "GET") {
    const day = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("day") || "") ? url.searchParams.get("day") : amsNow().day;
    const { results } = await env.DB.prepare("SELECT * FROM orders WHERE day = ? AND status != 'payment_failed' ORDER BY created_at DESC").bind(day).all();
    const paused = (await getSetting(env, "paused", "0")) === "1";
    return json({ day, paused, mode: env.SUMUP_MODE === "live" ? "live" : "test", orders: results.map(o => ({
      id: o.id, number: o.number, status: o.status, pay_method: o.pay_method, paid: !!o.paid,
      created_at: o.created_at, pickup_at: o.pickup_at, asap: !!o.asap, name: o.name, phone: o.phone, email: o.email, note: o.note,
      items: JSON.parse(o.items_json), total_cents: o.total_cents, tx: o.sumup_tx_code,
    })) });
  }
  let m = path.match(/^\/api\/admin\/orders\/([a-f0-9-]{36})\/status$/);
  if (m && method === "POST") {
    let body = {}; try { body = await request.json(); } catch (e) {}
    if (!ADMIN_SET.includes(body.status)) return json({ error: "bad_status" }, 400);
    const o = await env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(m[1]).first();
    if (!o) return json({ error: "not_found" }, 404);
    if (o.status === "pending_payment" && body.status !== "cancelled") return json({ error: "not_paid" }, 409);
    const paidNow = body.status === "picked_up" && o.pay_method === "at_pickup" ? 1 : o.paid;
    await env.DB.prepare("UPDATE orders SET status = ?, paid = ?, updated_at = ? WHERE id = ?").bind(body.status, paidNow, nowIso(), o.id).run();
    if (body.status === "ready" && o.status !== "ready") await sendMail(env, o.email, o.lang, "ready", { number: o.number });
    return json({ ok: true });
  }
  if (path === "/api/admin/settings" && method === "POST") {
    let body = {}; try { body = await request.json(); } catch (e) {}
    if (typeof body.paused === "boolean") await setSetting(env, "paused", body.paused ? "1" : "0");
    return json({ ok: true, paused: (await getSetting(env, "paused", "0")) === "1" });
  }
  if (path === "/api/admin/export.csv" && method === "GET") {
    const re = /^\d{4}-\d{2}-\d{2}$/;
    const from = re.test(url.searchParams.get("from") || "") ? url.searchParams.get("from") : amsNow().day.slice(0, 8) + "01";
    const to = re.test(url.searchParams.get("to") || "") ? url.searchParams.get("to") : amsNow().day;
    const { results } = await env.DB.prepare("SELECT * FROM orders WHERE day BETWEEN ? AND ? AND status NOT IN ('pending_payment','payment_failed') ORDER BY created_at").bind(from, to).all();
    const q = v => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
    const rows = [["datum", "bestelnummer", "afhaaltijd", "status", "betaling", "betaald", "sumup_transactie", "totaal_eur", "producten"].join(";")];
    for (const o of results) {
      const items = JSON.parse(o.items_json).map(l => `${l.qty}x ${l.name}${l.menu ? " (menu)" : ""}`).join(", ");
      rows.push([o.day, o.number, o.pickup_at.slice(11), o.status, o.pay_method === "online" ? "online" : "bij afhalen", o.paid ? "ja" : "nee", o.sumup_tx_code || "", (o.total_cents / 100).toFixed(2).replace(".", ","), items].map(q).join(";"));
    }
    return new Response("﻿" + rows.join("\r\n"), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="bestellingen_${from}_${to}.csv"`, "cache-control": "no-store" } });
  }
  return json({ error: "not_found" }, 404);
}

// ---------------------------------------------------------------- privacy clean-up (daily cron)
async function cleanup(env) {
  const days = Number(env.RETENTION_DAYS || 30);
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();
  await env.DB.prepare("UPDATE orders SET name = NULL, phone = NULL, email = NULL, note = NULL WHERE created_at < ? AND (name IS NOT NULL OR phone IS NOT NULL OR email IS NOT NULL OR note IS NOT NULL)").bind(cutoff).run();
  const stale = new Date(Date.now() - 2 * 86400000).toISOString();
  await env.DB.prepare("DELETE FROM orders WHERE status IN ('pending_payment','payment_failed') AND created_at < ?").bind(stale).run();
  await env.DB.prepare("DELETE FROM day_counter WHERE day < ?").bind(cutoff.slice(0, 10)).run();
}

export { priceLines, pickupInfo }; // for tests
