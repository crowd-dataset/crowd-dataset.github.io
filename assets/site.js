async function loadSiteData() {
  const response = await fetch('data/site.json', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Could not load data/site.json: ${response.status}`);
  }
  return response.json();
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (!element) return;
  element.textContent = value ?? '';
}

function createLinkButton(item) {
  const anchor = document.createElement('a');
  anchor.href = item.url;
  anchor.target = '_blank';
  anchor.rel = 'noreferrer noopener';
  anchor.textContent = item.label;
  anchor.className = item.primary ? 'primary-button' : 'secondary-button';
  return anchor;
}

function renderStats(stats = []) {
  const container = document.getElementById('statsGrid');
  container.innerHTML = '';

  stats.forEach((stat) => {
    const card = document.createElement('div');
    card.className = 'stat-card';
    card.innerHTML = `
      <div class="stat-value">${stat.value}</div>
      <div class="stat-label">${stat.label}</div>
    `;
    container.appendChild(card);
  });
}

function renderAuthors(authors = []) {
  const container = document.getElementById('heroAuthors');
  container.innerHTML = authors.join(' · ');
}

function renderButtons(buttons = []) {
  const container = document.getElementById('heroButtons');
  container.innerHTML = '';
  buttons.forEach((button) => container.appendChild(createLinkButton(button)));
}

function renderTags(tags = []) {
  const container = document.getElementById('tagList');
  container.innerHTML = '';
  tags.forEach((tag) => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = tag;
    container.appendChild(chip);
  });
}

function renderSplits(splits = []) {
  const body = document.getElementById('splitsBody');
  body.innerHTML = '';

  splits.forEach((split) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${split.name}</td>
      <td>${split.items}</td>
      <td>${split.scenes}</td>
      <td>${split.annotations}</td>
      <td>${split.notes}</td>
    `;
    body.appendChild(row);
  });
}

function renderExamples(examples = []) {
  const container = document.getElementById('exampleGrid');
  container.innerHTML = '';

  if (!examples.length) {
    container.innerHTML = '<div class="empty-note">Add examples to data/site.json and place image files inside assets/examples/.</div>';
    return;
  }

  examples.forEach((example) => {
    const card = document.createElement('article');
    card.className = 'example-card';
    card.innerHTML = `
      <img class="example-image" src="${example.image}" alt="${example.title}" loading="lazy" />
      <div class="example-body">
        <h3>${example.title}</h3>
        <p>${example.description}</p>
      </div>
    `;

    card.addEventListener('click', () => openLightbox(example));
    container.appendChild(card);
  });
}

function renderResources(resources = []) {
  const container = document.getElementById('resourceGrid');
  container.innerHTML = '';

  resources.forEach((resource) => {
    const card = document.createElement('article');
    card.className = 'resource-card';

    const links = (resource.links || [])
      .map(
        (link) => `
          <a class="resource-link" href="${link.url}" target="_blank" rel="noreferrer noopener">
            ${link.label}
          </a>
        `,
      )
      .join('');

    card.innerHTML = `
      <div class="resource-body">
        <span class="resource-badge">${resource.type}</span>
        <h3>${resource.title}</h3>
        <p>${resource.description}</p>
        <div class="resource-actions">${links}</div>
      </div>
    `;

    container.appendChild(card);
  });
}

function renderBenchmark(rows = []) {
  const body = document.getElementById('benchmarkBody');
  body.innerHTML = '';

  rows.forEach((row) => {
    const codeCell = row.codeUrl
      ? `<a href="${row.codeUrl}" target="_blank" rel="noreferrer noopener">Link</a>`
      : '—';

    const tableRow = document.createElement('tr');
    tableRow.innerHTML = `
      <td>${row.method}</td>
      <td>${row.venue}</td>
      <td>${row.metric}</td>
      <td>${row.score}</td>
      <td>${codeCell}</td>
    `;

    body.appendChild(tableRow);
  });
}

function renderFaq(items = []) {
  const container = document.getElementById('faqList');
  container.innerHTML = '';

  items.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'faq-item';
    card.innerHTML = `
      <div class="faq-question">${item.question}</div>
      <div class="faq-answer">${item.answer}</div>
    `;
    container.appendChild(card);
  });
}

function openLightbox(example) {
  const dialog = document.getElementById('lightbox');
  document.getElementById('lightboxImage').src = example.image;
  document.getElementById('lightboxTitle').textContent = example.title;
  document.getElementById('lightboxDescription').textContent = example.description;
  dialog.showModal();
}

function setupCopyButton() {
  const button = document.getElementById('copyBibtexButton');
  const source = document.getElementById('bibtexBlock');

  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(source.textContent || '');
      const previous = button.textContent;
      button.textContent = 'Copied';
      window.setTimeout(() => {
        button.textContent = previous;
      }, 1500);
    } catch (error) {
      console.error(error);
      button.textContent = 'Copy failed';
    }
  });
}

function applyMetadata(site) {
  document.title = site.title;
  setText('navTitle', site.shortTitle || site.title);
  setText('heroVenue', site.venueLabel);
  setText('heroTitle', site.title);
  setText('heroSubtitle', site.subtitle);
  setText('heroHighlight', site.highlight);
  setText('overviewText', site.overview);
  setText('footerText', `${site.title} · ${site.footerNote}`);
  setText('bibtexBlock', site.bibtex);

  renderAuthors(site.authors);
  renderButtons(site.links);
  renderStats(site.stats);
  renderTags(site.tags);
  renderSplits(site.splits);
  renderExamples(site.examples);
  renderResources(site.resources);
  renderBenchmark(site.benchmark);
  renderFaq(site.faq);
}

async function main() {
  try {
    const site = await loadSiteData();
    applyMetadata(site);
    setupCopyButton();
  } catch (error) {
    console.error(error);
    document.body.innerHTML = `
      <main class="section">
        <div class="container narrow">
          <div class="citation-card">
            <h1>Could not load the site data</h1>
            <p class="lead">Check that <code>data/site.json</code> exists and contains valid JSON.</p>
            <pre>${String(error)}</pre>
          </div>
        </div>
      </main>
    `;
  }
}

main();
