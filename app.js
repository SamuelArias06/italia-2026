(() => {
  "use strict";

  const TZ = "Europe/Rome";
  const app = document.getElementById("app");
  const clock = document.getElementById("clock");
  const CITY_ORDER = ["venecia", "florencia", "roma"];
  const CHECK_KEY = "italia2026-checklist";
  const CITY_KEY = "italia2026-city";
  let DATA = null;

  // ---------- helpers ----------
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const mark = (s) => esc(s).replace(/(verificar)/gi, '<span class="verify">$1</span>');
  const maps = (q) => "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q);
  const pinIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';
  const mapsLink = (q, label = "Ver en Google Maps") => q ? `<a class="link-maps" href="${maps(q)}" target="_blank" rel="noopener">📍 ${esc(label)}</a>` : "";
  // "+39 06 1234 / +39 333 9876" -> one tap-to-call link per number; plain text when there are no digits
  const telLinks = (txt) => String(txt || "").split(/\s*(?:\/|;|\|| o )\s*/).map((part) => {
    const m = part.match(/\+?[\d][\d\s().-]{5,}\d/);
    if (!m) return mark(part);
    return mark(part.slice(0, m.index)) + `<a class="tel" href="tel:${esc(m[0].replace(/[^\d+]/g, ""))}">${esc(m[0].trim())}</a>` + mark(part.slice(m.index + m[0].length));
  }).join(" · ");
  const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  };

  function romeParts(date = new Date()) {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
    }).formatToParts(date).map((x) => [x.type, x.value]));
    return { iso: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
  }
  // ?fecha=2026-10-18&hora=12:30 lets you preview any day
  function now() {
    const q = new URLSearchParams(location.search);
    const real = romeParts();
    const f = q.get("fecha"), h = q.get("hora");
    return {
      iso: /^\d{4}-\d{2}-\d{2}$/.test(f || "") ? f : real.iso,
      minutes: /^\d{1,2}:\d{2}$/.test(h || "") ? Number(h.split(":")[0]) * 60 + Number(h.split(":")[1]) : real.minutes
    };
  }
  const toMin = (t) => (/^\d{1,2}:\d{2}$/.test(t || "") ? Number(t.split(":")[0]) * 60 + Number(t.split(":")[1]) : null);

  function longDate(iso) {
    const d = new Date(iso + "T12:00:00Z");
    const s = new Intl.DateTimeFormat("es", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(d);
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function shortDate(iso) {
    const d = new Date(iso + "T12:00:00Z");
    return new Intl.DateTimeFormat("es", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(d).replace(/\./g, "");
  }

  function updateClock() {
    const t = new Intl.DateTimeFormat("es", { timeZone: TZ, weekday: "long", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());
    clock.textContent = "Hora en Italia: " + t;
  }

  function sourcesLine(list, verifiedOn) {
    const seen = new Map();
    (list || []).flat().forEach((u) => { if (u && /^https?:/.test(u) && !seen.has(u)) seen.set(u, host(u)); });
    if (!seen.size) return "";
    const links = [...seen].map(([u, h]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(h)}</a>`).join(" · ");
    return `<p class="sources"><b>Fuentes</b> (verificado el ${esc(verifiedOn || DATA.meta.updated)}): ${links}</p>`;
  }

  function currentDay() {
    const n = now();
    return { n, day: DATA.days.find((d) => d.date === n.iso) || null };
  }
  function defaultCity() {
    const { n, day } = currentDay();
    if (day && CITY_ORDER.includes(day.city)) return day.city;
    if (day && day.date === DATA.meta.end) return "roma";
    if (n.iso < DATA.days[1].date) return "venecia";
    const saved = store.get(CITY_KEY, null);
    return CITY_ORDER.includes(saved) ? saved : "venecia";
  }

  // ---------- shared renderers ----------
  function hotelBlock(key, compact = false) {
    const h = DATA.hotels[key];
    if (!h) return "";
    return `
      <div class="card c-${h.city} ${compact ? "plain" : ""}">
        <p class="kicker">Hotel de esta noche</p>
        <h3>${esc(h.name)}</h3>
        <p class="meta">${esc(h.address)}</p>
        ${h.phone ? `<p>Tel.: ${telLinks(h.phone)}</p>` : ""}
        ${compact ? "" : `<ul>${h.notes.map((x) => `<li>${mark(x)}</li>`).join("")}</ul>`}
        <a class="btn" href="${maps(h.mapsQuery)}" target="_blank" rel="noopener">${pinIcon} Cómo llegar al hotel</a>
      </div>`;
  }

  function timeline(day, n) {
    const isToday = day.date === n.iso;
    let nextIdx = -1;
    if (isToday) {
      nextIdx = day.events.findIndex((e) => { const m = toMin(e.time); return m !== null && m >= n.minutes - 15; });
    }
    return `<ol class="timeline">${day.events.map((e, i) => {
      const m = toMin(e.time);
      const cls = isToday && i === nextIdx ? "next" : isToday && m !== null && m < n.minutes - 15 && (nextIdx === -1 || i < nextIdx) ? "past" : "";
      return `<li class="${cls}"><span class="t">${esc(e.time || "·")}</span><div>
        ${mark(e.text)}${cls === "next" ? '<span class="badge-next">Lo próximo</span>' : ""}
        ${e.note ? `<span class="note">${mark(e.note)}</span>` : ""}
        ${e.place ? mapsLink(e.place) : ""}
      </div></li>`;
    }).join("")}</ol>`;
  }

  function dayCard(day, n, full = true) {
    const idx = DATA.days.indexOf(day) + 1;
    const isToday = day.date === n.iso;
    return `
      <article class="card c-${day.city} ${isToday ? "today" : ""}" id="dia-${day.date}">
        <p class="kicker">Día ${idx} · ${esc(DATA.cities[day.city].name)}${isToday ? " · HOY" : ""}</p>
        <h3>${esc(longDate(day.date))}</h3>
        <p class="meta">${esc(day.title)}</p>
        ${(day.reminders || []).map((x) => `<p class="reminder" role="note">⚠️ ${mark(x)}</p>`).join("")}
        ${timeline(day, n)}
        ${day.notes?.length ? `<ul>${day.notes.map((x) => `<li>${mark(x)}</li>`).join("")}</ul>` : ""}
        ${full && day.bring?.length ? `<div class="bring"><h4>Qué llevar</h4><ul>${day.bring.map((x) => `<li>${mark(x)}</li>`).join("")}</ul></div>` : ""}
        ${full && day.hotel ? `<p style="margin-top:12px"><b>Hotel:</b> ${esc(DATA.hotels[day.hotel].name)} ${mapsLink(DATA.hotels[day.hotel].mapsQuery, "Cómo llegar")}</p>` : ""}
      </article>`;
  }

  function citySwitch(active) {
    return `<div class="seg" role="group" aria-label="Ciudad">${CITY_ORDER.map((c) =>
      `<button type="button" class="c-${c}" data-city="${c}" aria-pressed="${c === active}">${esc(DATA.cities[c].name)}</button>`).join("")}</div>`;
  }

  // ---------- views ----------
  function viewHoy() {
    const { n, day } = currentDay();
    let html = "";
    if (day) {
      setCity(day.city);
      const idx = DATA.days.indexOf(day) + 1;
      html += `<section><div class="section-title"><h2>Hoy</h2><span class="meta">Día ${idx} de ${DATA.days.length}</span></div>`;
      html += dayCard(day, n, true);
      if (day.hotel) html += hotelBlock(day.hotel);
      else if (day.date === DATA.meta.end) html += `<div class="card plain"><p><b>Antes de salir:</b> llaves en la caja fuerte especial y revisar la caja fuerte de la habitación.</p></div>`;
      const tomorrow = DATA.days[idx];
      if (tomorrow) html += `<div class="card plain c-${tomorrow.city}"><p class="kicker">Mañana · ${esc(shortDate(tomorrow.date))}</p><h3>${esc(tomorrow.title)}</h3>
        <p class="meta">${tomorrow.events.filter((e) => e.time).slice(0, 2).map((e) => `${esc(e.time)} ${esc(e.text)}`).join("<br>") || "Día libre"}</p>
        <a href="#itinerario" data-goto="dia-${tomorrow.date}">Ver el día completo →</a></div>`;
      html += `</section>`;
    } else {
      setCity("viaje");
      const before = n.iso < DATA.meta.start;
      html += `<section><h2>${before ? "El viaje empieza pronto" : "¡Bienvenidos de vuelta!"}</h2>
        <p class="lead">${before ? "Del miércoles 14 al jueves 22 de octubre de 2026. Este es el resumen:" : "Así fue el viaje:"}</p>
        ${DATA.days.map((d, i) => `<a class="card plain c-${d.city}" style="display:block;text-decoration:none;color:inherit" href="#itinerario" data-goto="dia-${d.date}">
          <p class="kicker">Día ${i + 1} · ${esc(shortDate(d.date))} · ${esc(DATA.cities[d.city].name)}</p><b>${esc(d.title)}</b>
          ${d.hotel ? `<p class="meta">🛏 ${esc(DATA.hotels[d.hotel].name)}</p>` : ""}</a>`).join("")}
      </section>`;
    }
    html += viewChecklist();
    html += `<p class="offline-note">Esta guía funciona sin internet después de abrirla una vez.<br>Para tenerla a mano: menú del navegador → “Agregar a pantalla de inicio”.</p>`;
    return html;
  }

  function viewChecklist() {
    const state = store.get(CHECK_KEY, {});
    const done = DATA.checklist.filter((c) => state[c.id]).length;
    return `<section id="lista"><div class="section-title"><h2>Lista de chequeo</h2><span class="meta">${done}/${DATA.checklist.length}</span></div>
      <div class="card plain">
        <div class="progress"><i style="width:${Math.round((done / DATA.checklist.length) * 100)}%"></i></div>
        <p class="meta">Se guarda solo en este celular.</p>
        <ul class="check">${DATA.checklist.map((c) => `<li><label><input type="checkbox" data-check="${esc(c.id)}" ${state[c.id] ? "checked" : ""}><span>${esc(c.text)}</span></label></li>`).join("")}</ul>
      </div></section>`;
  }

  function viewItinerario() {
    const { n } = currentDay();
    setCity(currentDay().day?.city || "viaje");
    return `<section><h2>Itinerario</h2><p class="lead">Horarios en hora de Italia (24 h). Toca 📍 para abrir Google Maps.</p>
      ${DATA.days.map((d) => dayCard(d, n, true)).join("")}</section>`;
  }

  function placeCard(r, kind) {
    const rows = [];
    const add = (label, v) => { if (v && v !== "null") rows.push(`<dt>${label}</dt><dd>${mark(v)}</dd>`); };
    if (kind === "food") {
      add("Pedir", r.order); add("Horario", r.hours); add("Cierra", r.closed); add("Reservar", r.reserve); add("Calificación", r.rating);
    } else {
      add("Distancia", r.distance); add("Horario", r.hours); add("Entrada", r.price); add("Reserva", r.reserve); add("Tiempo", r.time);
    }
    return `<article class="card plain place">
      ${r.booking ? `<p class="booking ${/^RESERVAR/.test(r.booking) ? "must" : ""}">${esc(r.booking)}</p>` : ""}
      <h3>${esc(r.name)}</h3>
      <p>${r.price && kind === "food" ? `<span class="tag price">${esc(r.price)}</span>` : ""}${r.type ? `<span class="tag">${esc(r.type)}</span>` : ""}${r.area ? `<span class="tag">${esc(r.area)}</span>` : ""}${r.warn ? `<span class="tag warn">${esc(r.warn)}</span>` : ""}</p>
      <dl>${rows.join("")}</dl>
      ${r.note ? `<p class="meta" style="margin-top:8px">${mark(r.note)}</p>` : ""}
      <p>${mapsLink(r.mapsQuery)}${r.url ? ` &nbsp;·&nbsp; <a href="${esc(r.url)}" target="_blank" rel="noopener">Sitio web</a>` : ""}</p>
    </article>`;
  }

  function viewComer() {
    const city = currentTabCity();
    const f = DATA.food[city];
    if (!f) return citySwitch(city) + `<p class="lead">Pronto.</p>`;
    const all = [...(f.restaurants || []), ...(f.cafes || [])];
    return citySwitch(city) + `<section><h2>Comer en ${esc(DATA.cities[city].name)}</h2>
      ${f.intro ? `<div class="card c-${city}"><p class="kicker">Reservas y planes</p><p>${mark(f.intro)}</p></div>` : ""}
      ${[...(f.restaurants || [])].sort((x, y) => (y.booking ? 1 : 0) - (x.booking ? 1 : 0)).map((r) => placeCard(r, "food")).join("")}
      <h2 style="margin:26px 0 12px">Helado y café</h2>
      ${(f.cafes || []).map((r) => placeCard(r, "food")).join("")}
      <div class="card plain"><p><b>Cómo evitar trampas para turistas:</b> desconfíen de menús con fotos en la puerta, meseros que llaman desde la calle y mesas pegadas a los monumentos sin buenas reseñas. Pregunten antes si el pescado se cobra por peso (“all'etto”).</p></div>
      ${sourcesLine(all.map((r) => r.sources), f.verifiedOn)}
    </section>`;
  }

  function viewVer() {
    const city = currentTabCity();
    const s = DATA.sights[city];
    if (!s) return citySwitch(city) + `<p class="lead">Pronto.</p>`;
    return citySwitch(city) + `<section><h2>Si les sobra tiempo</h2>
      <p class="lead">En ${esc(DATA.cities[city].name)}, ordenados del más cercano al más lejano del hotel. Planes de 1 a 2 horas.</p>
      ${s.items.map((r) => placeCard(r, "sight")).join("")}
      ${sourcesLine(s.items.map((r) => r.sources), s.verifiedOn)}
    </section>`;
  }

  function viewConsejos() {
    setCity(currentDay().day?.city || "viaje");
    const tips = DATA.tips || [];
    const all = [];
    let html = `<section><h2>Consejos prácticos</h2><p class="lead">Toca cada tema para abrirlo.</p>`;
    tips.forEach((t) => {
      html += `<details><summary>${esc(t.section)}</summary><div class="inner">${t.items.map((i) => {
        all.push(i.sources);
        return `<div class="tip"><strong>${esc(i.title)}</strong>${mark(i.text)}</div>`;
      }).join("")}</div></details>`;
    });
    if (DATA.weather?.length) {
      html += `<details><summary>Clima en octubre</summary><div class="inner">${DATA.weather.map((w) => {
        all.push(w.sources);
        return `<div class="tip"><strong>${esc(w.city)}</strong>Máx. ${esc(w.high)} · mín. ${esc(w.low)}${w.rainDays ? ` · días de lluvia: ${esc(w.rainDays)}` : ""}<br>${mark(w.wear)}</div>`;
      }).join("")}</div></details>`;
    }
    if (DATA.phrases?.length) {
      html += `<details><summary>Frases útiles en italiano</summary><div class="inner"><table class="phr">${DATA.phrases.map((p) =>
        `<tr><td><span class="it">${esc(p.it)}</span><br><span class="pr">${esc(p.pron)}</span></td><td>${esc(p.es)}</td></tr>`).join("")}</table></div></details>`;
    }
    html += sourcesLine(all, DATA.tipsVerifiedOn) + `</section>`;
    return html;
  }

  function viewSOS() {
    setCity("viaje");
    const e = DATA.emergency || {};
    const all = [];
    let html = `<section><h2>Emergencias</h2>
      <a class="sos-big" href="tel:112"><b>112</b>Número único de emergencias en Europa · gratis · toca para llamar</a>`;
    if (e.general?.length) html += `<div class="card plain">${e.general.map((g) => `<div class="tip"><strong>${esc(g.title)}</strong>${mark(g.text)}</div>`).join("")}</div>`;
    (e.contacts || []).forEach((c) => {
      all.push(c.sources);
      html += `<div class="card plain"><h3>${esc(c.name)}</h3>
        ${c.address ? `<p class="meta">${esc(c.address)}</p>` : ""}
        ${c.phone ? `<p>Tel.: ${telLinks(c.phone)}</p>` : ""}
        ${c.note ? `<p class="meta">${mark(c.note)}</p>` : ""}
        <p>${c.address ? mapsLink(c.name + ", " + c.address) : ""}${c.url ? ` &nbsp;·&nbsp; <a href="${esc(c.url)}" target="_blank" rel="noopener">Sitio oficial</a>` : ""}</p></div>`;
    });
    if (e.lostPassport?.length) html += `<details open><summary>Si se pierde un pasaporte</summary><div class="inner"><ol>${e.lostPassport.map((x) => `<li>${mark(x)}</li>`).join("")}</ol></div></details>`;
    if (e.lostLuggage?.length) html += `<details><summary>Si se pierde una maleta</summary><div class="inner"><ol>${e.lostLuggage.map((x) => `<li>${mark(x)}</li>`).join("")}</ol></div></details>`;
    html += `<h2 style="margin:26px 0 12px">Hoteles</h2>${["nh", "club", "lux"].map((k) => hotelBlock(k, true)).join("")}`;
    html += `<div class="card plain"><p>Códigos de reserva y de vuelo: <b>en el WhatsApp del grupo / correo de Olga o Marcela</b>.</p></div>`;
    html += sourcesLine([...all, ...Object.values(DATA.hotels).map((h) => h.sources)], e.verifiedOn) + `</section>`;
    return html;
  }

  // ---------- routing ----------
  let tabCity = null;
  function currentTabCity() {
    if (!tabCity) tabCity = defaultCity();
    setCity(tabCity);
    return tabCity;
  }
  function setCity(c) { document.body.dataset.city = c; }

  const views = { hoy: viewHoy, itinerario: viewItinerario, comer: viewComer, ver: viewVer, consejos: viewConsejos, sos: viewSOS };
  function render(scrollTarget) {
    const tab = (location.hash.slice(1) || "hoy").split("/")[0];
    const view = views[tab] || viewHoy;
    app.innerHTML = view();
    document.querySelectorAll(".tabbar a").forEach((a) => { if (a.dataset.tab === (views[tab] ? tab : "hoy")) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    const target = scrollTarget || (tab === "itinerario" ? "dia-" + now().iso : null);
    const el = target && document.getElementById(target);
    if (el) el.scrollIntoView({ block: "start" }); else window.scrollTo(0, 0);
  }

  let pendingTarget = null;
  app.addEventListener("click", (ev) => {
    const b = ev.target.closest(".seg button");
    if (b) { tabCity = b.dataset.city; store.set(CITY_KEY, tabCity); render(); return; }
    const g = ev.target.closest("[data-goto]");
    if (g) pendingTarget = g.dataset.goto;
  });
  app.addEventListener("change", (ev) => {
    const c = ev.target.closest("[data-check]");
    if (!c) return;
    const state = store.get(CHECK_KEY, {});
    state[c.dataset.check] = c.checked;
    store.set(CHECK_KEY, state);
    const y = window.scrollY; render("lista"); window.scrollTo(0, y);
  });
  window.addEventListener("hashchange", () => { render(pendingTarget); pendingTarget = null; });

  // ---------- boot ----------
  updateClock();
  setInterval(updateClock, 30000);
  fetch("data.json", { cache: "no-cache" })
    .then((r) => r.json())
    .then((d) => { DATA = d; render(); })
    .catch(() => { app.innerHTML = '<p class="lead">No se pudo cargar la guía. Revisen la conexión e intenten de nuevo.</p>'; });

  // refresh "Hoy" every minute so "Lo próximo" stays current
  setInterval(() => { if (DATA && (location.hash === "" || location.hash === "#hoy") && !document.querySelector("input:focus")) { const y = scrollY; render(); scrollTo(0, y); } }, 60000);

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
})();
