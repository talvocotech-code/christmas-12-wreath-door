/* Christmas invitation engine – shared by all 12 cards.
   A card = config.json + theme.css + (optional) card.js + assets/.  Nothing here is card-specific. */

const C = window.CARD;
const $ = (s, r = document) => r.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/* ---------- date helpers (event times are Europe/London wall-clock) ---------- */
const ev = C.event || {};
const pad = (n) => String(n).padStart(2, '0');
function londonOffsetMinutes(dateStr) {
  // BST only applies Mar–Oct; Dec/Jan = GMT. Compute properly via Intl.
  const d = new Date(dateStr + 'Z');
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return Math.round((asUtc - d.getTime()) / 60000);
}
function toUtc(localIso) { // "2026-12-24T18:30:00" London local -> Date
  const guess = new Date(localIso + 'Z');
  return new Date(guess.getTime() - londonOffsetMinutes(localIso) * 60000);
}
const icsStamp = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;

/* ---------- build DOM ---------- */
document.documentElement.lang = C.lang || 'en-GB';
document.title = C.meta?.title || 'Christmas invitation';
document.body.dataset.card = C.slug;
document.body.dataset.theme = C.theme || C.slug;

const app = $('#app');
const stage = el('div', 'stage');
const media = el('div', 'stage-media');
let poster = el('img', 'stage-img'); poster.alt = ''; poster.src = C.stage.poster; poster.decoding = 'async';
media.appendChild(poster);
let video = null;
if (C.stage.video) {
  video = el('video', 'stage-video');
  video.muted = true; video.playsInline = true; video.setAttribute('playsinline', ''); video.setAttribute('webkit-playsinline', '');
  video.preload = 'auto'; video.poster = C.stage.poster; video.src = C.stage.video;
  video.addEventListener('error', () => { video.remove(); video = null; }, { once: true });
  media.appendChild(video);
}
const bloom = el('div', 'stage-bloom');
const tint = el('div', 'stage-tint');
const fx = el('canvas', 'stage-fx');
stage.append(media, bloom, tint, fx);

const O = C.opening || {};
const opening = el('div', 'opening'); if (C.stage.baked) opening.classList.add('baked');
opening.innerHTML = `
  <div class="op-text">
    ${O.eyebrow ? `<p class="op-eyebrow">${esc(O.eyebrow)}</p>` : ''}
    <h1 class="op-title">${(O.title || []).map((l, i) => `<span class="l${i}">${esc(l)}</span>`).join('')}</h1>
    ${O.date ? `<p class="op-date">${esc(O.date)}</p>` : ''}
  </div>
  <button class="op-tap" type="button" aria-label="${esc(O.hint || 'Open invitation')}">
    <span class="op-ring"></span><span class="op-hint">${esc(O.hint || 'Tap to open')}</span>
  </button>`;

const music = C.music && C.music.src ? new Audio(C.music.src) : null;
if (music) { music.loop = true; music.preload = 'auto'; music.volume = 0.0; }
const mbtn = el('button', 'music-btn', '<span class="bars"><i></i><i></i><i></i></span>');
mbtn.type = 'button'; mbtn.setAttribute('aria-label', 'Toggle music'); mbtn.hidden = true;

const main = el('main', 'content'); main.hidden = true;
app.append(stage, opening, main, mbtn);

/* ---------- sections ---------- */
const S = C.sections || [];
const fmtDate = C.opening?.date || '';
function sec(type, inner, extra = '') {
  const s = el('section', `sec sec-${type} ${extra}`); s.dataset.type = type; s.appendChild(inner); return s;
}
const rv = (node, i = 0) => { node.classList.add('rv'); node.style.setProperty('--d', i * 90 + 'ms'); return node; };

function heroSection() {
  const h = el('section', 'sec sec-hero');
  h.innerHTML = `
    <div class="hero-in">
      ${O.eyebrow ? `<p class="op-eyebrow">${esc(O.eyebrow)}</p>` : ''}
      <h2 class="op-title">${(O.title || []).map((l, i) => `<span class="l${i}">${esc(l)}</span>`).join('')}</h2>
      ${O.date ? `<p class="op-date">${esc(O.date)}</p>` : ''}
      ${ev.timeLabel ? `<p class="hero-time">${esc(ev.timeLabel)}</p>` : ''}
    </div>
    <div class="scroll-cue" aria-hidden="true"><span></span></div>`;
  return h;
}

function welcome(s) {
  const w = el('div', 'panel welcome');
  w.innerHTML = `${s.title ? `<h3 class="h">${esc(s.title)}</h3>` : ''}${(s.paragraphs || C.host?.message || []).map((p) => `<p>${esc(p)}</p>`).join('')}${C.host?.name ? `<p class="sign">${esc(C.host.signoff || 'With love,')}<br><strong>${esc(C.host.name)}</strong></p>` : ''}`;
  return sec('welcome', rv(w));
}

function details(s) {
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ev.mapQuery || `${ev.venue}, ${ev.address}`)}`;
  const w = el('div', 'panel details');
  if (s.variant === 'stack') {
    w.classList.add('stack');
    w.innerHTML = `${s.title ? `<h3 class="h">${esc(s.title)}</h3>` : ''}
      <p class="eb">${esc(s.labels?.when || 'When')}</p><p class="big">${esc(ev.dateLabel || fmtDate)}</p><p class="mid">${esc(ev.timeLabel || '')}</p>
      <span class="sep"></span>
      <p class="eb">${esc(s.labels?.where || 'Where')}</p><p class="big">${esc(ev.venue)}</p><p class="mid">${esc(ev.address)}<br>${esc(ev.postcode || '')}</p>
      ${ev.dress ? `<span class="sep"></span><p class="eb">${esc(s.labels?.dress || 'Dress')}</p><p class="mid">${esc(ev.dress)}</p>` : ''}
      <div class="btns"><a class="btn" href="${mapUrl}" target="_blank" rel="noopener">${esc(s.mapLabel || 'Get directions')}</a><button class="btn ghost" type="button" data-act="cal">${esc(s.calLabel || 'Add to calendar')}</button></div>`;
    return sec('details', rv(w));
  }
  w.innerHTML = `
    ${s.title ? `<h3 class="h">${esc(s.title)}</h3>` : ''}
    <div class="rows">
      <div class="row"><span class="k">${esc(s.labels?.when || 'When')}</span><span class="v">${esc(ev.dateLabel || fmtDate)}<small>${esc(ev.timeLabel || '')}</small></span></div>
      <div class="row"><span class="k">${esc(s.labels?.where || 'Where')}</span><span class="v">${esc(ev.venue)}<small>${esc(ev.address)}<br>${esc(ev.postcode || '')}</small></span></div>
      ${ev.dress ? `<div class="row"><span class="k">${esc(s.labels?.dress || 'Dress')}</span><span class="v">${esc(ev.dress)}</span></div>` : ''}
    </div>
    <div class="btns"><a class="btn" href="${mapUrl}" target="_blank" rel="noopener">${esc(s.mapLabel || 'Get directions')}</a><button class="btn ghost" type="button" data-act="cal">${esc(s.calLabel || 'Add to calendar')}</button></div>`;
  return sec('details', rv(w));
}

function schedule(s) {
  const w = el('div', 'panel schedule');
  w.innerHTML = `<h3 class="h">${esc(s.title || 'The evening')}</h3><ol class="tl">${(s.items || []).map((it, i) => `<li class="rv" style="--d:${i * 80}ms"><time>${esc(it.time)}</time><div><strong>${esc(it.label)}</strong>${it.desc ? `<p>${esc(it.desc)}</p>` : ''}</div></li>`).join('')}</ol>`;
  return sec('schedule', rv(w));
}

function notes(s) {
  const w = el('div', 'panel notes');
  w.innerHTML = `${s.title ? `<h3 class="h">${esc(s.title)}</h3>` : ''}<div class="grid">${(s.items || []).map((it, i) => `<div class="note rv" style="--d:${i * 90}ms"><span class="ic" data-ic="${esc(it.icon || 'star')}"></span><h4>${esc(it.label)}</h4><p>${esc(it.text)}</p></div>`).join('')}</div>`;
  return sec('notes', rv(w));
}

function menu(s) {
  const w = el('div', 'panel menu');
  w.innerHTML = `<h3 class="h">${esc(s.title || 'The menu')}</h3>${(s.courses || []).map((c) => `<div class="course"><h4>${esc(c.name)}</h4>${(c.items || []).map((i) => `<p>${esc(i)}</p>`).join('')}</div>`).join('')}${s.footnote ? `<p class="fine">${esc(s.footnote)}</p>` : ''}`;
  return sec('menu', rv(w));
}

function countdown(s) {
  const w = el('div', 'panel countdown');
  w.innerHTML = `<h3 class="h">${esc(s.title || 'Counting down')}</h3><div class="cd" aria-live="off"><div><b data-u="d">00</b><span>days</span></div><div><b data-u="h">00</b><span>hours</span></div><div><b data-u="m">00</b><span>mins</span></div><div><b data-u="s">00</b><span>secs</span></div></div>${s.note ? `<p class="fine">${esc(s.note)}</p>` : ''}`;
  return sec('countdown', rv(w));
}

function rsvp(s) {
  const R = C.rsvp || {};
  const w = el('div', 'panel rsvp');
  if (!R.whatsapp && !R.email) { // no reply channel set (public demo): no form, just a gentle instruction
    w.innerHTML = `<h3 class="h">${esc(s.title || 'Will you join us?')}</h3><p class="by">${esc(R.byLabel || 'Please reply by')} <strong>${esc(R.by || '')}</strong></p><p class="fine">${esc(R.noContact || 'Please reply directly to your host.')}</p>`;
    return sec('rsvp', rv(w));
  }
  w.innerHTML = `
    <h3 class="h">${esc(s.title || 'Will you join us?')}</h3>
    <p class="by">${esc(R.byLabel || 'Please reply by')} <strong>${esc(R.by || '')}</strong></p>
    <form novalidate>
      <label class="f"><span>Your name</span><input name="name" autocomplete="name" required></label>
      <div class="f choice" role="radiogroup" aria-label="Attending">
        <label><input type="radio" name="att" value="yes" checked><span>${esc(R.yes || 'Joyfully accepts')}</span></label>
        <label><input type="radio" name="att" value="no"><span>${esc(R.no || 'Sadly cannot come')}</span></label>
      </div>
      <div class="f guests"><span>Number of guests</span><div class="step"><button type="button" data-st="-1" aria-label="Fewer">−</button><output>1</output><button type="button" data-st="1" aria-label="More">+</button></div></div>
      <label class="f"><span>Dietary needs</span><input name="diet" placeholder="${esc(R.dietHint || 'Allergies, vegetarian, vegan…')}"></label>
      <label class="f"><span>A message for the hosts</span><textarea name="msg" rows="2"></textarea></label>
      <p class="err" hidden>Please add your name.</p>
      <button class="btn big" type="submit">${esc(R.button || 'Send my reply')}</button>
      <p class="fine">${R.whatsapp ? 'Opens WhatsApp with your reply ready to send.' : 'Opens your email app with your reply ready to send.'}</p>
    </form>`;
  const f = $('form', w); const out = $('output', w); let n = 1;
  w.addEventListener('click', (e) => {
    const b = e.target.closest('[data-st]'); if (!b) return;
    n = Math.max(1, Math.min(12, n + +b.dataset.st)); out.textContent = n;
  });
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = f.name.value.trim(); const err = $('.err', w);
    if (!name) { err.hidden = false; f.name.focus(); return; } err.hidden = true;
    const yes = f.att.value === 'yes';
    const lines = [`${C.opening?.title?.join(' ') || 'Christmas invitation'} – RSVP`, `Name: ${name}`, `Attending: ${yes ? 'Yes' : 'No'}`];
    if (yes) lines.push(`Guests: ${n}`);
    if (f.diet.value.trim()) lines.push(`Dietary: ${f.diet.value.trim()}`);
    if (f.msg.value.trim()) lines.push(`Message: ${f.msg.value.trim()}`);
    const body = lines.join('\n');
    const url = R.whatsapp ? `https://wa.me/${R.whatsapp}?text=${encodeURIComponent(body)}` : `mailto:${R.email || ''}?subject=${encodeURIComponent('RSVP – ' + (C.opening?.title?.join(' ') || ''))}&body=${encodeURIComponent(body)}`;
    window.open(url, '_blank', 'noopener');
  });
  return sec('rsvp', rv(w));
}

function closing(s) {
  const w = el('div', 'closing');
  const D = C.deco || {};
  w.innerHTML = `${D.closing ? '<div class="cl-art" data-art="' + esc(D.closing) + '"></div>' : ''}<p class="cl-line">${esc(s?.line || C.footer?.line || 'Merry Christmas')}</p><p class="sign">${esc(C.host?.name || '')}</p>
    <div class="btns center"><button class="btn ghost" type="button" data-act="share">Share this invitation</button></div>${C.footer?.brand ? `<p class="brand"><a href="${esc(C.footer.brandUrl || 'https://talvoco.com')}" target="_blank" rel="noopener">${esc(C.footer.brand)}</a></p>` : ''}`;
  return sec('closing', rv(w));
}

const R = { welcome, details, schedule, notes, menu, countdown, rsvp, closing };
main.appendChild(heroSection());
const D = C.deco || {};
const brk = (b) => { const d = el('div', `brk brk-${b.art}`); d.dataset.art = b.art; if (b.w) d.style.setProperty('--bw', b.w); return d; };
S.forEach((s) => { if (R[s.type]) main.appendChild(R[s.type](s)); (D.breaks || []).filter((b) => b.after === s.type).forEach((b) => main.appendChild(brk(b))); });
if (!S.some((s) => s.type === 'closing')) main.appendChild(closing());

/* ---------- actions: calendar, share ---------- */
function makeIcs() {
  const s = toUtc(ev.start), e = toUtc(ev.end || ev.start);
  const t = (C.opening?.title || []).join(' ');
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Christmas Invitation//EN', 'BEGIN:VEVENT', `UID:${C.slug}-${icsStamp(s)}@invite`, `DTSTAMP:${icsStamp(new Date())}`, `DTSTART:${icsStamp(s)}`, `DTEND:${icsStamp(e)}`, `SUMMARY:${t}`, `LOCATION:${[ev.venue, ev.address, ev.postcode].filter(Boolean).join(', ')}`, `DESCRIPTION:${(ev.note || 'You are invited!').replace(/\n/g, '\\n')}`, 'END:VEVENT', 'END:VCALENDAR'];
  return L.join('\r\n');
}
document.addEventListener('click', async (e) => {
  const a = e.target.closest('[data-act]'); if (!a) return;
  if (a.dataset.act === 'cal') {
    const blob = new Blob([makeIcs()], { type: 'text/calendar;charset=utf-8' });
    const link = el('a'); link.href = URL.createObjectURL(blob); link.download = 'christmas-invitation.ics'; document.body.appendChild(link); link.click(); link.remove();
  }
  if (a.dataset.act === 'share') {
    const data = { title: document.title, text: `You're invited – ${(C.opening?.title || []).join(' ')}`, url: location.href };
    try { if (navigator.share) await navigator.share(data); else { await navigator.clipboard.writeText(location.href); a.textContent = 'Link copied'; } } catch { /* cancelled */ }
  }
});

/* ---------- countdown ---------- */
function tickCountdown() {
  const box = $('.cd'); if (!box || !ev.start) return;
  const run = () => {
    let ms = toUtc(ev.start) - Date.now(); if (ms < 0) ms = 0;
    const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60, s = Math.floor(ms / 1e3) % 60;
    box.querySelector('[data-u=d]').textContent = pad(d); box.querySelector('[data-u=h]').textContent = pad(h);
    box.querySelector('[data-u=m]').textContent = pad(m); box.querySelector('[data-u=s]').textContent = pad(s);
  };
  run(); setInterval(run, 1000);
}

/* ---------- scroll reveal + stage tint ---------- */
function startReveal() {
  const io = new IntersectionObserver((es) => es.forEach((x) => { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } }), { threshold: 0.12 });
  document.querySelectorAll('.rv').forEach((n) => io.observe(n));
  const upd = () => { const t = Math.min(1, scrollY / (innerHeight * 0.75)); document.documentElement.style.setProperty('--tint', (t * (+css('--tint-max') || 0.82)).toFixed(3)); };
  addEventListener('scroll', upd, { passive: true }); upd();
}

/* ---------- music ---------- */
let musicOn = false;
function fadeMusic(to, ms = 1200) {
  if (!music) return; const from = music.volume; const t0 = performance.now();
  const step = (t) => { const k = Math.min(1, (t - t0) / ms); music.volume = Math.max(0, Math.min(1, from + (to - from) * k)); if (k < 1) requestAnimationFrame(step); else if (to === 0) music.pause(); };
  requestAnimationFrame(step);
}
function setMusic(on) { musicOn = on; mbtn.classList.toggle('on', on); if (!music) return; if (on) { music.play().catch(() => {}); fadeMusic(+C.music.volume || 0.55); } else fadeMusic(0, 400); }
mbtn.addEventListener('click', () => setMusic(!musicOn));
document.addEventListener('visibilitychange', () => { if (document.hidden && musicOn) music.pause(); else if (musicOn) music.play().catch(() => {}); });

/* ---------- sparkle burst (fallback opening + ambient) ---------- */
function sparkles(ms = 3200, count = 150) {
  const dpr = Math.min(2, devicePixelRatio || 1); const w = fx.width = innerWidth * dpr, h = fx.height = innerHeight * dpr; const g = fx.getContext('2d');
  const colors = (css('--spark') || '#f3d9a0,#ffffff').split(',').map((s) => s.trim());
  const cx = w * (+css('--burst-x') || 0.5), cy = h * (+css('--burst-y') || 0.62);
  const P = Array.from({ length: count }, () => { const a = Math.random() * Math.PI * 2, v = (0.4 + Math.random() * 3.2) * dpr; return { x: cx + (Math.random() - 0.5) * 60 * dpr, y: cy + (Math.random() - 0.5) * 30 * dpr, vx: Math.cos(a) * v * 0.6, vy: -Math.abs(Math.sin(a)) * v * 1.2 - 0.5 * dpr, r: (0.6 + Math.random() * 2.2) * dpr, c: colors[(Math.random() * colors.length) | 0], life: 0.5 + Math.random() * 0.5, tw: Math.random() * 6 }; });
  const t0 = performance.now(); fx.classList.add('on');
  const frame = (t) => { const k = (t - t0) / ms; g.clearRect(0, 0, w, h);
    P.forEach((p) => { p.x += p.vx; p.y += p.vy; p.vy += 0.012 * dpr; p.vx *= 0.995; const a = Math.max(0, 1 - k / p.life) * (0.6 + 0.4 * Math.sin(p.tw + t / 90)); if (a <= 0) return; g.globalAlpha = a; g.fillStyle = p.c; g.shadowColor = p.c; g.shadowBlur = 8 * dpr; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 7); g.fill(); });
    if (k < 1) requestAnimationFrame(frame); else { g.clearRect(0, 0, w, h); fx.classList.remove('on'); } };
  requestAnimationFrame(frame);
}


/* ---------- Christmas decoration layer ---------- */
const svgCache = {};
async function loadArt(name) { return svgCache[name] ||= fetch(`art/${name}.svg`).then((r) => r.text()).catch(() => ''); }
async function mountArt(host) {
  const txt = await loadArt(host.dataset.art); if (!txt) return;
  host.innerHTML = txt; const svg = host.querySelector('svg'); if (!svg) return;
  const vb = (svg.getAttribute('viewBox') || '0 0 600 600').split(/\s+/).map(Number); const shown = host.clientWidth || svg.clientWidth || 200;
  svg.style.setProperty('--sw', (1.25 * vb[2] / Math.max(60, shown)).toFixed(2));
  svg.querySelectorAll('path,circle,line,polyline,ellipse').forEach((p, i) => { p.setAttribute('pathLength', '1'); p.style.setProperty('--pd', Math.min(1400, i * 28) + 'ms'); });
  host.classList.add('art');
  const io = new IntersectionObserver((es) => es.forEach((x) => { if (x.isIntersecting) { host.classList.add('in'); io.disconnect(); } }), { threshold: 0.25 });
  io.observe(host);
}
function lights(cfg) {
  const W = Math.max(360, innerWidth), swags = Math.max(4, Math.round(W / 96)), sw = W / swags, cols = (cfg.colors || '#ffd27a,#fff0c8,#ff8a6b').split(',').map((x) => x.trim());
  let d = `M0 3`, bulbs = '';
  for (let k = 0; k < swags; k++) {
    const x0 = k * sw, x1 = x0 + sw, cx = x0 + sw / 2, cy = 3 + (cfg.drop || 30); d += ` Q${cx} ${cy} ${x1} 3`;
    for (let j = 1; j <= 3; j++) { const t = j / 4, x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1, y = (1 - t) * (1 - t) * 3 + 2 * (1 - t) * t * cy + t * t * 3, c = cols[(k * 3 + j) % cols.length];
      bulbs += `<g class="bulb" style="animation-delay:${((k * 3 + j) * 0.37 % 2.4).toFixed(2)}s"><circle cx="${x.toFixed(1)}" cy="${(y + 7).toFixed(1)}" r="11" fill="${c}" opacity=".18"/><path d="M${(x - 3).toFixed(1)} ${(y + 1).toFixed(1)}h6l1 6a4 4 0 01-8 0z" fill="${c}"/></g>`; }
  }
  const box = el('div', 'lights'); box.innerHTML = `<svg viewBox="0 0 ${W} ${cfg.drop ? cfg.drop + 30 : 66}" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" fill="none" stroke="${cfg.wire || 'rgba(255,255,255,.35)'}" stroke-width="1.3"/>${bulbs}</svg>`;
  main.prepend(box);
}
function ambient(cfg) {
  if (!cfg || cfg.type === 'none' || reduce) return;
  const cv = el('canvas', 'ambient'); document.body.appendChild(cv); const g = cv.getContext('2d'); const dpr = Math.min(2, devicePixelRatio || 1); let w, h;
  const size = () => { w = cv.width = innerWidth * dpr; h = cv.height = innerHeight * dpr; }; size(); addEventListener('resize', size);
  const n = Math.round((cfg.count || 60) * Math.min(1, innerWidth / 430) * (innerWidth < 380 ? .8 : 1)), cols = (cfg.colors || '#ffffff').split(',').map((x) => x.trim()), sp = cfg.speed || 1, type = cfg.type;
  const mk = (init) => ({ x: Math.random() * w, y: init ? Math.random() * h : (type === 'embers' ? h + 10 : -12 * dpr), z: .3 + Math.random() * .7, ph: Math.random() * 6.28, c: cols[(Math.random() * cols.length) | 0], a: Math.random() });
  const P = Array.from({ length: n }, () => mk(true)); let t0 = performance.now(), run = true;
  document.addEventListener('visibilitychange', () => { run = !document.hidden; if (run) requestAnimationFrame(loop); });
  function loop(t) { if (!run) return; const dt = Math.min(48, t - t0) / 16.7; t0 = t; g.clearRect(0, 0, w, h);
    for (const p of P) {
      if (type === 'snow') { p.y += (0.35 + p.z * 1.1) * dpr * sp * dt; p.x += Math.sin(t / 1400 + p.ph) * 0.35 * dpr * dt; if (p.y > h + 10) Object.assign(p, mk(false), { x: Math.random() * w });
        g.globalAlpha = .25 + .6 * p.z; g.fillStyle = p.c; g.shadowColor = p.c; g.shadowBlur = 5 * dpr; g.beginPath(); g.arc(p.x, p.y, (0.7 + p.z * 2.2) * dpr, 0, 7); g.fill(); }
      else if (type === 'embers') { p.y -= (0.3 + p.z * 0.9) * dpr * sp * dt; p.x += Math.sin(t / 900 + p.ph) * 0.5 * dpr * dt; if (p.y < -10) Object.assign(p, mk(false), { x: Math.random() * w });
        g.globalAlpha = Math.min(1, p.y / h * 1.6) * (.5 + .5 * Math.sin(t / 220 + p.ph)) * .9; g.fillStyle = p.c; g.shadowColor = p.c; g.shadowBlur = 9 * dpr; g.beginPath(); g.arc(p.x, p.y, (0.6 + p.z * 1.6) * dpr, 0, 7); g.fill(); }
      else if (type === 'sparkle') { p.x += Math.sin(t / 3000 + p.ph) * .12 * dpr * dt; p.y += Math.cos(t / 3600 + p.ph) * .1 * dpr * dt; const a = Math.max(0, Math.sin(t / 700 + p.ph * 3)); g.globalAlpha = a * .9; g.fillStyle = p.c; g.shadowColor = p.c; g.shadowBlur = 10 * dpr; const r = (0.6 + p.z * 1.8) * dpr; g.beginPath(); g.arc(p.x, p.y, r, 0, 7); g.fill(); if (a > .85) { g.fillRect(p.x - r * 3, p.y - .4 * dpr, r * 6, .8 * dpr); g.fillRect(p.x - .4 * dpr, p.y - r * 3, .8 * dpr, r * 6); } }
      else if (type === 'confetti') { p.y += (0.5 + p.z * 1.2) * dpr * sp * dt; p.x += Math.sin(t / 900 + p.ph) * .6 * dpr * dt; if (p.y > h + 12) Object.assign(p, mk(false), { x: Math.random() * w }); g.save(); g.translate(p.x, p.y); g.rotate(t / 500 + p.ph); g.globalAlpha = .85; g.fillStyle = p.c; g.shadowBlur = 0; g.fillRect(-3 * dpr * p.z, -1.6 * dpr * p.z, 6 * dpr * p.z, 3.2 * dpr * p.z); g.restore(); }
    }
    g.globalAlpha = 1; requestAnimationFrame(loop); }
  requestAnimationFrame(loop);
}
function startDeco() {
  document.querySelectorAll('[data-art]').forEach(mountArt);
  (D.corners || []).forEach(() => {}); if (D.lights) lights(D.lights); if (D.ambient) ambient(D.ambient);
}
// corners (photographic garland overlays) are attached early so they show on the opening too
(D.corners || []).forEach((c) => { const mkc = () => { const i = el('img', `corner c-${c.pos}`); i.src = c.src; i.alt = ''; i.decoding = 'async'; if (c.w) i.style.setProperty('--cw', c.w); if (c.o) i.style.opacity = c.o; return i; }; opening.appendChild(mkc()); main.querySelector('.sec-hero')?.appendChild(mkc()); });

/* ---------- opening flow ---------- */
let opened = false;
function reveal() {
  if (main.hidden === false) return;
  main.hidden = false; mbtn.hidden = !music; document.body.classList.add('is-open');
  opening.classList.add('gone'); setTimeout(() => opening.remove(), 1400);
  tickCountdown(); startReveal(); startDeco(); document.dispatchEvent(new CustomEvent('card:open'));
}
/* ---- sound effects (tiny synthesized cues, licence-free) ---- */
let ac = null;
const noiseBuf = () => { const b = ac.createBuffer(1, ac.sampleRate, ac.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; };
const env = (g, t, a, d, v) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
const SFX = {
  whoosh(t, v) { const n = ac.createBufferSource(); n.buffer = noiseBuf(); const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.1; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(2600, t + .6); const g = ac.createGain(); env(g, t, .25, .5, v * .5); n.connect(f).connect(g).connect(ac.destination); n.start(t); n.stop(t + .9); },
  chime(t, v) { [880, 1318.5, 1760].forEach((fr, i) => { const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = fr; const g = ac.createGain(); env(g, t + i * .05, .01, 1.6 - i * .3, v * .22 / (i + 1)); o.connect(g).connect(ac.destination); o.start(t + i * .05); o.stop(t + 2.2); }); },
  pop(t, v) { const n = ac.createBufferSource(); n.buffer = noiseBuf(); const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 3200; const g = ac.createGain(); env(g, t, .002, .16, v); n.connect(f).connect(g).connect(ac.destination); n.start(t); n.stop(t + .3); const o = ac.createOscillator(); o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(40, t + .12); const g2 = ac.createGain(); env(g2, t, .003, .14, v * .8); o.connect(g2).connect(ac.destination); o.start(t); o.stop(t + .25); },
  knock(t, v) { [0, .3].forEach((dt) => { const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(130, t + dt); o.frequency.exponentialRampToValueAtTime(70, t + dt + .08); const g = ac.createGain(); env(g, t + dt, .004, .16, v * .9); o.connect(g).connect(ac.destination); o.start(t + dt); o.stop(t + dt + .3); }); },
  clack(t, v) { const n = ac.createBufferSource(); n.buffer = noiseBuf(); const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 3; const g = ac.createGain(); env(g, t, .002, .07, v * .7); n.connect(f).connect(g).connect(ac.destination); n.start(t); n.stop(t + .2); },
  whistle(t, v) { const o = ac.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(620, t); o.frequency.linearRampToValueAtTime(700, t + .9); const l = ac.createOscillator(); l.frequency.value = 6; const lg = ac.createGain(); lg.gain.value = 14; l.connect(lg).connect(o.frequency); const g = ac.createGain(); env(g, t, .12, .8, v * .25); o.connect(g).connect(ac.destination); o.start(t); l.start(t); o.stop(t + 1.2); l.stop(t + 1.2); },
  ignite(t, v) { const n = ac.createBufferSource(); n.buffer = noiseBuf(); const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500; const g = ac.createGain(); env(g, t, .02, .22, v * .35); n.connect(f).connect(g).connect(ac.destination); n.start(t); n.stop(t + .4); SFX.chime(t + .12, v * .5); },
};
function playSfx(name, v = 1) { try { if (!ac || !musicOn || !SFX[name]) return; SFX[name](ac.currentTime + .02, v); } catch { /* audio is optional */ } }
function sfxPlan() { (C.stage.sfx || []).forEach((x) => setTimeout(() => playSfx(x.name, x.v), x.t * 1000)); }

/* ---- hold the last frame as a still, so nothing depends on a paused <video> (iOS) ---- */
function holdLast() {
  if (!C.stage.holdFrame || !video) return;
  const img = new Image(); img.onload = () => { poster.src = C.stage.holdFrame; requestAnimationFrame(() => { video?.classList.add('held'); try { video?.pause(); } catch {} }); }; img.src = C.stage.holdFrame;
}
let blobTried = false;
async function blobPlay(fin) {
  if (blobTried || !video) return; blobTried = true;
  try { const r = await fetch(C.stage.video); const u = URL.createObjectURL(await r.blob()); video.src = u; video.load(); await video.play(); }
  catch { video?.remove(); video = null; fallback(); }
}
async function open() {
  if (opened) return; opened = true; document.body.classList.add('opening-now');
  try { ac ||= new (window.AudioContext || window.webkitAudioContext)(); ac.resume?.(); } catch { ac = null; }
  setMusic(true);
  opening.classList.add('go');
  if (!video || reduce) return fallback();
  const finishAt = (+C.stage.revealAt || 0) * 1000;
  let done = false, started = false;
  const fin = () => { if (done) return; done = true; holdLast(); reveal(); };
  const begin = () => { if (started) return; started = true; document.body.classList.add('video-playing'); sfxPlan(); };
  video.addEventListener('playing', begin, { once: true });
  video.addEventListener('ended', fin, { once: true });
  if (finishAt) video.addEventListener('timeupdate', () => { if (video && video.currentTime * 1000 >= finishAt) fin(); });
  setTimeout(fin, 16000);
  try { video.currentTime = 0; await video.play(); } catch { blobPlay(); }
  setTimeout(() => { if (!started && !done) blobPlay(); }, 4000);   // Apple WebKit stall guard
  setTimeout(() => { if (!started && !done) { video?.remove(); video = null; fallback(); } }, 9000);
}
function fallback() {
  document.body.classList.add('fx-open');
  if (!reduce) sparkles(); setTimeout(reveal, reduce ? 200 : 2600);
}
if (!O.custom) {
  $('.op-tap', opening).addEventListener('click', open);
  opening.addEventListener('click', (e) => { if (!e.target.closest('.op-tap')) open(); });
} else { opening.classList.add('custom'); opening.querySelector('.op-tap')?.remove(); }
document.dispatchEvent(new CustomEvent('card:ready', { detail: { open, reveal, sparkles, setMusic, opening, stage, poster, media, el, $, reduce } }));
