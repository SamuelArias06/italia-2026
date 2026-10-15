(() => {
  "use strict";

  const TZ = "Europe/Rome";
  const CITIES = ["venecia", "florencia", "roma"];
  const K = { who: "italia2026-who", key: "italia2026-clave", check: "italia2026-checklist", explore: "italia2026-explore" };
  const app = document.getElementById("app");
  const tabbar = document.getElementById("tabbar");
  const sheet = document.getElementById("sheet");
  const sheetBody = document.getElementById("sheet-body");
  let D = null;          // data.json
  let PASSES = null;     // decrypted passes {id: pass}
  let showPast = false;

  // ---------- helpers ----------
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const mark = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/(verificar)/gi, '<span class="verify">$1</span>');
  const enc = encodeURIComponent;
  const mapsSearch = (q) => "https://www.google.com/maps/search/?api=1&query=" + enc(q);
  const mapsRoute = (q, mode = "walking") => `https://www.google.com/maps/dir/?api=1&destination=${enc(q)}&travelmode=${mode}`;
  const uberLink = (name, q) => `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[formatted_address]=${enc(q)}&dropoff[nickname]=${enc(name)}`;
  const telHref = (n) => "tel:" + String(n).replace(/[^\d+]/g, "");
  const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
    del(k) { try { localStorage.removeItem(k); } catch {} }
  };
  const ext = (href, label, cls = "act") => `<a class="${cls}" href="${esc(href)}" target="_blank" rel="noopener">${label}</a>`;
  const btn = (attrs, label, cls = "act") => `<button type="button" class="${cls}" ${attrs}>${label}</button>`;

  function romeNow() {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date()).map((x) => [x.type, x.value]));
    const q = new URLSearchParams(location.search);
    const f = q.get("fecha"), h = q.get("hora");
    return {
      iso: /^\d{4}-\d{2}-\d{2}$/.test(f || "") ? f : `${p.year}-${p.month}-${p.day}`,
      min: /^\d{1,2}:\d{2}$/.test(h || "") ? toMin(h) : Number(p.hour) * 60 + Number(p.minute)
    };
  }
  function toMin(t) { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ""); return m ? Number(m[1]) * 60 + Number(m[2]) : null; }
  const fmtDate = (iso, opts) => { const s = new Intl.DateTimeFormat("es", { ...opts, timeZone: "UTC" }).format(new Date(iso + "T12:00:00Z")).replace(/\./g, ""); return s.charAt(0).toUpperCase() + s.slice(1); };
  const longDate = (iso) => fmtDate(iso, { weekday: "long", day: "numeric", month: "long" });

  const who = () => store.get(K.who, null);
  const forMe = (x) => !x.who || x.who === "todos" || x.who === who();
  const dayOf = (iso) => D.days.find((d) => d.date === iso) || null;
  const cityName = (c) => (D.cities[c] || {}).name || c;
  function currentCity() {
    const n = romeNow(), day = dayOf(n.iso);
    if (day && CITIES.includes(day.city)) return day.city;
    if (day && day.date === D.meta.end) return "roma";
    return n.iso > D.meta.end ? "roma" : "venecia";
  }
  const setCity = (c) => { document.body.dataset.city = c; };

  // ---------- illustrations ----------
  function art(city) {
    const W = 360, H = 150;
    const svg = (inner) => `<svg class="art" viewBox="0 0 ${W} ${H}" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
    if (city === "venecia") {
      const cols = ["#e8a87c", "#d9785a", "#f2c48d", "#c96b4f", "#ecb98f", "#b85c43", "#f0cf9c", "#d98b62"];
      let houses = "", x = 0, i = 0;
      while (x < W) {
        const w = 34 + (i * 13) % 18, h = 46 + (i * 17) % 34, c = cols[i % cols.length];
        houses += `<rect x="${x}" y="${108 - h}" width="${w}" height="${h}" fill="${c}"/>`;
        for (let r = 0; r < Math.floor(h / 18); r++) for (let k = 0; k < 2; k++)
          houses += `<path d="M${x + 7 + k * (w / 2 - 2)} ${112 - h + r * 18 + 10} v-5 a3.5 3.5 0 0 1 7 0 v5z" fill="#fff6e6" opacity=".85"/>`;
        x += w; i++;
      }
      return svg(`<circle cx="300" cy="34" r="20" fill="#f6c453" opacity=".9"/>${houses}
        <path d="M120 108 Q180 58 240 108 Z" fill="#f5e6cc"/><path d="M134 108 Q180 74 226 108" fill="none" stroke="#c9a678" stroke-width="3"/>
        <rect x="0" y="106" width="${W}" height="${H - 106}" fill="var(--accent)" opacity=".9"/>
        <path d="M0 122 q15 -6 30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0" fill="none" stroke="#fff" stroke-width="2" opacity=".5"/>
        <path d="M60 134 Q120 146 190 130 L196 126 Q130 140 62 130 Z" fill="#1e1a17"/><path d="M190 130 l6 -10" stroke="#1e1a17" stroke-width="3"/>
        <circle cx="168" cy="111" r="4" fill="#1e1a17"/><path d="M168 115 v14 M168 120 l-14 12" stroke="#1e1a17" stroke-width="3" fill="none"/>
        <path d="M150 112 h22" stroke="#c0322a" stroke-width="3"/>`);
    }
    if (city === "florencia") {
      let roofs = "";
      for (let i = 0; i < 14; i++) { const x = i * 27, h = 16 + (i * 7) % 14; roofs += `<rect x="${x}" y="${128 - h}" width="26" height="${h + 22}" fill="${i % 2 ? "#f1d2a6" : "#e8c08f"}"/><path d="M${x - 2} ${128 - h} l15 -8 l15 8z" fill="#b5502c"/>`; }
      const cyp = (x, s) => `<ellipse cx="${x}" cy="${104 - 18 * s}" rx="${6 * s}" ry="${22 * s}" fill="#4b6b3a"/>`;
      return svg(`<circle cx="60" cy="36" r="18" fill="#f6c453" opacity=".85"/>
        <path d="M0 108 Q70 70 150 96 T360 84 V150 H0Z" fill="#a7bb7c" opacity=".8"/>
        ${cyp(30, 1)}${cyp(46, .8)}${cyp(322, 1.1)}${cyp(338, .8)}
        <rect x="246" y="38" width="22" height="72" fill="#f4e6cf"/><rect x="246" y="38" width="22" height="72" fill="none" stroke="#5f7a52" stroke-width="2"/>
        <path d="M246 56 h22 M246 76 h22 M246 94 h22" stroke="#5f7a52" stroke-width="2"/><rect x="244" y="32" width="26" height="7" fill="#e3cfae"/>
        <rect x="150" y="76" width="74" height="36" fill="#f4e6cf"/><path d="M150 92 h74" stroke="#5f7a52" stroke-width="2"/>
        <path d="M156 78 Q156 30 187 26 Q218 30 218 78 Z" fill="var(--accent)"/>
        <path d="M172 77 Q172 40 187 27 M202 77 Q202 40 187 27" stroke="#fbe9d9" stroke-width="2.5" fill="none"/>
        <rect x="181" y="14" width="12" height="14" fill="#f4e6cf"/><path d="M181 14 l6 -8 l6 8z" fill="#e3cfae"/>
        ${roofs}`);
    }
    if (city === "roma") {
      let arches = "";
      for (let row = 0; row < 3; row++) for (let i = 0; i < 9; i++) {
        const x = 128 + i * 22, y = 58 + row * 28;
        if (row === 0 && i > 6) continue;
        arches += `<path d="M${x} ${y + 22} v-12 a7 7 0 0 1 14 0 v12z" fill="#7a5a2c" opacity=".55"/>`;
      }
      return svg(`<circle cx="70" cy="40" r="20" fill="#f6c453" opacity=".9"/>
        <path d="M122 140 V60 L128 52 H286 L306 70 L322 66 V140Z" fill="var(--accent)" opacity=".9"/>
        <path d="M122 140 V60 L128 52 H286" fill="none" stroke="#f3dca8" stroke-width="2"/>
        <path d="M122 84 H322 M122 112 H322" stroke="#f3dca8" stroke-width="2"/>
        ${arches}
        <path d="M0 140 H360 V150 H0Z" fill="#c9a678"/>
        <rect x="52" y="78" width="7" height="62" fill="#6b4f33"/>
        <path d="M14 82 Q56 52 100 82 Q58 92 14 82Z" fill="#5d7a45"/><path d="M26 76 Q56 56 88 76" fill="none" stroke="#4b6638" stroke-width="3"/>`);
    }
    return svg(`<circle cx="300" cy="40" r="20" fill="#f6c453" opacity=".85"/>
      <g fill="#fff" opacity=".9"><ellipse cx="80" cy="96" rx="44" ry="16"/><ellipse cx="110" cy="86" rx="30" ry="18"/><ellipse cx="250" cy="112" rx="52" ry="16"/><ellipse cx="280" cy="102" rx="28" ry="16"/></g>
      <path d="M150 120 Q220 60 330 52" fill="none" stroke="var(--accent)" stroke-width="2" stroke-dasharray="5 7" opacity=".7"/>
      <g transform="translate(150 78) rotate(-18)" fill="var(--accent)"><path d="M0 0 h56 q10 0 10 5 q0 5 -10 5 h-56z"/><path d="M26 2 l-16 -18 h8 l22 18z M26 8 l-16 18 h8 l22 -18z M2 2 l-6 -10 h5 l8 10z"/></g>`);
  }

  // ---------- sheets ----------
  function openSheet(html, dark = false) {
    sheetBody.innerHTML = html;
    sheet.classList.toggle("dark", dark);
    sheet.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    sheet.querySelector(".sheet-panel").scrollTop = 0;
    if (!history.state || !history.state.sheet) history.pushState({ sheet: true }, "");
  }
  function hideSheet() { sheet.classList.add("hidden"); sheetBody.innerHTML = ""; document.body.style.overflow = ""; }
  function closeSheet() { if (history.state && history.state.sheet) history.back(); else hideSheet(); }
  window.addEventListener("popstate", () => { if (!sheet.classList.contains("hidden")) hideSheet(); });

  // ---------- places / rides ----------
  function placeFrom(ev) { return ev.place || null; }

  function hotelSheet(key) {
    const h = D.hotels[key];
    if (!h) return;
    setCity(h.city);
    const dest = { name: h.name, q: h.mapsQuery, addr: h.address };
    openSheet(`<div class="c-${h.city}">
      <p class="label" style="margin-top:4px">🏨 Hotel en ${esc(cityName(h.city))}</p>
      <h2>${esc(h.name)}</h2>
      <p class="muted">${esc(h.address)}</p>
      <a class="btn" href="${mapsRoute(h.mapsQuery, h.city === "venecia" ? "walking" : "transit")}" target="_blank" rel="noopener">📍 Cómo llegar al hotel</a>
      <div class="btn-grid">
        ${h.phone ? `<a class="btn soft" href="${telHref(h.phone)}">📞 Llamar</a>` : ""}
        ${btn(`data-pass="${esc(h.passId)}"`, "🎟️ Ver reserva", "btn soft")}
        ${h.city !== "venecia" ? btn(`data-ride="${h.city}" data-dest='${esc(JSON.stringify(dest))}'`, "🚕 Pedir taxi", "btn soft") : ""}
        ${btn(`data-taxista='${esc(JSON.stringify(dest))}'`, "🗣️ Mostrar al taxista", "btn soft")}
      </div>
      <div class="card" style="margin-top:14px">
        <p><b>Entrada:</b> desde las ${esc(h.checkin)} · <b>Salida:</b> hasta las ${esc(h.checkout)}</p>
        ${h.phone ? `<p><b>Teléfono:</b> <a class="tel" href="${telHref(h.phone)}">${esc(h.phone)}</a></p>` : ""}
        <ul>${(h.notes || []).map((x) => `<li>${mark(x)}</li>`).join("")}</ul>
      </div></div>`);
  }

  function rideSheet(city, dest) {
    city = CITIES.includes(city) ? city : currentCity();
    const r = D.rides[city];
    const other = CITIES.filter((c) => c !== city);
    openSheet(`<div class="c-${city}">
      <p class="label" style="margin-top:4px">${city === "venecia" ? "⛴️ Moverse" : "🚕 Pedir taxi"} en ${esc(cityName(city))}</p>
      <h2>${city === "venecia" ? "Cómo moverse en Venecia" : "Pedir un taxi"}</h2>
      ${dest ? `<div class="card tint"><p class="small muted">Destino</p><p><b>${esc(dest.name)}</b></p>
        ${btn(`data-taxista='${esc(JSON.stringify(dest))}'`, "🗣️ Mostrar la dirección al taxista", "btn")}
        <div class="btn-grid">
          ${r.uber ? ext(uberLink(dest.name, dest.q), "Abrir Uber (elegir “Taxi”)", "btn soft") : ""}
          ${ext(mapsRoute(dest.q, city === "venecia" ? "transit" : "driving"), city === "venecia" ? "⛴️ Ruta en vaporetto" : "🗺️ Ver ruta", "btn soft")}
        </div></div>` : ""}
      <p style="margin-top:12px"><b>${mark(r.intro)}</b></p>
      <ol>${r.steps.map((s) => `<li>${mark(s)}</li>`).join("")}</ol>
      <p class="label">📞 Llamar</p>
      ${r.phones.map((p) => `<a class="btn soft" href="${telHref(p.number)}">📞 ${esc(p.number)} · ${esc(p.name)}</a>`).join("")}
      <p class="label">📱 Apps</p>
      <div class="actions">${r.apps.map((a) => ext(a.url, esc(a.name))).join("")}${r.uber && !dest ? ext("https://m.uber.com/", "Uber (opción “Taxi”)") : ""}</div>
      <p class="label">📍 ${city === "venecia" ? "Parada" : "Paradas de taxi"}</p>
      <div class="actions">${r.stands.map((s) => ext(mapsRoute(s.q, "walking"), "📍 " + esc(s.name))).join("")}</div>
      <p class="sources">Fuentes: ${r.sources.map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(host(u))}</a>`).join(" · ")}</p>
      <p class="small muted" style="margin-top:12px">Otras ciudades: ${other.map((c) => `<a href="#" data-ride="${c}">${esc(cityName(c))}</a>`).join(" · ")}</p>
    </div>`);
  }

  function taxistaSheet(dest) {
    openSheet(`<div class="taxista">
      <p class="muted">Muestren esta pantalla al taxista 👇</p>
      <p class="it">Buongiorno! 👋<br>Per favore, mi porti a:</p>
      <p class="dest">${esc(dest.name)}</p>
      <p class="addr">${esc(dest.addr || dest.q)}</p>
      <p class="it" style="margin-top:26px">Quanto costa, più o meno?</p>
      <p class="muted">(¿Cuánto cuesta, más o menos?)</p>
    </div>`, true);
  }

  function trainSheet() {
    const t = D.trains;
    openSheet(`<p class="label" style="margin-top:4px">🚆 Trenes</p><h2>Comprar y tomar el tren</h2>
      <p><b>${mark(t.intro)}</b></p>
      <ol>${t.steps.map((s) => `<li>${mark(s)}</li>`).join("")}</ol>
      ${t.links.map((l) => ext(l.url, "🎫 Comprar en " + esc(l.name), "btn soft")).join("")}
      <div class="card" style="margin-top:14px"><p><b>Sus trenes:</b></p>
        <p>• Sábado 17: Venecia Santa Lucia 9:26 → Florencia SMN (~11:39)</p>
        <p>• Lunes 19: Florencia SMN 11:14 → Roma Termini (o el de las 11:48)</p></div>
      <p class="sources">Fuentes: ${t.sources.map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(host(u))}</a>`).join(" · ")}</p>`);
  }

  function phrasesSheet() {
    openSheet(`<p class="label" style="margin-top:4px">🗣️ Italiano básico</p><h2>Frases útiles</h2>
      <table class="phr">${(D.phrases || []).map((p) => `<tr><td><span class="it">${esc(p.it)}</span><br><span class="pr">${esc(p.pron)}</span></td><td>${esc(p.es)}</td></tr>`).join("")}</table>`);
  }

  function whoSheet() {
    openSheet(`<h2>¿Quién está usando la guía?</h2>
      ${Object.entries(D.people).map(([k, p]) => `<button type="button" class="who-btn" data-setwho="${k}">${esc(p.name)}${who() === k ? " ✓" : ""}<small>${k === "papas" ? "Vuelos de Avianca desde Bogotá" : "Vuelos de ITA desde Miami"}</small></button>`).join("")}`);
  }

  // ---------- passes ----------
  async function decryptPasses(pw) {
    const buf = new Uint8Array(await (await fetch("pases.bin")).arrayBuffer());
    if (String.fromCharCode(...buf.slice(0, 4)) !== "IT26") throw new Error("formato");
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: buf.slice(4, 20), iterations: 600000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: buf.slice(20, 32) }, key, buf.slice(32));
    const data = JSON.parse(new TextDecoder().decode(plain));
    return Object.fromEntries(data.passes.map((p) => [p.id, p]));
  }
  async function ensurePasses() {
    if (PASSES) return true;
    const pw = store.get(K.key, null);
    if (!pw) return false;
    try { PASSES = await decryptPasses(pw); return true; } catch { return false; }
  }
  const normKey = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, "-");

  function unlockForm(afterId) {
    return `<div class="card unlock">
      <h3>🔒 Pases protegidos</h3>
      <p>Para ver sus pases escriban la <b>clave familiar</b>. Está en el WhatsApp del grupo. Solo hay que hacerlo una vez en este celular.</p>
      <form data-unlock="${esc(afterId || "")}">
        <input name="clave" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="ejemplo: gondola-pizza-luna-sole-12" aria-label="Clave familiar">
        <p class="error hidden" data-err>Esa clave no funcionó. Revísenla e intenten otra vez.</p>
        <button class="btn" type="submit">Abrir mis pases</button>
      </form></div>`;
  }

  async function openPass(id) {
    const meta = D.passMeta[id] || {};
    if (meta.missing) { openSheet(`<h2>${esc(meta.icon || "🎟️")} ${esc(meta.title)}</h2><div class="card"><p>${mark(meta.missing)}</p></div>`); return; }
    if (!(await ensurePasses())) { openSheet(unlockForm(id)); return; }
    const p = PASSES[id];
    if (!p) { openSheet(`<h2>${esc(meta.title || "Pase")}</h2><p>Este pase no está en el archivo.</p>`); return; }
    openSheet(`<div class="viewer">
      <h2 style="clear:none">${esc(meta.icon || "🎟️")} ${esc(p.title)}</h2>
      ${p.lines.length ? `<div class="lines">${p.lines.map((l) => `<p>${esc(l)}</p>`).join("")}</div>` : ""}
      ${p.images.length ? `<p class="muted" style="margin-top:12px">💡 Suban el brillo de la pantalla para que lean el código.</p>` : ""}
      ${p.images.map((src, i) => `<img src="${src}" alt="${esc(p.title)} — página ${i + 1}">`).join("")}
    </div>`, true);
  }

  // ---------- step rendering ----------
  function stepActions(ev, city) {
    const a = [];
    const pl = placeFrom(ev);
    if (pl) a.push(ext(mapsRoute(pl.q, ev.go || "walking"), "📍 Cómo llegar", "act main"));
    const names = (D.people[ev.who] || D.people[who()] || { name: "Edver y Marcela" }).name.split(" y ");
    if (ev.pass) a.push(btn(`data-pass="${esc(ev.pass)}"`, ev.pass2 ? `🎟️ Pase de ${esc(names[0])}` : ev.pass.startsWith("hotel") ? "🎟️ Ver reserva" : "🎟️ Ver entrada"));
    if (ev.pass2) a.push(btn(`data-pass="${esc(ev.pass2)}"`, `🎟️ Pase de ${esc(names[1] || names[0])}`));
    if (ev.taxi && pl) a.push(btn(`data-ride="${city}" data-dest='${esc(JSON.stringify({ name: pl.name, q: pl.q }))}'`, "🚕 Taxi"));
    if (ev.train) a.push(btn(`data-train="1"`, "🚆 Tren"));
    if (ev.call && D.hotels[ev.call]?.phone) a.push(`<a class="act" href="${telHref(D.hotels[ev.call].phone)}">📞 Llamar al hotel</a>`);
    if (ev.link) a.push(ext(ev.link.url, "🔗 " + esc(ev.link.label)));
    return a.length ? `<div class="actions">${a.join("")}</div>` : "";
  }

  function stepCard(ev, city, state = "") {
    const time = ev.t ? (ev.sug ? "~" + ev.t : ev.t) : "";
    const whoPill = ev.who && ev.who !== "todos" ? `<span class="pill who">Solo ${esc(D.people[ev.who].name)}</span>` : "";
    return `<article class="step ${state}">
      <div class="step-head"><div class="step-ico">${esc(ev.icon || "•")}</div><div>
        <div><span class="step-time">${esc(time)}</span>${state === "now" ? '<span class="pill now">Lo próximo</span>' : ""}${ev.sug ? '<span class="pill">sugerencia</span>' : ""}${whoPill}</div>
        <div class="step-title">${mark(ev.title)}</div>
        ${ev.detail ? `<div class="step-detail">${mark(ev.detail)}</div>` : ""}
        ${ev.steps ? `<ol class="step-steps">${ev.steps.map((x) => `<li>${mark(x)}</li>`).join("")}</ol>` : ""}
      </div></div>
      ${stepActions(ev, city)}
    </article>`;
  }

  const eventsFor = (day) => day.events.filter(forMe);

  // ---------- views ----------
  function topbar(title) {
    const p = D.people[who()];
    return `<div class="topbar">${title ? `<h1 class="page-title">${title}</h1>` : `<span class="muted"><b>Italia 2026</b></span>`}
      <button type="button" class="who-chip" data-whosheet="1">👤 ${esc(p ? p.name : "¿Quién eres?")} ▾</button></div>`;
  }

  function viewWelcome() {
    setCity("florencia");
    tabbar.classList.add("hidden");
    document.body.classList.add("no-nav");
    return `<div class="welcome">
      <div class="hero"><p class="greet">Del 14 al 22 de octubre de 2026</p><h1>¡Bienvenidos a su guía de <em>Italia</em>! 🇮🇹</h1>
        <p class="when">Venecia · Florencia · Roma</p>${art("florencia")}</div>
      <h2>¿Quiénes son?</h2>
      ${Object.entries(D.people).map(([k, p]) => `<button type="button" class="who-btn c-${k === "papas" ? "venecia" : "roma"}" data-setwho="${k}">${esc(p.name)}<small>${k === "papas" ? "Vuelos de Avianca desde Bogotá" : "Vuelos de ITA desde Miami"}</small></button>`).join("")}
      <div class="card how"><h3>Así funciona</h3><ol>
        <li><b>Hoy</b> les muestra lo que toca ahora y lo que sigue.</li>
        <li>Cada plan tiene botones: <b>📍 Cómo llegar</b>, <b>🎟️ Ver entrada</b>, <b>🚕 Taxi</b>.</li>
        <li>Ábranla una vez con internet: después funciona <b>sin datos</b>.</li>
      </ol></div></div>`;
  }

  function greeting(min) { return min < 12 * 60 ? "Buenos días" : min < 19 * 60 ? "Buenas tardes" : "Buenas noches"; }

  function viewHoy() {
    const n = romeNow(), day = dayOf(n.iso), p = D.people[who()];
    let h = topbar();
    if (!day) {
      const before = n.iso < D.meta.start;
      setCity("viaje");
      h += `<section class="hero"><p class="greet">${greeting(n.min)}, ${esc(p.hello)}</p>
        <h1>${before ? "¡Ya casi nos <em>vamos</em>!" : "¡Qué <em>viaje</em>!"}</h1>
        <p class="when">${before ? "Salen el miércoles 14 de octubre" : "Gracias por usar la guía 💛"}</p>${art("viaje")}</section>`;
      h += `<a class="btn" href="#dias">🗓️ Ver el viaje día por día</a>`;
      return h + pendientes(n) ;
    }
    const idx = D.days.indexOf(day) + 1;
    setCity(day.city);
    const city = CITIES.includes(day.city) ? day.city : "roma";
    const hotel = day.hotel ? D.hotels[day.hotel] : null;
    h += `<section class="hero"><p class="greet">${greeting(n.min)}, ${esc(p.hello)} 👋</p>
      <h1>${day.city === "viaje" ? `Hoy: <em>${esc(day.title)}</em>` : `Hoy están en <em>${esc(cityName(day.city))}</em>`}</h1>
      <p class="when">${esc(longDate(day.date))}</p><span class="day-no">Día ${idx} de ${D.days.length}</span>
      ${art(day.city)}</section>`;
    h += `<div class="quick">
      ${hotel ? btn(`data-hotel="${day.hotel}"`, `<span class="qi">🏨</span>Mi hotel<small>${esc(hotel.short)}</small>`, "qa primary") : btn(`data-go="#dias"`, `<span class="qi">✈️</span>Día de viaje<small>Ver vuelos</small>`, "qa primary")}
      ${btn(`data-go="#pases"`, `<span class="qi">🎟️</span>Mis pases<small>Entradas y reservas</small>`, "qa")}
      ${btn(`data-ride="${city}"`, `<span class="qi">${city === "venecia" ? "⛴️" : "🚕"}</span>${city === "venecia" ? "Moverse" : "Pedir taxi"}<small>${city === "venecia" ? "Vaporetto y barcos" : "Teléfonos y apps"}</small>`, "qa")}
      ${btn(`data-go="#explorar/${city}/comer"`, `<span class="qi">🍝</span>Comer cerca<small>Restaurantes buenos</small>`, "qa")}
    </div>`;
    h += (day.reminders || []).map((r) => `<div class="reminder" role="note"><span>⚠️</span><span>${mark(r)}</span></div>`).join("");

    const evs = eventsFor(day);
    let nowIdx = evs.findIndex((e) => { const m = toMin(e.t); return m !== null && m >= n.min - 20; });
    const past = nowIdx === -1 ? evs : evs.slice(0, nowIdx);
    if (past.length) {
      h += `<button type="button" class="past-toggle" data-togglepast="1">${showPast ? "Ocultar" : "Ver"} lo que ya pasó hoy (${past.length})</button>`;
      if (showPast) h += past.map((e) => stepCard(e, city, "past")).join("");
    }
    if (nowIdx === -1) {
      h += `<div class="card tint"><h3>🌙 Ya terminaron los planes de hoy</h3><p>¡A descansar! Miren abajo lo de mañana.</p></div>`;
    } else {
      h += `<p class="label">Ahora · lo próximo</p>` + stepCard(evs[nowIdx], city, "now");
      if (evs.length > nowIdx + 1) h += `<p class="label">Más tarde hoy</p>` + evs.slice(nowIdx + 1).map((e) => stepCard(e, city)).join("");
    }
    if (day.bring?.length) h += `<p class="label">🎒 Lleven hoy</p><ul class="bring">${day.bring.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`;
    if (day.tips?.length) h += `<div class="card tint" style="margin-top:14px">${day.tips.map((t) => `<p>💡 ${mark(t)}</p>`).join("")}</div>`;
    const tom = D.days[idx];
    if (tom) {
      const first = eventsFor(tom).filter((e) => e.t && !e.sug).slice(0, 2);
      h += `<p class="label">Mañana</p><a class="card c-${tom.city}" style="display:block;text-decoration:none;color:inherit;border-left:6px solid var(--accent)" href="#dias/${tom.date}">
        <b>${esc(fmtDate(tom.date, { weekday: "long", day: "numeric" }))} · ${esc(tom.title)}</b>
        ${first.map((e) => `<p class="muted">${esc(e.t)} · ${esc(e.title)}</p>`).join("")}<p style="color:var(--accent);font-weight:700">Ver el día →</p></a>`;
    }
    return h + pendientes(n);
  }

  function pendientes(n) {
    const st = store.get(K.check, {});
    const items = D.checklist.filter((c) => forMe(c) && c.due && c.due <= n.iso && !st[c.id]);
    if (!items.length) return "";
    return `<p class="label">✅ Pendientes</p><div class="card"><ul class="check">${items.map((c) => checkItem(c, st)).join("")}</ul></div>`;
  }
  const checkItem = (c, st) => `<li><label><input type="checkbox" data-check="${esc(c.id)}" ${st[c.id] ? "checked" : ""}><span>${esc(c.text)}</span></label></li>`;

  function viewDias(param) {
    const n = romeNow();
    const sel = dayOf(param) || dayOf(n.iso) || D.days[0];
    setCity(sel.city);
    const city = CITIES.includes(sel.city) ? sel.city : "roma";
    let h = topbar("Días");
    h += `<div class="chips" role="group" aria-label="Elegir día">${D.days.map((d) => `<button type="button" class="chip c-${d.city} ${d.date === n.iso ? "is-today" : ""}" data-go="#dias/${d.date}" aria-pressed="${d === sel}">
      <span>${esc(fmtDate(d.date, { weekday: "short" }))}</span><b>${Number(d.date.slice(8))}</b><span>${{ venecia: "🛶", florencia: "⛪", roma: "🏛️", viaje: "✈️" }[d.city]}</span></button>`).join("")}</div>`;
    h += `<div class="card tint"><p class="small muted">${esc(longDate(sel.date))}${sel.date === n.iso ? " · HOY" : ""}</p><h2 style="margin:2px 0 6px">${esc(sel.title)}</h2>
      ${sel.hotel ? btn(`data-hotel="${sel.hotel}"`, `🏨 ${esc(D.hotels[sel.hotel].name)}`, "act main") : `<p class="muted">Noche en el avión / regreso</p>`}</div>`;
    h += (sel.reminders || []).map((r) => `<div class="reminder" role="note"><span>⚠️</span><span>${mark(r)}</span></div>`).join("");
    const evs = eventsFor(sel);
    let nowIdx = sel.date === n.iso ? evs.findIndex((e) => { const m = toMin(e.t); return m !== null && m >= n.min - 20; }) : -2;
    h += evs.map((e, i) => stepCard(e, city, nowIdx === -2 ? "" : i === nowIdx ? "now" : (nowIdx === -1 || i < nowIdx) ? "past" : "")).join("");
    if (sel.bring?.length) h += `<p class="label">🎒 Lleven</p><ul class="bring">${sel.bring.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`;
    if (sel.tips?.length) h += `<div class="card tint" style="margin-top:14px">${sel.tips.map((t) => `<p>💡 ${mark(t)}</p>`).join("")}</div>`;
    h += `<p class="small muted" style="margin-top:14px">Las horas con “~” son sugerencias: cámbienlas a su gusto.</p>`;
    return h;
  }

  function passButton(id) {
    const m = D.passMeta[id];
    if (m.missing) return `<div class="pass missing"><span class="pi">${esc(m.icon)}</span><span><span class="pt">${esc(m.title)}</span><span class="ps">Aún no está en la app</span></span></div>`;
    const sub = PASSES && PASSES[id] ? PASSES[id].title : "Toca para abrir";
    return `<button type="button" class="pass" data-pass="${esc(id)}"><span class="pi">${esc(m.icon)}</span><span><span class="pt">${esc(m.title)}</span><span class="ps">${esc(sub)}</span></span><span class="go">Ver ›</span></button>`;
  }

  function viewPases() {
    setCity(currentCity());
    let h = topbar("Pases");
    const ids = Object.keys(D.passMeta).filter((id) => forMe(D.passMeta[id]));
    const n = romeNow(), today = dayOf(n.iso);
    const todayIds = today ? [...new Set(eventsFor(today).flatMap((e) => [e.pass, e.pass2]).filter((x) => x && ids.includes(x)))] : [];
    if (!store.get(K.key, null)) h += unlockForm("");
    else h += `<p class="muted">Funcionan sin internet. Toquen un pase para verlo en grande.</p>`;
    if (todayIds.length) h += `<p class="label">⭐ Para hoy</p>` + todayIds.map(passButton).join("");
    const groups = [["✈️ Vuelos", (id) => id.startsWith("vuelo")], ["🏨 Hoteles", (id) => id.startsWith("hotel")], ["🎟️ Entradas", (id) => !id.startsWith("vuelo") && !id.startsWith("hotel")]];
    groups.forEach(([label, fn]) => { const g = ids.filter(fn); if (g.length) h += `<p class="label">${label}</p>` + g.map(passButton).join(""); });
    if (who() === "tios") h += `<div class="card tint"><p>✈️ Sus tiquetes de ITA (Miami) no están cargados aquí: búsquenlos en el correo o en la app de ITA Airways.</p></div>`;
    if (store.get(K.key, null)) h += `<p class="small muted" style="margin-top:16px">Los pases están cifrados: sin la clave familiar nadie más puede verlos. <a href="#" data-forget="1">Olvidar la clave en este celular</a></p>`;
    return h;
  }

  function placeCard(r, kind, city) {
    const facts = [];
    const add = (l, v) => { if (v && v !== "null") facts.push(`<p><b>${l}:</b> ${mark(v)}</p>`); };
    if (kind === "ver") { add("Distancia", r.distance); add("Horario", r.hours); add("Entrada", r.price); add("Reserva", r.reserve); add("Tiempo", r.time); }
    else { add("Pedir", r.order); add("Horario", r.hours); add("Cierra", r.closed); }
    const q = r.mapsQuery;
    return `<article class="card place">
      ${r.booking ? `<p class="booking ${/^RESERVAR/.test(r.booking) ? "must" : ""}">${/^RESERVAR/.test(r.booking) ? "📅 " : "⭐ "}${esc(r.booking)}</p>` : ""}
      <h3>${esc(r.name)}</h3>
      <div class="tags">${r.price && kind !== "ver" ? `<span class="tag price">${esc(r.price)}</span>` : ""}${r.type ? `<span class="tag">${esc(r.type)}</span>` : ""}${r.area ? `<span class="tag">📍 ${esc(r.area)}</span>` : ""}</div>
      <div class="facts">${facts.join("")}</div>
      ${r.note ? `<p class="muted small">${mark(r.note)}</p>` : ""}
      <div class="actions">
        ${q ? ext(mapsRoute(q, city === "venecia" ? "walking" : "walking"), "📍 Cómo llegar", "act main") : ""}
        ${q && city !== "venecia" ? btn(`data-ride="${city}" data-dest='${esc(JSON.stringify({ name: r.name, q }))}'`, "🚕 Taxi") : ""}
        ${r.url ? ext(r.url, "🌐 Web") : ""}
      </div>
      <details class="more"><summary>Más datos</summary>
        ${kind !== "ver" ? `<p class="small"><b>Reservar:</b> ${mark(r.reserve)} · <b>Calificación:</b> ${mark(r.rating)}</p>` : ""}
        <p class="small">Fuentes: ${(r.sources || []).map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(host(u))}</a>`).join(" · ")}</p>
      </details>
    </article>`;
  }

  function viewExplorar(param) {
    const [pc, ps] = (param || "").split("/");
    const saved = store.get(K.explore, {});
    const city = CITIES.includes(pc) ? pc : CITIES.includes(saved.city) ? saved.city : currentCity();
    const sub = ["comer", "cafe", "ver"].includes(ps) ? ps : saved.sub || "comer";
    store.set(K.explore, { city, sub });
    setCity(city);
    let h = topbar("Comer y ver");
    h += `<div class="seg" role="group" aria-label="Ciudad">${CITIES.map((c) => `<button type="button" class="c-${c}" data-go="#explorar/${c}/${sub}" aria-pressed="${c === city}">${esc(cityName(c))}</button>`).join("")}</div>`;
    h += `<div class="seg" role="group" aria-label="Tipo">${[["comer", "🍝 Comer"], ["cafe", "🍦 Café y helado"], ["ver", "🏛️ Pasear"]].map(([k, l]) => `<button type="button" data-go="#explorar/${city}/${k}" aria-pressed="${k === sub}">${l}</button>`).join("")}</div>`;
    const f = D.food[city], s = D.sights[city];
    if (sub === "comer") {
      if (f.intro) h += `<div class="card tint"><p><b>📅 ${mark(f.intro)}</b></p></div>`;
      h += [...f.restaurants].sort((a, b) => (b.booking ? 1 : 0) - (a.booking ? 1 : 0)).map((r) => placeCard(r, "comer", city)).join("");
      h += `<div class="card tint"><p>💡 Eviten los restaurantes con fotos del menú en la puerta o con meseros llamando desde la calle. Pregunten si el pescado se cobra por peso.</p></div>`;
    } else if (sub === "cafe") {
      h += f.cafes.map((r) => placeCard(r, "comer", city)).join("");
    } else {
      h += `<p class="muted">Ordenados del más cercano al más lejano del hotel. Planes de 1 a 2 horas.</p>` + s.items.map((r) => placeCard(r, "ver", city)).join("");
    }
    h += `<p class="sources">Datos verificados el ${esc(f.verifiedOn)}. Lo marcado “verificar” no se pudo confirmar.</p>`;
    return h;
  }

  function viewAyuda() {
    setCity(currentCity());
    const st = store.get(K.check, {});
    const e = D.emergency || {};
    let h = topbar("Ayuda");
    h += `<a class="sos-big" href="tel:112"><b>112</b><span><b>Emergencias</b><br>Policía, ambulancia, bomberos. Gratis. Toquen para llamar.</span></a>`;
    h += `<div class="quick">
      ${btn(`data-ride="${currentCity()}"`, `<span class="qi">🚕</span>Pedir taxi<small>Teléfonos y apps</small>`, "qa")}
      ${btn(`data-train="1"`, `<span class="qi">🚆</span>Trenes<small>Cómo comprar</small>`, "qa")}
      ${btn(`data-phrases="1"`, `<span class="qi">🗣️</span>Frases<small>Italiano fácil</small>`, "qa")}
      ${btn(`data-hotels="1"`, `<span class="qi">🏨</span>Hoteles<small>Los tres</small>`, "qa")}
    </div>`;
    h += `<h2>✅ Lista de chequeo</h2><div class="card"><ul class="check">${D.checklist.filter(forMe).map((c) => checkItem(c, st)).join("")}</ul></div>`;
    h += `<h2>💡 Consejos</h2>`;
    const icons = { Transporte: "🚆", Dinero: "💶", Seguridad: "👜", Vaticano: "⛪", Venecia: "🛶", "Agua y salud": "💧", Enchufes: "🔌", Clima: "🌤️", Vuelos: "✈️" };
    (D.tips || []).forEach((t) => {
      h += `<details class="acc"><summary>${icons[t.section] || "📌"} ${esc(t.section)}</summary><div class="inner">${t.items.map((i) => `<div class="tip"><strong>${esc(i.title)}</strong>${mark(i.text)}</div>`).join("")}</div></details>`;
    });
    if (D.weather?.length) h += `<details class="acc"><summary>🧥 Clima y ropa</summary><div class="inner">${D.weather.map((w) => `<div class="tip"><strong>${esc(w.city)}: ${esc(w.high)} / ${esc(w.low)}</strong>${mark(w.wear)}</div>`).join("")}</div></details>`;
    h += `<h2>🆘 Emergencias</h2>`;
    h += `<details class="acc"><summary>🏛️ Embajadas y consulados</summary><div class="inner">${(e.contacts || []).map((c) => `<div class="tip"><strong>${esc(c.name)}</strong>
      ${c.address ? `<span class="muted">${esc(c.address)}</span><br>` : ""}${telLinks(c.phone)}${c.address ? `<br><a href="${mapsSearch(c.name + ", " + c.address)}" target="_blank" rel="noopener">📍 Ver en el mapa</a>` : ""}</div>`).join("")}</div></details>`;
    if (e.lostPassport?.length) h += `<details class="acc"><summary>🛂 Si se pierde un pasaporte</summary><div class="inner"><ol>${e.lostPassport.map((x) => `<li>${mark(x)}</li>`).join("")}</ol></div></details>`;
    if (e.lostLuggage?.length) h += `<details class="acc"><summary>🧳 Si se pierde una maleta</summary><div class="inner"><ol>${e.lostLuggage.map((x) => `<li>${mark(x)}</li>`).join("")}</ol></div></details>`;
    if (e.general?.length) h += `<details class="acc"><summary>📋 Más información útil</summary><div class="inner">${e.general.map((g) => `<div class="tip"><strong>${esc(g.title)}</strong>${mark(g.text)}</div>`).join("")}</div></details>`;
    h += `<h2>⚙️ La guía</h2><div class="card"><ol class="how">
      <li><b>Hoy</b> muestra lo que toca ahora. <b>Días</b> muestra cualquier día.</li>
      <li>Los botones de cada plan abren Google Maps, la entrada o el taxi.</li>
      <li>Funciona sin internet después de abrirla una vez.</li>
      <li>Para tenerla como app: menú del navegador → “Agregar a pantalla de inicio”.</li></ol>
      ${btn(`data-whosheet="1"`, "👤 Cambiar de persona", "btn soft")}</div>`;
    h += `<p class="sources">Consejos verificados el ${esc(D.tipsVerifiedOn || D.meta.updated)} en fuentes oficiales y guías serias. Lo marcado “verificar” no se pudo confirmar.</p>`;
    return h;
  }

  function telLinks(txt) {
    return String(txt || "").split(/\s*(?:\/|;|\|)\s*/).map((part) => {
      const m = part.match(/\+?\d[\d\s().-]{5,}\d/);
      if (!m) return mark(part);
      return mark(part.slice(0, m.index)) + `<a class="tel" href="${telHref(m[0])}">📞 ${esc(m[0].trim())}</a>` + mark(part.slice(m.index + m[0].length));
    }).join(" · ");
  }

  function hotelsSheet() {
    openSheet(`<h2>🏨 Hoteles</h2>${["nh", "club", "lux"].map((k) => { const h = D.hotels[k]; return `<div class="card c-${h.city}" style="border-left:6px solid var(--accent)">
      <p class="small muted">${esc(cityName(h.city))}</p><h3>${esc(h.name)}</h3><p class="muted small">${esc(h.address)}</p>
      <div class="actions">${btn(`data-hotel="${k}"`, "Ver todo", "act main")}${h.phone ? `<a class="act" href="${telHref(h.phone)}">📞 Llamar</a>` : ""}</div></div>`; }).join("")}`);
  }

  // ---------- routing ----------
  const views = { hoy: viewHoy, dias: viewDias, pases: viewPases, explorar: viewExplorar, ayuda: viewAyuda };
  function render(keepScroll) {
    if (!D) return;
    const raw = location.hash.slice(1);
    if (!who()) { app.innerHTML = viewWelcome(); return; }
    tabbar.classList.remove("hidden");
    document.body.classList.remove("no-nav");
    const [tab, ...rest] = raw.split("/");
    const t = views[tab] ? tab : "hoy";
    const y = scrollY;
    app.innerHTML = views[t](rest.join("/"));
    tabbar.querySelectorAll("a").forEach((a) => { if (a.dataset.tab === t) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    if (keepScroll) scrollTo(0, y); else scrollTo(0, 0);
    if (t === "dias") app.querySelector('.chip[aria-pressed="true"]')?.scrollIntoView({ inline: "center", block: "nearest" });
  }

  // ---------- events ----------
  document.addEventListener("click", async (ev) => {
    const el = ev.target.closest("[data-close],[data-go],[data-hotel],[data-pass],[data-ride],[data-taxista],[data-train],[data-phrases],[data-hotels],[data-whosheet],[data-setwho],[data-togglepast],[data-forget]");
    if (!el) return;
    const ds = el.dataset;
    if ("close" in ds) { closeSheet(); return; }
    ev.preventDefault();
    if (ds.setwho) { store.set(K.who, ds.setwho); if (!sheet.classList.contains("hidden")) closeSheet(); location.hash = "#hoy"; render(); return; }
    if (ds.go) { if (!sheet.classList.contains("hidden")) hideSheet(); location.hash = ds.go; return; }
    if (ds.hotel) { hotelSheet(ds.hotel); return; }
    if (ds.pass) { openPass(ds.pass); return; }
    if (ds.ride) { rideSheet(ds.ride, ds.dest ? JSON.parse(ds.dest) : null); return; }
    if (ds.taxista) { taxistaSheet(JSON.parse(ds.taxista)); return; }
    if (ds.train) { trainSheet(); return; }
    if (ds.phrases) { phrasesSheet(); return; }
    if (ds.hotels) { hotelsSheet(); return; }
    if (ds.whosheet) { whoSheet(); return; }
    if (ds.togglepast) { showPast = !showPast; render(true); return; }
    if (ds.forget) { store.del(K.key); PASSES = null; render(true); }
  });

  document.addEventListener("submit", async (ev) => {
    const f = ev.target.closest("form[data-unlock]");
    if (!f) return;
    ev.preventDefault();
    const pw = normKey(f.clave.value);
    const b = f.querySelector("button");
    b.disabled = true; b.textContent = "Abriendo…";
    try {
      PASSES = await decryptPasses(pw);
      store.set(K.key, pw);
      const after = f.dataset.unlock;
      if (after) openPass(after); else render(true);
    } catch {
      f.querySelector("[data-err]").classList.remove("hidden");
      b.disabled = false; b.textContent = "Abrir mis pases";
    }
  });

  document.addEventListener("change", (ev) => {
    const c = ev.target.closest("[data-check]");
    if (!c) return;
    const st = store.get(K.check, {});
    st[c.dataset.check] = c.checked;
    store.set(K.check, st);
  });

  window.addEventListener("hashchange", () => { showPast = false; render(); });

  // ---------- boot ----------
  // A link like  .../#clave=palabra-palabra-palabra-palabra-12  saves the family key on this phone.
  const km = /^#clave=([^&]+)/.exec(location.hash);
  if (km) { store.set(K.key, normKey(decodeURIComponent(km[1]))); history.replaceState(null, "", location.pathname + location.search + "#pases"); }

  fetch("data.json", { cache: "no-cache" })
    .then((r) => r.json())
    .then((d) => { D = d; render(); ensurePasses(); })
    .catch(() => { app.innerHTML = '<p class="loading">No se pudo cargar la guía. Revisen la conexión e intenten de nuevo.</p>'; });

  setInterval(() => {
    if (D && who() && sheet.classList.contains("hidden") && (location.hash === "" || location.hash === "#hoy") && !document.activeElement?.matches("input")) render(true);
  }, 60000);

  if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
})();
