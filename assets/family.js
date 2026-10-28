// CROWD Walking and CROWD Crash: draws a page from its summary (data/walking.json or data/crash.json,
// written by tools/build_family_data.py). The page names the file in <body data-summary="...">.
(function () {
  const source = document.body.dataset.summary;
  if (!source) return;
  const format = (value, decimals = 0) => Number(value).toLocaleString('en-GB', { maximumFractionDigits: decimals });
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  // Categorical slots from the site palette (checked for colour-blind readers in day and night).
  // paletteVar for page elements (follows the day/night switch); palette for the canvas.
  const paletteVar = (index) => (index >= 0 && index < 8 ? `var(--series-${index + 1})` : 'var(--ink-3)');
  const palette = (index) => (index >= 0 && index < 8 ? css(`--series-${index + 1}`) : css('--ink-3'));
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  function renderStats(stats) {
    const grid = document.getElementById('familyStats');
    if (!grid) return;
    grid.replaceChildren(...stats.map(([label, value]) => {
      const card = make('div', 'stat-card');
      card.append(make('div', 'stat-value', format(value)), make('div', 'stat-label', label));
      return card;
    }));
  }

  // Ranked horizontal bars: a share of the total next to each count.
  // Ranked horizontal bars: a share of the total next to each count. Colours follow the category
  // (data-facet: the same colour as on the map), the country's continent, or the rank (data-colors).
  function renderBars(node, rows, data) {
    const limit = Number(node.dataset.limit) || rows.length;
    const unit = node.dataset.unit || '';
    const decimals = Number(node.dataset.decimals) || 0;
    const shown = rows.filter(([name]) => node.dataset.dropUnknown === undefined || name !== 'Unknown').slice(0, limit);
    const total = rows.reduce((sum, [, value]) => sum + value, 0);
    const most = Math.max(...shown.map(([, value]) => value));
    const facet = node.dataset.facet && (data.facets || {})[node.dataset.facet];
    const colourOf = (row, index) => {
      if (facet) return row[0] === (data.facet_neutral || {})[node.dataset.facet] ? paletteVar(-1) : paletteVar(facet.indexOf(row[0]));
      if (node.dataset.colors === 'continent') return paletteVar((data.continent_order || []).indexOf(row[2] || row[0]));
      if (node.dataset.colors === 'rank') return paletteVar(index);
      return index === 0 ? 'var(--signal)' : 'var(--ink)';
    };
    node.replaceChildren(...shown.map((row, index) => {
      const [name, value] = row;
      const line = make('li', 'bar-row');
      const bar = make('span', 'bar-track');
      const fill = make('span', 'bar-fill');
      fill.style.width = `${(value / most) * 100}%`;
      fill.style.background = colourOf(row, index);
      bar.append(fill);
      line.title = `${name}: ${format(value, decimals)}${unit} (${format((value / total) * 100, 1)}%)`;
      const label = make('span', 'bar-name', name);
      if (row[2] && node.dataset.colors === 'continent') label.append(make('span', 'bar-note', row[2]));
      line.append(label, make('span', 'bar-value', `${format(value, decimals)}${unit}`), bar);
      return line;
    }));
  }

  function renderHistogram(node, { edges, counts, unit }) {
    const most = Math.max(...counts);
    const short = unit === 'minutes' ? 'min' : 's';
    node.replaceChildren(...counts.map((count, index) => {
      const low = edges[index];
      const high = edges[index + 1];
      const range = high === null || high === undefined ? `${format(low)}+ ${short}` : `${format(low, 1)}–${format(Math.floor(high * 10) / 10, 1)}`;
      const column = make('li', 'hist-column');
      column.setAttribute('aria-label', `${range} ${high === null ? '' : short}: ${format(count)} segments`);
      const bar = make('span', 'hist-bar');
      bar.style.height = `calc((100% - 46px) * ${count / most})`;
      column.append(make('span', 'hist-count', format(count)), bar, make('span', 'hist-label', range));
      return column;
    }));
    const caption = node.parentElement.querySelector('.hist-unit');
    if (caption) caption.textContent = unit === 'minutes' ? 'Segment length (minutes)' : 'Clip length (seconds)';
  }

  // Uploads per month: one column a month, the year written under each January (and the first month).
  function renderColumns(node, rows) {
    const most = Math.max(...rows.map(([, count]) => count));
    const monthName = (key) => new Date(`${key}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    node.replaceChildren(...rows.map(([key, count], index) => {
      const column = make('li', key === 'Earlier' ? 'month-column is-earlier' : 'month-column');
      // Years go under each January (and the first month, unless 'Earlier' already sits there).
      const label = key === 'Earlier' ? 'Earlier' : (key.endsWith('-01') || index === 0) ? key.slice(0, 4) : '';
      column.title = `${key === 'Earlier' ? 'Earlier' : monthName(key)}: ${format(count)} videos`;
      column.setAttribute('aria-label', column.title);
      const bar = make('span', 'month-bar');
      bar.style.height = `calc(100% * ${count / most})`;
      column.append(bar, make('span', 'month-label', label));
      return column;
    }));
  }

  const escapeText = (text) => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  // Colour of a category name: its place in the named facet, the continent order, or grey.
  const colourFor = (name, data, facetName) => {
    const list = facetName === 'continent' ? data.continent_order || [] : (data.facets || {})[facetName] || [];
    if ((data.facet_neutral || {})[facetName] === name) return paletteVar(-1);
    return paletteVar(list.indexOf(name));
  };
  const legend = (names, colourOf) => {
    const box = make('div', 'chart-legend');
    names.forEach((name) => {
      const item = make('span', 'legend-item');
      const swatch = make('i');
      swatch.style.background = colourOf(name);
      item.append(swatch, name);
      box.append(item);
    });
    return box;
  };

  // 100% stacked bars: each row split into its columns' shares.
  function renderStacked(node, spec, data) {
    const unit = node.dataset.unit || '';
    const colourOf = (name) => colourFor(name, data, node.dataset.facet);
    const rows = spec.rows.map((name, index) => [name, spec.values[index]]).filter(([, values]) => values.some(Boolean));
    const list = make('ol', 'stack-list');
    rows.forEach(([name, values]) => {
      const total = values.reduce((sum, value) => sum + value, 0);
      const row = make('li', 'stack-row');
      const bar = make('span', 'stack-bar');
      values.forEach((value, index) => {
        if (!value) return;
        const part = make('span', 'stack-part');
        part.style.flexGrow = value;
        part.style.background = colourOf(spec.cols[index]);
        part.title = `${name} · ${spec.cols[index]}: ${format((value / total) * 100, 1)}% (${format(value, unit ? 0 : 0)}${unit})`;
        const share = (value / total) * 100;
        if (share >= 9) part.textContent = `${format(share)}%`;
        bar.append(part);
      });
      row.append(make('span', 'stack-name', name), make('span', 'stack-total', `${format(total)}${unit}`), bar);
      list.append(row);
    });
    node.replaceChildren(legend(spec.cols.filter((_, index) => rows.some(([, values]) => values[index])), colourOf), list);
  }

  // Ranked city bars with a still from that city's clip where there is one.
  function renderCities(node, rows, data) {
    const most = Math.max(...rows.map((row) => row[1]));
    node.replaceChildren(...rows.map(([name, hours, continent, slug], index) => {
      const [city, ...rest] = name.split(',');
      const item = make('li', 'city-row');
      const thumb = make('span', 'city-thumb');
      if (slug) {
        const image = make('img');
        image.src = `../assets/clips/walking/${slug}.jpg`;
        image.alt = '';
        image.loading = 'lazy';
        thumb.append(image);
      } else {
        thumb.style.background = colourFor(continent, data, 'continent');
        thumb.textContent = city.trim().slice(0, 1);
      }
      const text = make('span', 'city-text');
      text.append(make('span', 'city-name', `${index + 1}. ${city.trim()}`), make('span', 'city-where', rest.join(',').trim()));
      const bar = make('span', 'bar-track');
      const fill = make('span', 'bar-fill');
      fill.style.width = `${(hours / most) * 100}%`;
      fill.style.background = colourFor(continent, data, 'continent');
      bar.append(fill);
      item.append(thumb, text, make('span', 'bar-value', `${format(hours)} h`), bar);
      return item;
    }));
  }

  // Cumulative share of the footage held by the largest N channels (log scale on N).
  function renderCurve(node, points, total) {
    const width = 600;
    const height = 280;
    const pad = { left: 44, right: 16, top: 16, bottom: 34 };
    const n = points[points.length - 1][0];
    const x = (rank) => pad.left + (Math.log10(rank) / Math.log10(n)) * (width - pad.left - pad.right);
    const y = (share) => pad.top + (1 - share / 100) * (height - pad.top - pad.bottom);
    const line = points.map(([rank, share], index) => `${index ? 'L' : 'M'}${x(rank).toFixed(1)},${y(share).toFixed(1)}`).join('');
    const area = `${line}L${x(n).toFixed(1)},${y(0)}L${x(1).toFixed(1)},${y(0)}Z`;
    const at = (rank) => points.reduce((best, point) => (Math.abs(point[0] - rank) < Math.abs(best[0] - rank) ? point : best));
    const marks = [1, 10, 100].filter((rank) => rank < n).map((rank) => {
      const [r, share] = at(rank);
      return `<circle cx="${x(r)}" cy="${y(share)}" r="4.5" class="curve-dot"/><text x="${x(r) + 8}" y="${y(share) + 16}" class="curve-label">Top ${format(r)}: ${format(share)}%</text>`;
    }).join('');
    const yTicks = [0, 25, 50, 75, 100].map((t) => `<line x1="${pad.left}" x2="${width - pad.right}" y1="${y(t)}" y2="${y(t)}" class="grid"/><text x="${pad.left - 8}" y="${y(t) + 4}" class="axis" text-anchor="end">${t}%</text>`).join('');
    const xTicks = [1, 10, 100, n].filter((t, i, all) => t <= n && all.indexOf(t) === i).map((t) => `<text x="${x(t)}" y="${height - 10}" class="axis" text-anchor="middle">${format(t)}</text>`).join('');
    node.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Share of footage from the largest channels, rising to 100% at ${format(total)} channels">${yTicks}${xTicks}<path d="${area}" class="curve-area"/><path d="${line}" class="curve-line"/>${marks}</svg><p class="axis-caption">Number of channels, largest first (log scale)</p>`;
  }

  // Walking hours against CROWD driving hours per country, both on log scales, coloured by continent.
  function renderScatter(node, rows, data) {
    const width = 600;
    const height = 380;
    const pad = { left: 52, right: 18, top: 16, bottom: 40 };
    const xs = rows.map((row) => row[2]);
    const ys = rows.map((row) => row[1]);
    const lx = [Math.floor(Math.log10(Math.min(...xs))), Math.ceil(Math.log10(Math.max(...xs)))];
    const ly = [Math.floor(Math.log10(Math.min(...ys))), Math.ceil(Math.log10(Math.max(...ys)))];
    const x = (v) => pad.left + ((Math.log10(v) - lx[0]) / (lx[1] - lx[0])) * (width - pad.left - pad.right);
    const y = (v) => pad.top + (1 - (Math.log10(v) - ly[0]) / (ly[1] - ly[0])) * (height - pad.top - pad.bottom);
    const ratio = ys.reduce((a, b) => a + b, 0) / xs.reduce((a, b) => a + b, 0);
    const lineFrom = Math.max(10 ** lx[0], 10 ** ly[0] / ratio);
    const lineTo = Math.min(10 ** lx[1], 10 ** ly[1] / ratio);
    const grid = [];
    for (let e = lx[0]; e <= lx[1]; e += 1) grid.push(`<line x1="${x(10 ** e)}" x2="${x(10 ** e)}" y1="${pad.top}" y2="${height - pad.bottom}" class="grid"/><text x="${x(10 ** e)}" y="${height - 18}" class="axis" text-anchor="middle">${format(10 ** e)} h</text>`);
    for (let e = ly[0]; e <= ly[1]; e += 1) grid.push(`<line x1="${pad.left}" x2="${width - pad.right}" y1="${y(10 ** e)}" y2="${y(10 ** e)}" class="grid"/><text x="${pad.left - 8}" y="${y(10 ** e) + 4}" class="axis" text-anchor="end">${format(10 ** e)} h</text>`);
    // Label the largest walkers and the countries furthest above or below the overall ratio.
    const byWalk = [...rows].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const byLean = [...rows].filter((row) => row[1] >= 5).sort((a, b) => b[1] / b[2] - a[1] / a[2]);
    const labelled = new Set([...byWalk, ...byLean.slice(0, 3), ...byLean.slice(-2)].map((row) => row[0]));
    const dots = [...rows].sort((a, b) => b[1] - a[1]).map(([name, walk, drive, continent]) => {
      const cx = x(drive).toFixed(1);
      const cy = y(walk).toFixed(1);
      const text = labelled.has(name) ? `<text x="${+cx + 7}" y="${+cy + 4}" class="dot-label">${escapeText(name)}</text>` : '';
      return `<g><title>${escapeText(name)}: ${format(walk)} h walking, ${format(drive)} h driving</title><circle cx="${cx}" cy="${cy}" r="5" style="fill:${colourFor(continent, data, 'continent')}" class="scatter-dot"/>${text}</g>`;
    }).join('');
    node.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Walking hours against driving hours per country">${grid.join('')}<line x1="${x(lineFrom)}" y1="${y(lineFrom * ratio)}" x2="${x(lineTo)}" y2="${y(lineTo * ratio)}" class="ratio-line"/>${dots}</svg>`;
    node.append(legend((data.continent_order || []).filter((c) => rows.some((row) => row[3] === c)), (name) => colourFor(name, data, 'continent')));
    const note = make('p', 'axis-caption', `Across: hours of CROWD driving footage. Up: hours of walking footage. Dashed: the overall ratio, one hour of walking for every ${format(1 / ratio)} hours of driving.`);
    node.append(note);
  }

  // Shares in a grid: each crash type's clips spread over the conditions of each group.
  function renderHeatmap(node, spec, data) {
    const table = make('table', 'heatmap');
    const head = make('thead');
    const groupRow = make('tr');
    groupRow.append(make('th', 'heat-corner', ''));
    spec.groups.forEach((group) => {
      const cell = make('th', 'heat-group', group.name);
      cell.colSpan = group.cols.length;
      groupRow.append(cell);
    });
    const colRow = make('tr');
    colRow.append(make('th', 'heat-corner', 'Crash type'));
    spec.groups.forEach((group) => group.cols.forEach((col, index) => colRow.append(make('th', index === 0 ? 'heat-col is-first' : 'heat-col', col))));
    head.append(groupRow, colRow);
    const body = make('tbody');
    spec.rows.forEach((type, rowIndex) => {
      const total = spec.totals[rowIndex];
      if (!total) return;
      const row = make('tr');
      const name = make('th', 'heat-row');
      const swatch = make('i');
      swatch.style.background = colourFor(type, data, 'Crash type');
      name.append(swatch, type, make('span', 'heat-n', format(total)));
      row.append(name);
      spec.groups.forEach((group) => group.values[rowIndex].forEach((value, index) => {
        const share = (value / total) * 100;
        const cell = make('td', index === 0 ? 'heat-cell is-first' : 'heat-cell', `${format(share)}%`);
        cell.style.setProperty('--heat', `${Math.min(100, share)}%`);
        cell.classList.toggle('is-strong', share >= 55);
        cell.title = `${type}, ${group.cols[index].toLowerCase()}: ${format(value)} of ${format(total)} clips`;
        row.append(cell);
      }));
      body.append(row);
    });
    table.append(head, body);
    const wrap = make('div', 'table-wrap heat-wrap');
    wrap.append(table);
    node.replaceChildren(wrap);
  }

  // Which road users appear together: of the clips with the row's road user, the share that also show the column's.
  function renderCooccurrence(node, spec) {
    const { names, values } = spec;
    const table = make('table', 'heatmap cooc');
    const head = make('tr');
    head.append(make('th', 'heat-corner', 'Clips with…'));
    names.forEach((name) => head.append(make('th', 'heat-col cooc-col', name)));
    const thead = make('thead');
    thead.append(head);
    const body = make('tbody');
    names.forEach((name, i) => {
      const row = make('tr');
      const label = make('th', 'heat-row', name);
      label.append(make('span', 'heat-n', format(values[i][i])));
      row.append(label);
      names.forEach((other, j) => {
        if (i === j) {
          row.append(make('td', 'heat-cell is-self', '·'));
          return;
        }
        const share = (values[i][j] / values[i][i]) * 100;
        const cell = make('td', 'heat-cell', `${format(share)}%`);
        cell.style.setProperty('--heat', `${Math.min(100, share)}%`);
        cell.classList.toggle('is-strong', share >= 55);
        cell.title = `${format(values[i][j])} of ${format(values[i][i])} clips with ${name.toLowerCase()} also show ${other.toLowerCase()}`;
        row.append(cell);
      });
      body.append(row);
    });
    table.append(thead, body);
    const wrap = make('div', 'table-wrap heat-wrap');
    wrap.append(table);
    node.replaceChildren(wrap);
  }

  // Box plots of clip length per crash type: whiskers from 5th to 95th percentile, box from quartile to quartile.
  function renderBoxes(node, rows, data) {
    const max = Math.ceil(Math.max(...rows.map(([, q]) => q[4])) / 10) * 10;
    const at = (value) => `${(value / max) * 100}%`;
    const list = make('ol', 'box-list');
    rows.forEach(([type, [p5, q1, median, q3, p95], n]) => {
      const row = make('li', 'box-row');
      row.title = `${type} (${format(n)} clips): median ${format(median, 1)} s, middle half ${format(q1, 1)}–${format(q3, 1)} s`;
      const track = make('span', 'box-track');
      const whisker = make('span', 'box-whisker');
      whisker.style.left = at(p5);
      whisker.style.width = `calc(${at(p95)} - ${at(p5)})`;
      const box = make('span', 'box-box');
      box.style.left = at(q1);
      box.style.width = `calc(${at(q3)} - ${at(q1)})`;
      box.style.background = colourFor(type, data, 'Crash type');
      const mid = make('span', 'box-median');
      mid.style.left = at(median);
      track.append(whisker, box, mid);
      row.append(make('span', 'box-name', type), make('span', 'bar-value', `${format(median, 1)} s`), track);
      list.append(row);
    });
    const axis = make('div', 'box-axis');
    [0, max / 4, max / 2, (3 * max) / 4, max].forEach((tick) => {
      const label = make('span', '', `${format(tick)} s`);
      label.style.left = at(tick);
      axis.append(label);
    });
    node.replaceChildren(list, axis);
  }

  // Ranked dots: the night share of each country's clips, on one shared scale.
  function renderDots(node, rows, data) {
    const max = Math.ceil(Math.max(...rows.map((row) => row[1])) / 5) * 5;
    node.replaceChildren(...rows.map(([name, share, n, continent]) => {
      const row = make('li', 'dot-row');
      row.title = `${name}: ${format(share, 1)}% of ${format(n)} clips at night`;
      const track = make('span', 'dot-track');
      const dot = make('span', 'dot-mark');
      dot.style.left = `${(share / max) * 100}%`;
      dot.style.background = colourFor(continent, data, 'continent');
      track.append(dot);
      const label = make('span', 'bar-name', name);
      label.append(make('span', 'bar-note', `${format(n)} clips`));
      row.append(label, make('span', 'bar-value', `${format(share, 1)}%`), track);
      return row;
    }));
  }

  // The map: a turning globe (or a flat Equal Earth map) of every place, dots sized by footage.
  // Buttons above it show one category at a time, growing its dots in; a key gives real values at
  // the map's scale; pointing at a dot names the place. On the Walking page, CROWD's driving places
  // can be laid underneath for comparison.
  function renderMap(data) {
    const holder = document.getElementById('familyMap');
    if (!holder) return;
    const points = data.points;
    const [singular, plural] = data.point_unit || ['', ''];
    const facets = Object.entries(data.facets || {});
    const canvas = holder.querySelector('canvas');
    const context = canvas.getContext('2d');
    const section = holder.closest('.container');
    const key = section.querySelector('.map-key');
    const controls = section.querySelector('.map-controls');
    const tip = make('div', 'map-tip');
    const ring = make('span', 'map-ring');
    tip.hidden = true;
    ring.hidden = true;
    holder.append(ring, tip);
    const most = Math.max(...points.map((point) => point[2]));
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    // facet: the grouping that colours the dots; category: one category shown alone, or -1 for all.
    const state = { view: 'globe', facet: facets.length ? 0 : -1, category: -1, driving: false };
    let land = null;
    let driving = null;
    let placed = [];
    let rotation = [-10, -25];
    let size = { width: 0, height: 0, scale: 1 };
    let grow = 1;
    let growStart = 0;
    let hovering = false;
    let heldUntil = 0;
    let running = false;
    let visible = false;
    let last = 0;

    const amountOf = (point) => (state.facet < 0 || state.category < 0 ? point[2] : point[4][state.facet][state.category]);
    // A place takes the colour of its largest category in the current grouping.
    // A facet may name a neutral category (Near collision for crash type): it never sets the colour,
    // so places show their actual crash type, and places with only that category stay grey.
    const neutralIndex = () => (state.facet < 0 ? -1
      : facets[state.facet][1].indexOf((data.facet_neutral || {})[facets[state.facet][0]]));
    const dominant = (point) => {
      if (state.facet < 0) return -1;
      const skip = neutralIndex();
      const values = point[4][state.facet].map((value, index) => (index === skip ? 0 : value));
      const top = Math.max(...values);
      return top > 0 ? values.indexOf(top) : -1;
    };
    const colourOf = (point) => {
      if (state.facet < 0) return css('--signal');
      const index = state.category >= 0 ? state.category : dominant(point);
      return palette(index === neutralIndex() ? -1 : index);
    };
    const radiusAt = (value) => (1.2 + 9 * Math.sqrt(value / most)) * size.scale;
    const amount = (value) => {
      const text = format(value, value < 10 && value % 1 ? 1 : 0);
      return `${text} ${Number(text) === 1 ? singular : plural}`;
    };

    // ---- Controls ----
    const button = (text, pressed, onClick, className = 'story-tab') => {
      const node = make('button', className, text);
      node.type = 'button';
      node.setAttribute('aria-pressed', String(pressed));
      node.addEventListener('click', onClick);
      return node;
    };
    const renderControls = () => {
      if (!controls) return;
      const views = make('div', 'story-tabs story-groups map-views');
      views.append(
        button('Globe', state.view === 'globe', () => { state.view = 'globe'; layout(); renderControls(); start(); }),
        button('Flat map', state.view === 'flat', () => { state.view = 'flat'; layout(); renderControls(); draw(); }),
      );
      const facetRow = make('div', 'story-tabs map-facets');
      facets.forEach(([name], index) => facetRow.append(button(`By ${name.toLowerCase()}`, state.facet === index, () => select(index, -1))));
      const rows = [views, facetRow];
      if (state.facet >= 0) {
        // The colour legend; a chip shows its category alone, and a second click shows all again.
        const categoryRow = make('div', 'map-categories');
        facets[state.facet][1].forEach((name, index) => {
          const chip = button(name, state.category === index, () => select(state.facet, state.category === index ? -1 : index), 'map-chip');
          chip.style.setProperty('--chip', paletteVar(index === neutralIndex() ? -1 : index));
          chip.prepend(make('i'));
          categoryRow.append(chip);
        });
        rows.push(categoryRow);
      }
      if (data.compare_driving) {
        const toggle = make('label', 'map-compare');
        const box = make('input');
        box.type = 'checkbox';
        box.checked = state.driving;
        box.addEventListener('change', async () => {
          state.driving = box.checked;
          if (state.driving && !driving) await loadDriving();
          draw();
          drawKey();
        });
        toggle.append(box, ' Show CROWD driving places');
        rows.push(toggle);
      }
      controls.replaceChildren(...rows);
    };
    const select = (facet, category) => {
      state.facet = facet;
      state.category = category;
      growStart = performance.now();
      grow = reduced ? 1 : 0;
      renderControls();
      draw();
      start();
    };

    // ---- Key ----
    const drawKey = () => {
      if (!key) return;
      const samples = [1, 10, 100, 1000].filter((value) => value <= most);
      const short = (value) => `${format(value)} ${singular.startsWith('hour') ? 'h' : value === 1 ? singular : plural}`;
      const items = samples.map((value) => {
        const r = radiusAt(value);
        const item = make('span', 'map-key-item');
        item.innerHTML = `<svg width="${Math.ceil(r * 2 + 2)}" height="${Math.ceil(r * 2 + 2)}" aria-hidden="true"><circle cx="${r + 1}" cy="${r + 1}" r="${r}"></circle></svg>`;
        item.append(short(value));
        return item;
      });
      if (state.driving) {
        const item = make('span', 'map-key-item map-key-driving');
        item.innerHTML = '<svg width="8" height="8" aria-hidden="true"><circle cx="4" cy="4" r="3"></circle></svg>';
        item.append('CROWD driving place');
        items.push(item);
      }
      key.replaceChildren(...items);
    };

    // ---- Drawing ----
    const layout = () => {
      const width = holder.clientWidth;
      const ratio = window.devicePixelRatio || 1;
      const side = Math.min(width, 620);
      size = state.view === 'globe'
        ? { width: side, height: side, scale: Math.max(side / 800, 0.5) }
        : { width, height: Math.round(width * 0.487), scale: Math.max(width / 1240, 0.45) };
      canvas.width = Math.round(size.width * ratio);
      canvas.height = Math.round(size.height * ratio);
      canvas.style.width = `${size.width}px`;
      canvas.style.height = `${size.height}px`;
      holder.classList.toggle('is-globe', state.view === 'globe');
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      drawKey();
    };
    const projectionFor = () => (state.view === 'globe'
      ? d3.geoOrthographic().rotate(rotation).fitExtent([[2, 2], [size.width - 2, size.height - 2]], { type: 'Sphere' }).clipAngle(90)
      : d3.geoEqualEarth().fitExtent([[2, 2], [size.width - 2, size.height - 2]], { type: 'Sphere' }));

    const draw = () => {
      if (!window.d3) return;
      const { width, height } = size;
      context.clearRect(0, 0, width, height);
      const projection = projectionFor();
      const path = d3.geoPath(projection, context);
      context.beginPath(); path({ type: 'Sphere' }); context.fillStyle = css('--globe-sea'); context.fill();
      context.beginPath(); path(d3.geoGraticule10()); context.strokeStyle = css('--globe-grat'); context.lineWidth = 0.5; context.stroke();
      if (land) {
        context.beginPath(); path(land); context.fillStyle = css('--globe-land'); context.fill();
        context.strokeStyle = css('--globe-border'); context.lineWidth = 0.4; context.stroke();
      }
      // Visible side only: a point is drawn when the globe's projection keeps it.
      const project = (lat, lon) => {
        if (state.view === 'globe' && d3.geoDistance([lon, lat], [-rotation[0], -rotation[1]]) > Math.PI / 2) return null;
        return projection([lon, lat]);
      };
      if (state.driving && driving) {
        context.fillStyle = css('--ink-3');
        context.globalAlpha = 0.45;
        context.beginPath();
        for (const [lat, lon] of driving) {
          const xy = project(lat, lon);
          if (xy) { context.moveTo(xy[0] + 1.3, xy[1]); context.arc(xy[0], xy[1], 1.3 * size.scale + 0.4, 0, 2 * Math.PI); }
        }
        context.fill();
      }
      context.globalAlpha = 0.68;
      placed = [];
      for (const point of points) {
        const value = amountOf(point);
        if (!value) continue;
        const xy = project(point[0], point[1]);
        if (!xy) continue;
        placed.push({ x: xy[0], y: xy[1], radius: radiusAt(value), point, value });
      }
      // Largest first, so small places stay visible on top; one fill colour at a time.
      for (const dot of placed) {
        context.fillStyle = colourOf(dot.point);
        context.beginPath(); context.arc(dot.x, dot.y, Math.max(dot.radius * grow, 0.1), 0, 2 * Math.PI); context.fill();
      }
      context.globalAlpha = 1;
    };

    // ---- Motion: the globe turns while on screen, pauses under the pointer, and dots grow in ----
    const frame = (now) => {
      if (!visible || document.hidden) { running = false; return; }
      const delta = Math.min(now - last, 100);
      last = now;
      let moving = false;
      if (grow < 1) {
        grow = Math.min(1, (now - growStart) / 650);
        grow = 1 - (1 - grow) ** 3;
        moving = true;
      }
      if (state.view === 'globe' && !hovering && now > heldUntil && !reduced) {
        rotation = [rotation[0] + (6 * delta) / 1000, rotation[1]];
        moving = true;
        hide();  // a label would no longer sit on its dot
      }
      if (moving) draw();
      if (moving || state.view === 'globe') requestAnimationFrame(frame);
      else running = false;
    };
    const start = () => {
      if (running || !visible || !window.d3) return;
      running = true;
      last = performance.now();
      requestAnimationFrame(frame);
    };

    // ---- Pointer: drag to turn the globe; hover or tap to name a place ----
    const nearest = (x, y) => {
      let best = null;
      let bestDistance = Infinity;
      for (const dot of placed) {
        const distance = Math.hypot(dot.x - x, dot.y - y);
        if (distance <= Math.max(dot.radius, 6) && distance < bestDistance) { best = dot; bestDistance = distance; }
      }
      return best;
    };
    const hide = () => { tip.hidden = true; ring.hidden = true; };
    const offset = () => canvas.offsetLeft;
    const show = (x, y) => {
      const dot = nearest(x, y);
      if (!dot) { hide(); canvas.style.cursor = state.view === 'globe' ? 'grab' : ''; return; }
      canvas.style.cursor = 'pointer';
      const lines = [make('strong', '', dot.point[3] || 'Unnamed place'), make('span', '', amount(dot.value))];
      if (state.facet >= 0 && state.category >= 0) {
        lines.push(make('span', 'map-tip-share', `${facets[state.facet][1][state.category].toLowerCase()} · ${amount(dot.point[2])} in all`));
      } else if (state.facet >= 0 && dominant(dot.point) >= 0) {
        const swatch = make('span', 'map-tip-share');
        const mark = make('i');
        mark.style.background = paletteVar(dominant(dot.point));
        swatch.append(mark, `mostly ${facets[state.facet][1][dominant(dot.point)].toLowerCase()}`);
        lines.push(swatch);
      }
      tip.replaceChildren(...lines);
      tip.hidden = false;
      ring.hidden = false;
      const ringSize = Math.max(dot.radius, 3) * 2 + 6;
      Object.assign(ring.style, { width: `${ringSize}px`, height: `${ringSize}px`, left: `${dot.x + offset()}px`, top: `${dot.y}px` });
      const left = Math.min(Math.max(dot.x + offset(), tip.offsetWidth / 2 + 4), holder.clientWidth - tip.offsetWidth / 2 - 4);
      tip.style.left = `${left}px`;
      tip.style.top = `${dot.y - Math.max(dot.radius, 3) - 10}px`;
    };
    let drag = null;
    canvas.addEventListener('pointerdown', (event) => {
      const box = canvas.getBoundingClientRect();
      heldUntil = performance.now() + 4000;  // a tap pauses the globe so its label can be read
      show(event.clientX - box.left, event.clientY - box.top);
      if (state.view === 'globe') drag = { x: event.clientX, y: event.clientY, rotation: [...rotation], moved: false };
    });
    addEventListener('pointerup', () => { if (drag) { heldUntil = Math.max(heldUntil, performance.now() + 3000); drag = null; start(); } });
    canvas.addEventListener('pointermove', (event) => {
      const box = canvas.getBoundingClientRect();
      if (drag && event.buttons) {
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
        rotation = [drag.rotation[0] + dx * 0.35, Math.max(-75, Math.min(75, drag.rotation[1] - dy * 0.35))];
        hide();
        draw();
        return;
      }
      hovering = event.pointerType === 'mouse';
      show(event.clientX - box.left, event.clientY - box.top);
    });
    canvas.addEventListener('pointerleave', (event) => {
      if (event.pointerType === 'mouse') { hovering = false; hide(); start(); }
    });

    // ---- Loading ----
    const script = (src) => new Promise((ok, fail) => {
      const tag = document.createElement('script'); tag.src = src; tag.onload = ok; tag.onerror = fail; document.head.append(tag);
    });
    const loadDriving = async () => {
      const crowd = await (await fetch('https://raw.githubusercontent.com/bazilinskyy/bazilinskyy.github.io/master/js/crowd-globe.json')).json();
      driving = crowd.points.map(([lat, lon]) => [lat, lon]);
    };
    const boot = async () => {
      if (!window.d3) await script('https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js');
      if (!window.topojson) await script('https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/dist/topojson-client.min.js');
      layout();
      draw();
      start();
      const world = await (await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-110m.json')).json();
      land = topojson.feature(world, world.objects.land);
      draw();
    };
    renderControls();
    let booted = false;
    new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      if (visible && !booted) {
        booted = true;
        boot().catch((error) => console.error('map:', error));
      }
      start();
    }, { rootMargin: '200px' }).observe(holder);
    document.addEventListener('visibilitychange', start);

    let resizeTimer;
    addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (window.d3) { layout(); draw(); } }, 150); });
    // Day and night use different land and sea colours.
    const redraw = () => { if (window.d3) draw(); };
    new MutationObserver(redraw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', redraw);
  }

  fetch(source, { cache: 'no-cache' })
    .then((response) => response.json())
    .then((data) => {
      renderStats(data.stats);
      document.querySelectorAll('[data-bars]').forEach((node) => data[node.dataset.bars] && renderBars(node, data[node.dataset.bars], data));
      document.querySelectorAll('[data-histogram]').forEach((node) => data[node.dataset.histogram] && renderHistogram(node, data[node.dataset.histogram]));
      document.querySelectorAll('[data-columns]').forEach((node) => data[node.dataset.columns] && renderColumns(node, data[node.dataset.columns]));
      const each = (attribute, render) => document.querySelectorAll(`[data-${attribute}]`).forEach((node) => {
        const spec = data[node.getAttribute(`data-${attribute}`)];
        if (spec) render(node, spec, data);
      });
      each('stacked', renderStacked);
      each('cities', renderCities);
      each('curve', (node, spec) => renderCurve(node, spec, data.channels));
      each('scatter', renderScatter);
      each('heatmap', renderHeatmap);
      each('cooc', renderCooccurrence);
      each('boxes', renderBoxes);
      each('dots', renderDots);
      renderMap(data);
    })
    .catch((error) => console.error(error));
})();
