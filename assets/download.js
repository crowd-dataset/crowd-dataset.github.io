const DATA_URL = '../data/data.json';
const CSV_FILENAME = 'crowd-filtered-records.csv';
const CELL_PREVIEW_LIMIT = 140;
const ALL_VALUE = '__all__';
const INDEXED_FIELDS = ['videos', 'upload_date', 'channel', 'vehicle_type'];
const SEGMENT_FIELDS = ['start_time', 'end_time'];

const state = {
  rows: [],
  columns: [],
  filteredRows: [],
  filterState: {},
};

const filters = [
  { id: 'continentFilter', key: 'continent', label: 'continent' },
  { id: 'countryFilter', key: 'country', label: 'country' },
  { id: 'stateFilter', key: 'state', label: 'state', optional: true, wrapperId: 'stateFilterWrap' },
  { id: 'cityFilter', key: 'locality', label: 'city', city: true },
  { id: 'vehicleFilter', key: 'vehicle_type', label: 'vehicle type', indexed: true },
  { id: 'timeFilter', key: 'time_of_day', label: 'time of day', time: true },
];

function getElement(id) {
  return document.getElementById(id);
}

function getFilterState(filterId) {
  if (!state.filterState[filterId]) {
    state.filterState[filterId] = {
      disabled: true,
      options: [],
      selected: new Set(),
      query: '',
    };
  }
  return state.filterState[filterId];
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

function normaliseValue(value) {
  return String(value ?? '').trim();
}

function parseBracketList(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  const trimmed = value.trim();
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return [];
  return trimmed
    .slice(1, -1)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function getIndexedValue(row, field, index) {
  return parseBracketList(row[field])[index];
}

function getCityLabel(row) {
  const locality = normaliseValue(row.locality);
  const aliases = parseBracketList(row.locality_aka).map(normaliseValue).filter(Boolean);
  if (!aliases.length) return locality;
  return `${locality} (${aliases.join(', ')})`;
}

function getSelected(filterId) {
  return [...getFilterState(filterId).selected];
}

function hasSelection(values) {
  return values.length > 0;
}

function hasAllSelected(values) {
  return values.includes(ALL_VALUE);
}

function includesSelection(values, value) {
  return hasAllSelected(values) || values.includes(normaliseValue(value));
}

function getRowsForOptions(filterIndex) {
  return state.rows.filter((row) => {
    for (let index = 0; index < filterIndex; index += 1) {
      const filter = filters[index];
      if (filter.indexed || filter.time) continue;
      if (filter.optional && filter.wrapperId && getElement(filter.wrapperId).hidden) continue;
      const selected = getSelected(filter.id);
      const matchesFilter = filter.city
        ? includesSelection(selected, row.locality)
        : includesSelection(selected, row[filter.key]);
      if (hasSelection(selected) && !matchesFilter) {
        return false;
      }
    }
    return true;
  });
}

function uniqueSorted(values) {
  return [...new Set(values.map(normaliseValue).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function getOptions(filterIndex) {
  const filter = filters[filterIndex];
  const rows = getRowsForOptions(filterIndex);

  if (filter.time) {
    return [
      { value: ALL_VALUE, label: 'All' },
      { value: '0', label: 'Day (0)' },
      { value: '1', label: 'Night (1)' },
    ];
  }

  if (filter.indexed) {
    return [
      { value: ALL_VALUE, label: 'All' },
      ...uniqueSorted(rows.flatMap((row) => parseBracketList(row[filter.key]))).map((value) => ({ value, label: value })),
    ];
  }

  if (filter.city) {
    const cityOptions = new Map();
    rows.forEach((row) => {
      const city = normaliseValue(row.locality);
      if (city && !cityOptions.has(city)) cityOptions.set(city, getCityLabel(row));
    });
    return [
      { value: ALL_VALUE, label: 'All' },
      ...[...cityOptions.entries()]
        .sort(([, labelA], [, labelB]) => labelA.localeCompare(labelB, undefined, { numeric: true }))
        .map(([value, label]) => ({ value, label })),
    ];
  }

  const values = uniqueSorted(rows.map((row) => row[filter.key]));
  return [
    { value: ALL_VALUE, label: 'All' },
    ...values.map((value) => ({ value, label: value })),
  ];
}

function getOrderedOptions(filterState) {
  const allOption = filterState.options.find((option) => option.value === ALL_VALUE);
  const query = filterState.query.toLowerCase();
  const otherOptions = filterState.options
    .filter((option) => option.value !== ALL_VALUE)
    .filter((option) => option.label.toLowerCase().includes(query));
  const selectedOptions = otherOptions.filter((option) => filterState.selected.has(option.value));
  const unselectedOptions = otherOptions.filter((option) => !filterState.selected.has(option.value));
  return [allOption, ...selectedOptions, ...unselectedOptions].filter(Boolean);
}

function getFilterSummary(filter, filterState) {
  if (filterState.disabled) return filter.element.dataset.placeholder;
  const concreteSelectedCount = filterState.options
    .filter((option) => option.value !== ALL_VALUE && filterState.selected.has(option.value))
    .length;
  if (!concreteSelectedCount) return filter.element.dataset.placeholder;
  return `${concreteSelectedCount.toLocaleString()} selected`;
}

function renderMultiSelect(filter) {
  const filterState = getFilterState(filter.id);
  const element = getElement(filter.id);
  const wasOpen = element.querySelector('.multi-select-panel')?.hidden === false;
  const hadSearchFocus = document.activeElement?.classList.contains('multi-select-search')
    && element.contains(document.activeElement);
  filter.element = element;
  element.classList.toggle('is-disabled', filterState.disabled);
  element.innerHTML = '';

  const button = document.createElement('button');
  button.className = 'multi-select-button';
  button.type = 'button';
  button.disabled = filterState.disabled;
  button.setAttribute('aria-expanded', String(wasOpen));
  button.textContent = getFilterSummary(filter, filterState);

  const panel = document.createElement('div');
  panel.className = 'multi-select-panel';
  panel.hidden = !wasOpen;

  const panelHeader = document.createElement('div');
  const panelTitle = document.createElement('span');
  const closeButton = document.createElement('button');
  panelHeader.className = 'multi-select-panel-header';
  panelTitle.textContent = getFilterSummary(filter, filterState);
  closeButton.className = 'multi-select-close';
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', 'Close dropdown');
  closeButton.textContent = '×';
  closeButton.addEventListener('click', () => {
    panel.hidden = true;
    button.setAttribute('aria-expanded', 'false');
  });
  panelHeader.append(panelTitle, closeButton);
  panel.appendChild(panelHeader);

  const searchInput = document.createElement('input');
  searchInput.className = 'multi-select-search';
  searchInput.type = 'search';
  searchInput.placeholder = 'Type to filter options';
  searchInput.value = filterState.query;
  searchInput.addEventListener('input', () => {
    filterState.query = searchInput.value;
    renderMultiSelect(filter);
  });
  panel.appendChild(searchInput);

  getOrderedOptions(filterState).forEach(({ value, label }) => {
    const optionLabel = document.createElement('label');
    const checkbox = document.createElement('input');
    const optionText = document.createElement('span');

    optionLabel.className = 'multi-select-option';
    checkbox.type = 'checkbox';
    checkbox.value = value;
    checkbox.checked = filterState.selected.has(value);
    optionText.textContent = label;
    optionLabel.append(checkbox, optionText);
    panel.appendChild(optionLabel);
  });

  button.addEventListener('click', () => {
    if (filterState.disabled) return;
    const isOpening = panel.hidden;
    document.querySelectorAll('.multi-select-panel').forEach((openPanel) => {
      openPanel.hidden = true;
    });
    document.querySelectorAll('.multi-select-button').forEach((openButton) => {
      openButton.setAttribute('aria-expanded', 'false');
    });
    panel.hidden = !isOpening;
    button.setAttribute('aria-expanded', String(isOpening));
    if (isOpening) {
      const activeSearch = panel.querySelector('.multi-select-search');
      activeSearch.focus();
      activeSearch.setSelectionRange(activeSearch.value.length, activeSearch.value.length);
    }
  });

  panel.querySelectorAll('input').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      updateFilterSelection(filter, checkbox.value, checkbox.checked, true);
    });
  });

  element.append(button, panel);

  if (wasOpen && hadSearchFocus) {
    const activeSearch = panel.querySelector('.multi-select-search');
    activeSearch.focus();
    activeSearch.setSelectionRange(activeSearch.value.length, activeSearch.value.length);
  }
}

function setOptions(filter, options) {
  const filterState = getFilterState(filter.id);
  filterState.options = options;
  filterState.selected = new Set();
  filterState.query = '';
  filterState.disabled = false;
  renderMultiSelect(filter);
}

function resetFilter(filter) {
  const filterState = getFilterState(filter.id);
  filterState.options = [];
  filterState.selected = new Set();
  filterState.query = '';
  filterState.disabled = true;
  renderMultiSelect(filter);
}

function visibleFilters() {
  return filters.filter((filter) => {
    if (!filter.wrapperId) return true;
    return !getElement(filter.wrapperId).hidden;
  });
}

function areFiltersComplete() {
  return visibleFilters().every((filter) => hasSelection(getSelected(filter.id)));
}

function getVehicleIndexes(row) {
  const vehicleSelection = getSelected('vehicleFilter');
  const vehicleTypes = parseBracketList(row.vehicle_type);
  const indexes = [];

  for (let index = 0; index < vehicleTypes.length; index += 1) {
    if (includesSelection(vehicleSelection, vehicleTypes[index])) indexes.push(index);
  }

  return indexes;
}

function getSelectedTopLevelIndexes(row) {
  const timeSelection = getSelected('timeFilter');
  const timeOfDay = Array.isArray(row.time_of_day) ? row.time_of_day : [];

  return getVehicleIndexes(row).filter((index) => {
    if (hasAllSelected(timeSelection)) return true;
    const times = Array.isArray(timeOfDay[index]) ? timeOfDay[index].map(normaliseValue) : [];
    return times.some((time) => timeSelection.includes(time));
  });
}

function matchesAllFilters(row) {
  const placeFiltersMatch = filters.every((filter) => {
    if (filter.indexed || filter.time || filter.optional) return true;
    const selected = getSelected(filter.id);
    if (filter.city) {
      return includesSelection(selected, row.locality);
    }
    return includesSelection(selected, row[filter.key]);
  });
  if (!placeFiltersMatch) return false;

  const stateFilter = filters.find((filter) => filter.id === 'stateFilter');
  if (!getElement(stateFilter.wrapperId).hidden) {
    const selectedState = getSelected(stateFilter.id);
    if (!includesSelection(selectedState, row.state)) return false;
  }

  return getVehicleIndexes(row).length > 0;
}

function filterSegmentArray(values, timeValues, timeSelection) {
  if (!Array.isArray(values)) return [];
  if (hasAllSelected(timeSelection)) return values;
  return values.filter((_, index) => timeSelection.includes(normaliseValue(timeValues[index])));
}

function buildExportRow(row) {
  const exportRow = { ...row };
  const indexes = getSelectedTopLevelIndexes(row);
  const timeSelection = getSelected('timeFilter');
  const timeOfDay = Array.isArray(row.time_of_day) ? row.time_of_day : [];

  INDEXED_FIELDS.forEach((field) => {
    exportRow[field] = indexes.map((index) => getIndexedValue(row, field, index)).filter((value) => value !== undefined);
  });

  exportRow.time_of_day = indexes.map((index) => {
    const values = Array.isArray(timeOfDay[index]) ? timeOfDay[index] : [];
    if (hasAllSelected(timeSelection)) return values;
    return values.filter((value) => timeSelection.includes(normaliseValue(value)));
  });

  SEGMENT_FIELDS.forEach((field) => {
    const rows = Array.isArray(row[field]) ? row[field] : [];
    exportRow[field] = indexes.map((index) => filterSegmentArray(rows[index], timeOfDay[index], timeSelection));
  });

  return exportRow;
}

function updateStatus() {
  const button = getElement('downloadCsvButton');

  if (!areFiltersComplete()) {
    state.filteredRows = [];
    button.hidden = true;
    getElement('downloadStatus').textContent = 'Select each filter to enable download.';
    renderTable([]);
    return;
  }

  state.filteredRows = state.rows.filter(matchesAllFilters).map(buildExportRow);
  button.hidden = state.filteredRows.length === 0;
  getElement('downloadStatus').textContent =
    `${state.filteredRows.length.toLocaleString()} records match the selected place and vehicle filters.`;
  renderTable(state.filteredRows);
}

function renderTable(rows) {
  const head = getElement('downloadTableHead');
  const body = getElement('downloadTableBody');

  const headerRow = document.createElement('tr');
  state.columns.forEach((column) => {
    const th = document.createElement('th');
    th.textContent = column;
    headerRow.appendChild(th);
  });
  head.replaceChildren(headerRow);

  const fragment = document.createDocumentFragment();
  rows.forEach((row) => {
    const tr = document.createElement('tr');
    state.columns.forEach((column) => {
      const td = document.createElement('td');
      const value = row[column];
      td.title = getCellPreview(value);
      td.textContent = getCellPreview(value);
      tr.appendChild(td);
    });
    fragment.appendChild(tr);
  });
  body.replaceChildren(fragment);
}

function refreshFilter(filterIndex) {
  for (let index = filterIndex; index < filters.length; index += 1) {
    const filter = filters[index];
    resetFilter(filter);
  }

  if (filterIndex >= filters.length) {
    updateStatus();
    return;
  }

  const filter = filters[filterIndex];
  const options = getOptions(filterIndex);

  if (filter.optional && options.length <= 1) {
    getElement(filter.wrapperId).hidden = true;
    refreshFilter(filterIndex + 1);
    return;
  }

  if (filter.wrapperId) getElement(filter.wrapperId).hidden = false;
  setOptions(filter, options);
  updateStatus();
}

function updateFilterSelection(filter, value, checked, keepOpen = false) {
  const filterState = getFilterState(filter.id);

  if (value === ALL_VALUE && checked) {
    filterState.selected = new Set(filterState.options.map((option) => option.value));
  } else if (value === ALL_VALUE && !checked) {
    filterState.selected.clear();
  } else if (checked) {
    filterState.selected.add(value);
  } else {
    filterState.selected.delete(value);
    filterState.selected.delete(ALL_VALUE);
  }

  const concreteOptions = filterState.options.filter((option) => option.value !== ALL_VALUE);
  const allConcreteSelected = concreteOptions.length > 0
    && concreteOptions.every((option) => filterState.selected.has(option.value));
  if (allConcreteSelected) {
    filterState.selected.add(ALL_VALUE);
  }

  renderMultiSelect(filter);
  const filterIndex = filters.findIndex((candidate) => candidate.id === filter.id);
  refreshFilter(filterIndex + 1);
}

document.addEventListener('click', (event) => {
  if (event.target.closest('.multi-select')) return;
  document.querySelectorAll('.multi-select-panel').forEach((panel) => {
    panel.hidden = true;
  });
  document.querySelectorAll('.multi-select-button').forEach((button) => {
    button.setAttribute('aria-expanded', 'false');
  });
});

function makeCsvValue(value) {
  const text = stringifyValue(value);
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function downloadCsv() {
  const csvRows = [
    state.columns.map(makeCsvValue).join(','),
    ...state.filteredRows.map((row) => state.columns.map((column) => makeCsvValue(row[column])).join(',')),
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
    filters.forEach((filter) => renderMultiSelect(filter));
    getElement('downloadCsvButton').addEventListener('click', downloadCsv);
    renderTable([]);
    refreshFilter(0);
  } catch (error) {
    console.error(error);
    getElement('downloadStatus').textContent = 'Could not load the dataset.';
  }
}

main();
