// "How to cite": the paper and the data deposit in common citation styles, to copy or download.
// Metadata from DataCite (arXiv:2604.01044; 4TU.ResearchData, version 2). Styled references use
// *asterisks* for italics, rendered as <em> on the page and as plain text when copied.

const PAPER_DOI = '10.48550/arXiv.2604.01044';
const DATA_DOI = '10.4121/06e9bb9a-a064-412b-b0f3-9ac5dd62ea16';

const CITATIONS = {
  paper: {
    label: 'Paper',
    file: 'crowd-paper',
    formats: {
      BibTeX: { code: true, ext: 'bib', text: `@article{alam2026global,
  title   = {A global dataset of continuous urban dashcam driving},
  author  = {Alam, Md Shadab and Bazilinska, Olena and Bazilinskyy, Pavlo},
  journal = {arXiv preprint arXiv:2604.01044},
  year    = {2026},
  doi     = {${PAPER_DOI}},
  url     = {https://arxiv.org/abs/2604.01044}
}` },
      APA: { text: `Alam, M. S., Bazilinska, O., & Bazilinskyy, P. (2026). *A global dataset of continuous urban dashcam driving* (arXiv:2604.01044). arXiv. https://doi.org/${PAPER_DOI}` },
      MLA: { text: `Alam, Md Shadab, et al. "A Global Dataset of Continuous Urban Dashcam Driving." *arXiv*, 2026, https://doi.org/${PAPER_DOI}.` },
      Chicago: { text: `Alam, Md Shadab, Olena Bazilinska, and Pavlo Bazilinskyy. 2026. "A Global Dataset of Continuous Urban Dashcam Driving." arXiv:2604.01044. arXiv. https://doi.org/${PAPER_DOI}.` },
      Harvard: { text: `Alam, M.S., Bazilinska, O. and Bazilinskyy, P. (2026) 'A global dataset of continuous urban dashcam driving', *arXiv preprint*, arXiv:2604.01044. Available at: https://doi.org/${PAPER_DOI}.` },
      Vancouver: { text: `Alam MS, Bazilinska O, Bazilinskyy P. A global dataset of continuous urban dashcam driving [Preprint]. arXiv:2604.01044. 2026. Available from: https://doi.org/${PAPER_DOI}` },
      IEEE: { text: `M. S. Alam, O. Bazilinska, and P. Bazilinskyy, "A global dataset of continuous urban dashcam driving," *arXiv preprint* arXiv:2604.01044, 2026, doi: ${PAPER_DOI}.` },
      RIS: { code: true, ext: 'ris', text: `TY  - UNPB
AU  - Alam, Md Shadab
AU  - Bazilinska, Olena
AU  - Bazilinskyy, Pavlo
TI  - A global dataset of continuous urban dashcam driving
PY  - 2026
PB  - arXiv
M1  - arXiv:2604.01044
DO  - ${PAPER_DOI}
UR  - https://arxiv.org/abs/2604.01044
ER  - ` },
      EndNote: { code: true, ext: 'enw', text: `%0 Electronic Article
%A Alam, Md Shadab
%A Bazilinska, Olena
%A Bazilinskyy, Pavlo
%T A global dataset of continuous urban dashcam driving
%D 2026
%I arXiv
%M arXiv:2604.01044
%R ${PAPER_DOI}
%U https://arxiv.org/abs/2604.01044` },
    },
  },
  dataset: {
    label: 'Dataset',
    file: 'crowd-dataset',
    formats: {
      BibTeX: { code: true, ext: 'bib', text: `@misc{alam2026crowd,
  title     = {{CROWD}: A global dataset of continuous urban dashcam driving},
  author    = {Alam, Md Shadab and Bazilinska, Olena and Bazilinskyy, Pavlo},
  publisher = {4TU.ResearchData},
  year      = {2026},
  version   = {2},
  doi       = {${DATA_DOI}},
  url       = {https://doi.org/${DATA_DOI}}
}` },
      APA: { text: `Alam, M. S., Bazilinska, O., & Bazilinskyy, P. (2026). *CROWD: A global dataset of continuous urban dashcam driving* (Version 2) [Data set]. 4TU.ResearchData. https://doi.org/${DATA_DOI}` },
      MLA: { text: `Alam, Md Shadab, et al. *CROWD: A Global Dataset of Continuous Urban Dashcam Driving*. Version 2, 4TU.ResearchData, 2026, https://doi.org/${DATA_DOI}.` },
      Chicago: { text: `Alam, Md Shadab, Olena Bazilinska, and Pavlo Bazilinskyy. 2026. "CROWD: A Global Dataset of Continuous Urban Dashcam Driving." Version 2. 4TU.ResearchData. https://doi.org/${DATA_DOI}.` },
      Harvard: { text: `Alam, M.S., Bazilinska, O. and Bazilinskyy, P. (2026) *CROWD: A global dataset of continuous urban dashcam driving* (Version 2) [Dataset]. 4TU.ResearchData. Available at: https://doi.org/${DATA_DOI}.` },
      Vancouver: { text: `Alam MS, Bazilinska O, Bazilinskyy P. CROWD: A global dataset of continuous urban dashcam driving [dataset]. Version 2. 4TU.ResearchData; 2026. Available from: https://doi.org/${DATA_DOI}` },
      IEEE: { text: `M. S. Alam, O. Bazilinska, and P. Bazilinskyy, "CROWD: A global dataset of continuous urban dashcam driving," 4TU.ResearchData, version 2, 2026. [Dataset]. Available: https://doi.org/${DATA_DOI}` },
      RIS: { code: true, ext: 'ris', text: `TY  - DATA
AU  - Alam, Md Shadab
AU  - Bazilinska, Olena
AU  - Bazilinskyy, Pavlo
TI  - CROWD: A global dataset of continuous urban dashcam driving
PY  - 2026
PB  - 4TU.ResearchData
ET  - 2
DO  - ${DATA_DOI}
UR  - https://doi.org/${DATA_DOI}
ER  - ` },
      EndNote: { code: true, ext: 'enw', text: `%0 Dataset
%A Alam, Md Shadab
%A Bazilinska, Olena
%A Bazilinskyy, Pavlo
%T CROWD: A global dataset of continuous urban dashcam driving
%D 2026
%I 4TU.ResearchData
%7 2
%R ${DATA_DOI}
%U https://doi.org/${DATA_DOI}` },
    },
  },
};

(function () {
  const root = document.getElementById('citeTool');
  if (!root) return;
  const state = { work: 'paper', format: 'BibTeX' };
  const workTabs = root.querySelector('[data-cite="works"]');
  const formatTabs = root.querySelector('[data-cite="formats"]');
  const output = root.querySelector('[data-cite="output"]');
  const copyButton = root.querySelector('[data-cite="copy"]');
  const download = root.querySelector('[data-cite="download"]');

  const plain = (text) => text.replace(/\*([^*]+)\*/g, '$1');
  const escape = (text) => text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const html = (text) => escape(text).replace(/\*([^*]+)\*/g, '<em>$1</em>');

  function tab(label, selected, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.role = 'tab';
    button.className = 'story-tab';
    button.textContent = label;
    button.setAttribute('aria-selected', String(selected));
    button.addEventListener('click', onClick);
    return button;
  }

  function render() {
    const work = CITATIONS[state.work];
    const entry = work.formats[state.format];
    workTabs.replaceChildren(...Object.entries(CITATIONS).map(([key, value]) => tab(value.label, key === state.work, () => {
      state.work = key;
      render();
    })));
    formatTabs.replaceChildren(...Object.keys(work.formats).map((name) => tab(name, name === state.format, () => {
      state.format = name;
      render();
    })));

    if (entry.code) {
      const pre = document.createElement('pre');
      pre.textContent = entry.text;
      output.replaceChildren(pre);
    } else {
      const reference = document.createElement('p');
      reference.className = 'cite-text';
      reference.innerHTML = html(entry.text);
      output.replaceChildren(reference);
    }

    download.hidden = !entry.ext;
    if (entry.ext) {
      URL.revokeObjectURL(download.href);
      download.href = URL.createObjectURL(new Blob([`${entry.text}\n`], { type: 'text/plain;charset=utf-8' }));
      download.download = `${work.file}.${entry.ext}`;
      download.textContent = `Download .${entry.ext}`;
    }
    copyButton.textContent = 'Copy';
  }

  copyButton.addEventListener('click', async () => {
    const entry = CITATIONS[state.work].formats[state.format];
    try {
      // Styled references keep their italics when pasted into a word processor.
      if (!entry.code && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({
          'text/plain': new Blob([plain(entry.text)], { type: 'text/plain' }),
          'text/html': new Blob([html(entry.text)], { type: 'text/html' }),
        })]);
      } else {
        await navigator.clipboard.writeText(plain(entry.text));
      }
      copyButton.textContent = 'Copied';
    } catch (error) {
      console.error(error);
      copyButton.textContent = 'Copy failed';
    }
    window.setTimeout(() => { copyButton.textContent = 'Copy'; }, 1600);
  });

  render();
})();
