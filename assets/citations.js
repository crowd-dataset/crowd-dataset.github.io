// Publications citing CROWD, read from OpenAlex (the open index of scholarly works) on each visit:
// the dataset paper, its 4TU.ResearchData deposit and the CROWD National paper. A citing work is
// counted once however many of them it cites; entries without a real title are left out.
const CROWD_WORKS = {
  W7148387111: 'A global dataset of continuous urban dashcam driving',
  W7148425047: 'CROWD data deposit (4TU.ResearchData)',
  W4414810930: 'Pedestrian Planet (CROWD National)',
};
const CITING_URL = `https://api.openalex.org/works?filter=cites:${Object.keys(CROWD_WORKS).join('|')}`
  + '&select=id,display_name,publication_year&per_page=200';

const citingWorks = fetch(CITING_URL)
  .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`OpenAlex: ${response.status}`))))
  .then((data) => data.results.filter((work) => work.display_name && !/^10\.\d+\//.test(work.display_name)))
  .catch((error) => {
    console.error(error);
    return null;
  });

citingWorks.then((works) => {
  const box = document.getElementById('citedBy');
  if (!works || !works.length || !box) return;

  const perYear = new Map();
  works.forEach((work) => {
    if (work.publication_year) perYear.set(work.publication_year, (perYear.get(work.publication_year) || 0) + 1);
  });
  const years = [...perYear.keys()].sort((a, b) => a - b);
  if (!years.length) return;
  // Every year from the first citation to now, so a quiet year shows as zero rather than vanishing.
  const span = [];
  for (let year = years[0]; year <= Math.max(years[years.length - 1], new Date().getFullYear()); year += 1) span.push(year);
  const most = Math.max(...perYear.values());

  document.getElementById('citedCount').textContent = works.length.toLocaleString('en-GB');
  document.getElementById('citedYears').replaceChildren(...span.map((year) => {
    const count = perYear.get(year) || 0;
    const column = document.createElement('li');
    column.className = 'cited-column';
    column.setAttribute('aria-label', `${year}: ${count} ${count === 1 ? 'publication' : 'publications'}`);
    column.innerHTML = `<span class="cited-column-count">${count}</span>`
      + `<span class="cited-column-bar" style="height: calc((100% - 40px) * ${count / most})"></span>`
      + `<span class="cited-column-year">${year}</span>`;
    return column;
  }));
  box.hidden = false;
});
