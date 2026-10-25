// "Pedestrians around the globe": the turning globe of CROWD localities from Pavlo Bazilinskyy's site
// (bazilinskyy/bazilinskyy.github.io, _includes/crowd-globe.html), adapted for this page. Its data,
// js/crowd-globe.json, is rebuilt every night there from the mapping of github.com/crowd-dataset/crowd:
// points are [lat, lon, hours, videos, segments new in a month, in a week, name, video, start].
(function () {
  const DATA_URL = 'https://raw.githubusercontent.com/bazilinskyy/bazilinskyy.github.io/master/js/crowd-globe.json';
  const box = document.getElementById('crowd-globe');
  if (!box) return;
  const cv = box.querySelector('canvas'), ctx = cv.getContext('2d');
  const tip = document.getElementById('crowd-globe-tip'), FPS = 30, SPEED = 6;  // frames per second, degrees per second
  const css = (name) => getComputedStyle(box).getPropertyValue(name).trim();
  const fmt = (n) => n.toLocaleString('en-GB');
  const videos = (n) => `${fmt(n)} video${n === 1 ? '' : 's'}`;
  let size, R, proj, path, land, borders, tiers = [[], [], []], data, shown = [], rot = [-10, -22];
  let hover = false, held = 0, lastT = 0, visible = false, running = false;
  let fly = null, picked = null;  // the flight to a random place and that place

  function setup() {
    size = Math.min(box.querySelector('.crowd-globe-stage').clientWidth, 620); R = size / 2 - 2;
    const dpr = devicePixelRatio || 1;
    cv.width = cv.height = Math.round(size * dpr); cv.style.width = cv.style.height = `${size}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    proj = d3.geoOrthographic().scale(R).translate([size / 2, size / 2]).clipAngle(90).precision(1.5);
    path = d3.geoPath(proj, ctx);
  }

  function draw(t = performance.now()) {
    proj.rotate(rot);
    ctx.clearRect(0, 0, size, size);
    ctx.beginPath(); path({ type: 'Sphere' }); ctx.fillStyle = css('--sea'); ctx.fill();
    ctx.beginPath(); path(d3.geoGraticule10()); ctx.strokeStyle = css('--grat'); ctx.lineWidth = 0.6; ctx.stroke();
    if (land) {
      ctx.beginPath(); path(land); ctx.fillStyle = css('--land'); ctx.fill();
      ctx.beginPath(); path(borders); ctx.strokeStyle = css('--border'); ctx.lineWidth = 0.5; ctx.stroke();
    }
    // The points by hand (orthographic, centre at -rot): a few multiplications each instead of d3's projection.
    const c0 = size / 2, lon0 = -rot[0] * Math.PI / 180, lat0 = -rot[1] * Math.PI / 180, s0 = Math.sin(lat0), k0 = Math.cos(lat0);
    const pulse = (t / 1600) % 1;
    const place = (p) => {
      const dl = p.lon - lon0, cd = Math.cos(dl);
      if (s0 * p.s + k0 * p.k * cd < 0.02) return null;  // on the far side
      return [c0 + R * p.k * Math.sin(dl), c0 - R * (k0 * p.s - s0 * p.k * cd)];
    };
    shown = [];
    tiers.forEach((list, tier) => {  // older first (small squares), then the last month, then the last week on top
      ctx.beginPath();
      for (const p of list) {
        const xy = place(p);
        if (!xy) continue;
        const [x, y] = xy;
        if (tier) { const r = 2.6 + tier * 0.5; ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, 2 * Math.PI); }
        else ctx.rect(x - p.r, y - p.r, 2 * p.r, 2 * p.r);
        shown.push([x, y, p]);
      }
      ctx.globalAlpha = tier ? 1 : 0.6;
      ctx.fillStyle = css(['--dot', '--recent', '--day'][tier]); ctx.fill();
      if (tier) { ctx.lineWidth = 0.8; ctx.strokeStyle = css('--sea'); ctx.stroke(); }
      ctx.globalAlpha = 1;
    });
    ctx.beginPath();  // the last week's places pulse
    for (const p of tiers[2]) {
      const xy = place(p);
      if (!xy) continue;
      const r = 3.1 + 9 * pulse;
      ctx.moveTo(xy[0] + r, xy[1]); ctx.arc(xy[0], xy[1], r, 0, 2 * Math.PI);
    }
    ctx.globalAlpha = 0.7 * (1 - pulse); ctx.strokeStyle = css('--day'); ctx.lineWidth = 1.2; ctx.stroke(); ctx.globalAlpha = 1;
    const xy = picked && place(picked);  // the place "Take me somewhere" chose
    if (xy) {
      ctx.beginPath(); ctx.arc(xy[0], xy[1], 7, 0, 2 * Math.PI);
      ctx.moveTo(xy[0] - 12, xy[1]); ctx.lineTo(xy[0] - 4, xy[1]); ctx.moveTo(xy[0] + 4, xy[1]); ctx.lineTo(xy[0] + 12, xy[1]);
      ctx.moveTo(xy[0], xy[1] - 12); ctx.lineTo(xy[0], xy[1] - 4); ctx.moveTo(xy[0], xy[1] + 4); ctx.lineTo(xy[0], xy[1] + 12);
      ctx.strokeStyle = css('--day'); ctx.lineWidth = 2; ctx.stroke();
    }
  }

  function frame(t) {  // turns only while on screen
    if (!visible || document.hidden) { running = false; return; }
    requestAnimationFrame(frame);
    if (t - lastT < 1000 / FPS) return;
    if (fly) {  // eased turn to the chosen place, then it stays there a while
      const k = Math.min(1, (t - fly.t0) / 1500), e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      rot = [fly.from[0] + e * fly.d[0], fly.from[1] + e * fly.d[1]];
      if (k === 1) { fly = null; held = t + 20000; }
    } else if (!hover && t > held && !reducedMotion) rot[0] += SPEED * Math.min(t - lastT, 250) / 1000;
    lastT = t;
    draw(t);
  }
  function start() {
    if (running || !visible || document.hidden || !proj) return;
    running = true; lastT = performance.now(); requestAnimationFrame(frame);
  }
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function legendItem(colour, text) {
    const item = document.createElement('span');
    const swatch = document.createElement('i');
    swatch.style.background = `var(${colour})`;
    item.append(swatch, text);
    return item;
  }

  function stat(value, label) {
    const card = document.createElement('div');
    card.className = 'globe-stat';
    const strong = document.createElement('strong');
    strong.textContent = value;
    const span = document.createElement('span');
    span.textContent = label;
    card.append(strong, span);
    return card;
  }

  const script = (src) => new Promise((ok, fail) => {
    const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = fail; document.head.appendChild(s);
  });

  async function init() {
    if (!window.d3) await script('https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js');
    if (!window.topojson) await script('https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/dist/topojson-client.min.js');
    setup();
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json').then((r) => r.json()).then((w) => {
      land = topojson.feature(w, w.objects.land);
      borders = topojson.mesh(w, w.objects.countries, (a, b) => a !== b);
      draw();
    }).catch(() => {});
    data = await (await fetch(DATA_URL, { cache: 'no-cache' })).json();
    for (const [lat, lon, h, count, month, week, name, video, startAt] of data.points) {
      tiers[week ? 2 : month ? 1 : 0].push({
        lon: lon * Math.PI / 180, s: Math.sin(lat * Math.PI / 180), k: Math.cos(lat * Math.PI / 180),
        r: 0.6 + Math.min(1.9, Math.sqrt(h) / 10), h, videos: count, month, week, name, video, start: startAt, lat, lng: lon,
      });
    }

    document.getElementById('crowd-globe-stats')?.replaceChildren(
      stat(`+${fmt(data.week)}`, `segments in the last week, in ${fmt(data.week_places)} places`),
      stat(`+${fmt(data.month)}`, `segments in the last month, in ${fmt(data.month_places)} places`),
      stat(fmt(data.localities), `localities in ${data.countries} countries and territories`),
      stat(`${fmt(data.hours)} h`, `of footage in ${fmt(data.videos)} videos`),
    );
    document.getElementById('crowd-globe-leg').replaceChildren(
      legendItem('--day', 'Added in the last 7 days'),
      legendItem('--recent', 'Last 30 days'),
      legendItem('--dot', `${fmt(data.localities)} places`),
    );
    const date = document.getElementById('crowd-globe-date');
    if (date) date.textContent = `Last update on ${
      new Date(data.built).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.`;
    draw(); start();
    addEventListener('resize', () => { setup(); draw(); });
    d3.select(cv).call(d3.drag().on('drag', (e) => {
      rot[0] += e.dx * 0.4; rot[1] = Math.max(-80, Math.min(80, rot[1] - e.dy * 0.4));
      held = performance.now() + 4000; fly = null; draw();
    }));

    const go = document.getElementById('crowd-globe-go'), close = document.getElementById('crowd-globe-close');
    const all = tiers.flat().filter((p) => p.video);
    go.hidden = false;
    go.addEventListener('click', () => {  // turn to a random place and play its longest segment
      picked = all[Math.floor(Math.random() * all.length)];
      const to = [-picked.lng, Math.max(-60, Math.min(60, -picked.lat))];
      const d0 = ((to[0] - rot[0]) % 360 + 540) % 360 - 180;  // the short way round
      fly = { t0: performance.now(), from: rot.slice(), d: [d0, to[1] - rot[1]] };
      const v = document.getElementById('crowd-globe-video'), id = encodeURIComponent(picked.video);
      const player = Object.assign(document.createElement('iframe'), {
        title: `Dashcam footage from ${picked.name}`, allow: 'autoplay; encrypted-media; picture-in-picture', allowFullscreen: true,
        src: `https://www.youtube-nocookie.com/embed/${id}?start=${picked.start}&autoplay=1&mute=1&rel=0`,
      });
      const caption = document.createElement('div');
      const link = Object.assign(document.createElement('a'), {
        href: `https://www.youtube.com/watch?v=${id}&t=${picked.start}s`, target: '_blank', rel: 'noreferrer noopener', textContent: 'open on YouTube',
      });
      caption.append(`${picked.name}: ${fmt(picked.h)} h of footage in ${videos(picked.videos)} (`, link, ')');
      v.replaceChildren(player, caption);
      v.hidden = false;
      go.textContent = 'Take me somewhere else'; close.hidden = false;
      start();
    });
    close.addEventListener('click', () => {  // back to how it was before: no video, no marker, the globe turning
      const v = document.getElementById('crowd-globe-video');
      v.replaceChildren(); v.hidden = true;
      picked = null; fly = null; held = 0;
      go.textContent = 'Take me somewhere'; close.hidden = true;
      draw(); start();
    });
  }

  function nearest(e) {  // the place within 8 px of the pointer; ties: the newer (drawn later)
    const b = cv.getBoundingClientRect(), mx = e.clientX - b.left, my = e.clientY - b.top;
    let best = null, bd = 64;
    for (const [x, y, p] of shown) { const d = (x - mx) ** 2 + (y - my) ** 2; if (d <= bd) { bd = d; best = p; } }
    return best;
  }
  cv.addEventListener('click', (e) => {  // d3.drag swallows the click that ends a drag
    const p = nearest(e);
    if (p && p.video) open(`https://www.youtube.com/watch?v=${encodeURIComponent(p.video)}&t=${p.start}s`, '_blank', 'noopener');
  });
  cv.addEventListener('mousemove', (e) => {
    const best = nearest(e);
    hover = true;
    cv.style.cursor = best && best.video ? 'pointer' : '';
    if (!best) { tip.style.display = 'none'; return; }
    const line = (cls, text) => Object.assign(document.createElement('div'), { className: cls, textContent: text });
    tip.replaceChildren(line('n', best.name), line('', `${fmt(best.h)} h of footage in ${videos(best.videos)}`));
    if (best.month) tip.append(line('r', `+${fmt(best.month)} segments in the last month`));
    if (best.week) tip.append(line('d', `+${fmt(best.week)} in the last week`));
    if (best.video) tip.append(line('m', 'Footage on YouTube \u2197'));
    tip.style.display = 'block';
    tip.style.left = `${Math.min(e.clientX + 12, innerWidth - tip.offsetWidth - 4)}px`;
    tip.style.top = `${Math.min(e.clientY + 12, innerHeight - tip.offsetHeight - 4)}px`;
  });
  cv.addEventListener('mouseleave', () => { hover = false; tip.style.display = 'none'; });
  document.addEventListener('visibilitychange', start);

  let loading = null;  // the libraries and data load only once the globe scrolls into view
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible && !loading) {
      loading = init().catch((error) => {
        console.error('crowd globe:', error);
        const date = document.getElementById('crowd-globe-date');
        if (date) date.textContent = 'The globe could not be loaded just now.';
      });
    }
    start();
  }, { rootMargin: '200px' }).observe(box);
})();
