const DATA_URL = '../data/data.json';
const CSV_FILENAME = 'crowd-selected-records.csv';
const CELL_PREVIEW_LIMIT = 140;

const state = {
  columns: [],
  rows: [],
};

function getElement(id) {
  return document.getElementById(id);
}

function stringifyValue(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value) || typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function getCellPreview(value) {
  if (Array.isArray(value)) return `[${value.length.toLocaleString()} items]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).length.toLocaleString()} fields}`;

  const text = stringifyValue(value);
  if (text.length <= CELL_PREVIEW_LIMIT) return text;
  return `${text.slice(0, CELL_PREVIEW_LIMIT)}...`;
}

function updateStatus() {
  const selectedRows = document.querySelectorAll('.row-select:checked').length;
  const selectedColumns = document.querySelectorAll('.column-select:checked').length;
  getElement('downloadStatus').textContent =
    `${selectedRows.toLocaleString()} rows and ${selectedColumns.toLocaleString()} columns selected`;
  getElement('downloadCsvButton').disabled = selectedRows === 0 || selectedColumns === 0;
}

function setVisibleColumns() {
  state.columns.forEach((column, index) => {
    const visible = getElement(`column-${index}`).checked;
    document.querySelectorAll(`[data-column="${column}"]`).forEach((cell) => {
      cell.classList.toggle('is-excluded', !visible);
    });
  });
  updateStatus();
}

function setAllRows(checked) {
  document.querySelectorAll('.row-select').forEach((checkbox) => {
    checkbox.checked = checked;
  });
  updateStatus();
}

function renderTable() {
  const head = getElement('downloadTableHead');
  const body = getElement('downloadTableBody');

  const headerRow = document.createElement('tr');
  const rowSelectHeader = document.createElement('th');
  rowSelectHeader.className = 'download-selector-cell';
  rowSelectHeader.innerHTML = `
    <label class="download-checkbox-label">
      <input id="selectAllRows" type="checkbox" checked />
      Rows
    </label>
  `;
  headerRow.appendChild(rowSelectHeader);

  state.columns.forEach((column, index) => {
    const th = document.createElement('th');
    th.dataset.column = column;
    th.innerHTML = `
      <label class="download-checkbox-label">
        <input id="column-${index}" class="column-select" type="checkbox" checked />
        <span>${column}</span>
      </label>
    `;
    headerRow.appendChild(th);
  });

  head.replaceChildren(headerRow);

  const fragment = document.createDocumentFragment();
  state.rows.forEach((row, rowIndex) => {
    const tr = document.createElement('tr');
    const selectorCell = document.createElement('td');
    selectorCell.className = 'download-selector-cell';
    selectorCell.innerHTML = `
      <label class="download-checkbox-label">
        <input class="row-select" type="checkbox" data-row-index="${rowIndex}" checked />
        ${rowIndex + 1}
      </label>
    `;
    tr.appendChild(selectorCell);

    state.columns.forEach((column) => {
      const td = document.createElement('td');
      const value = row[column];
      td.dataset.column = column;
      td.title = getCellPreview(value);
      td.textContent = getCellPreview(value);
      tr.appendChild(td);
    });

    fragment.appendChild(tr);
  });

  body.replaceChildren(fragment);

  getElement('selectAllRows').addEventListener('change', (event) => setAllRows(event.target.checked));
  document.querySelectorAll('.column-select').forEach((checkbox) => {
    checkbox.addEventListener('change', setVisibleColumns);
  });
  document.querySelectorAll('.row-select').forEach((checkbox) => {
    checkbox.addEventListener('change', updateStatus);
  });

  updateStatus();
}

function makeCsvValue(value) {
  const text = stringifyValue(value);
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function downloadCsv() {
  const selectedColumns = state.columns.filter((_, index) => getElement(`column-${index}`).checked);
  const selectedRowIndexes = Array.from(document.querySelectorAll('.row-select:checked'))
    .map((checkbox) => Number(checkbox.dataset.rowIndex));

  const csvRows = [
    selectedColumns.map(makeCsvValue).join(','),
    ...selectedRowIndexes.map((rowIndex) =>
      selectedColumns.map((column) => makeCsvValue(state.rows[rowIndex][column])).join(','),
    ),
  ];

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = CSV_FILENAME;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function main() {
  try {
    const response = await fetch(DATA_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Could not load ${DATA_URL}: ${response.status}`);

    state.rows = await response.json();
    state.columns = Object.keys(state.rows[0] || {});
    renderTable();
    getElement('downloadCsvButton').addEventListener('click', downloadCsv);
  } catch (error) {
    console.error(error);
    getElement('downloadStatus').textContent = 'Could not load the dataset.';
  }
}

main();
