const DATA_URL = '../data/data.json';
const FILE_SERVER_BASE_URL = 'https://files.mobility-squad.com/';
const FILE_SERVER_ALIAS = 'tuecoco';
const ALL_VALUE = '__all__';
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];
const VEHICLE_MAP = {
  0: 'Car',
  1: 'Bus',
  2: 'Truck',
  3: 'Two wheeler',
  4: 'Bicycle',
  5: 'Automated car',
  6: 'Electric scooter',
  7: 'Monowheel unicycle',
  8: 'Emergency vehicle',
  9: 'Automated bus',
  10: 'Automated truck',
  11: 'Automated two wheeler',
  12: 'Non electric scooter',
  13: 'Pedestrian',
};
const TIME_MAP = {
  0: 'Day',
  1: 'Night',
};

const state = {
  rows: [],
  candidates: [],
  browseCache: new Map(),
};

function getElement(id) {
  return document.getElementById(id);
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

function uniqueSorted(values) {
  return [...new Set(values.map(normaliseValue).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function shuffle(values) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function setStatus(message) {
  getElement('traffcocoStatus').textContent = message;
}

function setSelectOptions(id, options, selectedValue = ALL_VALUE) {
  const select = getElement(id);
  select.innerHTML = '';
  options.forEach(({ value, label }) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  });
  select.value = selectedValue;
}

function selected(id) {
  return getElement(id).value;
}

function selectedOrNull(id) {
  const value = selected(id);
  return value === ALL_VALUE ? null : value;
}

function getRowsForCascade(level) {
  return state.rows.filter((row) => {
    if (level > 0 && selected('continentFilter') !== ALL_VALUE && row.continent !== selected('continentFilter')) return false;
    if (level > 1 && selected('countryFilter') !== ALL_VALUE && row.country !== selected('countryFilter')) return false;
    if (level > 2 && !getElement('stateFilterWrap').hidden && selected('stateFilter') !== ALL_VALUE && normaliseValue(row.state) !== selected('stateFilter')) return false;
    if (level > 3 && selected('cityFilter') !== ALL_VALUE && row.locality !== selected('cityFilter')) return false;
    return true;
  });
}

function getCityLabel(row) {
  const aliases = parseBracketList(row.locality_aka).map(normaliseValue).filter(Boolean);
  if (!aliases.length) return row.locality;
  return `${row.locality} (${aliases.join(', ')})`;
}

function refreshFilters(fromLevel = 0) {
  if (fromLevel <= 0) {
    setSelectOptions('continentFilter', [
      { value: ALL_VALUE, label: 'All' },
      ...uniqueSorted(state.rows.map((row) => row.continent)).map((value) => ({ value, label: value })),
    ]);
  }

  if (fromLevel <= 1) {
    const rows = getRowsForCascade(1);
    setSelectOptions('countryFilter', [
      { value: ALL_VALUE, label: 'All' },
      ...uniqueSorted(rows.map((row) => row.country)).map((value) => ({ value, label: value })),
    ]);
  }

  if (fromLevel <= 2) {
    const rows = getRowsForCascade(2);
    const states = uniqueSorted(rows.map((row) => row.state));
    getElement('stateFilterWrap').hidden = states.length === 0;
    if (!getElement('stateFilterWrap').hidden) {
      setSelectOptions('stateFilter', [
        { value: ALL_VALUE, label: 'All' },
        ...states.map((value) => ({ value, label: value })),
      ]);
    }
  }

  if (fromLevel <= 3) {
    const rows = getRowsForCascade(3);
    const cityOptions = new Map();
    rows.forEach((row) => {
      if (!cityOptions.has(row.locality)) cityOptions.set(row.locality, getCityLabel(row));
    });
    setSelectOptions('cityFilter', [
      { value: ALL_VALUE, label: 'All' },
      ...[...cityOptions.entries()]
        .sort(([, labelA], [, labelB]) => labelA.localeCompare(labelB, undefined, { numeric: true }))
        .map(([value, label]) => ({ value, label })),
    ]);
  }

  if (fromLevel <= 4) {
    const rows = getRowsForCascade(4);
    const vehicles = uniqueSorted(rows.flatMap((row) => parseBracketList(row.vehicle_type)));
    setSelectOptions('vehicleFilter', [
      { value: ALL_VALUE, label: 'All' },
      ...vehicles.map((value) => ({ value, label: VEHICLE_MAP[value] || value })),
    ]);
  }

  if (fromLevel <= 5) {
    setSelectOptions('timeFilter', [
      { value: ALL_VALUE, label: 'All' },
      { value: '0', label: 'Day (0)' },
      { value: '1', label: 'Night (1)' },
    ]);
  }
}

function matchingRows() {
  return state.rows.filter((row) => {
    if (selected('continentFilter') !== ALL_VALUE && row.continent !== selected('continentFilter')) return false;
    if (selected('countryFilter') !== ALL_VALUE && row.country !== selected('countryFilter')) return false;
    if (!getElement('stateFilterWrap').hidden && selected('stateFilter') !== ALL_VALUE && normaliseValue(row.state) !== selected('stateFilter')) return false;
    if (selected('cityFilter') !== ALL_VALUE && row.locality !== selected('cityFilter')) return false;
    if (selected('vehicleFilter') !== ALL_VALUE && !parseBracketList(row.vehicle_type).map(normaliseValue).includes(selected('vehicleFilter'))) return false;
    return true;
  });
}

function authHeaders() {
  const mode = getElement('authModeInput').value;
  const username = getElement('usernameInput').value;
  const password = getElement('passwordInput').value;
  const token = getElement('tokenInput').value;

  if (mode === 'basic' && (username || password)) {
    return { Authorization: `Basic ${btoa(`${username}:${password}`)}` };
  }

  if (mode === 'bearer' && token) {
    return { Authorization: `Bearer ${token}` };
  }

  return {};
}

function updateAuthFields() {
  const mode = getElement('authModeInput').value;
  document.querySelectorAll('.auth-basic-field').forEach((field) => {
    field.hidden = mode !== 'basic';
  });
  document.querySelectorAll('.auth-token-field').forEach((field) => {
    field.hidden = mode !== 'bearer';
  });
}

function quotePath(parts) {
  return parts.map((part) => encodeURIComponent(part)).join('/');
}

function makeBrowseUrl(baseUrl, alias, parts, trailingSlash = true) {
  const base = `${baseUrl.replace(/\/+$/, '')}/`;
  const suffix = `v/${encodeURIComponent(alias)}/browse${parts.length ? `/${quotePath(parts)}` : ''}${trailingSlash ? '/' : ''}`;
  return new URL(suffix, base).toString();
}

async function fetchText(url) {
  if (state.browseCache.has(url)) return state.browseCache.get(url);
  let response;
  try {
    response = await fetch(url, { headers: authHeaders() });
  } catch (error) {
    throw new Error(`Browser could not fetch ${url}. This usually means CORS blocked the request, the Authorization header is not allowed, or the server is unreachable. Browser error: ${error.message}`);
  }
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} while fetching ${url}`);
  const text = await response.text();
  state.browseCache.set(url, text);
  return text;
}

async function fetchFolder(baseUrl, alias, parts) {
  const urls = [
    makeBrowseUrl(baseUrl, alias, parts, true),
    makeBrowseUrl(baseUrl, alias, parts, false),
  ];
  let lastError = null;

  for (const url of urls) {
    try {
      const text = await fetchText(url);
      return { url, text };
    } catch (error) {
      lastError = error;
      // Try the alternate slash form before treating the folder as unavailable.
    }
  }

  console.warn('Could not fetch folder', parts.join('/'), lastError);
  return null;
}

function cleanName(value) {
  return decodeURIComponent(String(value ?? '')).trim().replace(/\/+$/, '');
}

function parseBrowseHtml(browseUrl, htmlText) {
  const documentNode = new DOMParser().parseFromString(htmlText, 'text/html');
  const currentPath = new URL(browseUrl).pathname.replace(/\/+$/, '');
  const folders = new Map();
  const files = new Map();

  documentNode.querySelectorAll('a[href]').forEach((anchor) => {
    const label = anchor.textContent.trim();
    if (label === '..' || label === '⬅ Back' || label.toLowerCase() === 'back') return;

    const fullUrl = new URL(anchor.getAttribute('href'), browseUrl);
    const path = fullUrl.pathname.replace(/\/+$/, '');
    const name = cleanName(path.split('/').pop());

    if (path.includes('/browse')) {
      if (!path.startsWith(`${currentPath}/`)) return;
      folders.set(name, fullUrl.toString());
    } else if (path.includes('/files/')) {
      files.set(name, fullUrl.toString());
    }
  });

  return {
    folders: [...folders.entries()].map(([name, url]) => ({ name, url })),
    files: [...files.entries()].map(([name, url]) => ({ name, url })),
  };
}

async function listFolder(baseUrl, alias, parts) {
  const fetched = await fetchFolder(baseUrl, alias, parts);
  if (!fetched) return { folders: [], files: [] };
  return parseBrowseHtml(fetched.url, fetched.text);
}

function isImageUrl(url) {
  const path = decodeURIComponent(new URL(url).pathname).toLowerCase();
  return IMAGE_EXTENSIONS.some((extension) => path.endsWith(extension));
}

function fileNameFromUrl(url) {
  return cleanName(new URL(url).pathname.split('/').pop());
}

function rowVideoEntries(row) {
  const videos = parseBracketList(row.videos);
  const vehicleTypes = parseBracketList(row.vehicle_type).map(normaliseValue);
  const timeOfDay = Array.isArray(row.time_of_day) ? row.time_of_day : [];
  const selectedVehicle = selected('vehicleFilter');
  const selectedTime = selected('timeFilter');

  return videos.flatMap((video, index) => {
    if (selectedVehicle !== ALL_VALUE && vehicleTypes[index] !== selectedVehicle) return [];
    const times = Array.isArray(timeOfDay[index]) ? timeOfDay[index].map(normaliseValue) : [];
    const allowedTimes = selectedTime === ALL_VALUE ? times : times.filter((time) => time === selectedTime);

    return allowedTimes.map((time) => ({
      video,
      time,
      vehicle: vehicleTypes[index],
    }));
  });
}

async function candidatePathSets(baseUrl, alias, row, entry) {
  const continent = row.continent;
  const country = row.country;
  const city = row.locality;
  const timeName = TIME_MAP[entry.time] || entry.time;
  const vehicleName = VEHICLE_MAP[entry.vehicle] || entry.vehicle;
  const stateName = normaliseValue(row.state);

  if (stateName) {
    return [[continent, country, stateName, city, timeName, vehicleName, entry.video]];
  }

  const directPath = [continent, country, city, timeName, vehicleName, entry.video];
  const countryFolder = await listFolder(baseUrl, alias, [continent, country]);
  const statePaths = [];

  for (const folder of countryFolder.folders) {
    const stateFolder = await listFolder(baseUrl, alias, [continent, country, folder.name]);
    if (stateFolder.folders.some((candidate) => candidate.name === city)) {
      statePaths.push([continent, country, folder.name, city, timeName, vehicleName, entry.video]);
    }
  }

  return [directPath, ...statePaths];
}

async function collectFromVideoFolder(baseUrl, alias, row, entry, maxImages, seenUrls) {
  const candidates = [];
  const paths = await candidatePathSets(baseUrl, alias, row, entry);

  for (const parts of paths) {
    const { files } = await listFolder(baseUrl, alias, parts);
    const imageFiles = shuffle(files.filter((file) => isImageUrl(file.url) && !seenUrls.has(file.url)));

    for (const file of imageFiles.slice(0, maxImages)) {
      seenUrls.add(file.url);
      candidates.push({
        url: file.url,
        filename: fileNameFromUrl(file.url),
        continent: row.continent,
        country: row.country,
        state: normaliseValue(row.state),
        city: row.locality,
        time: TIME_MAP[entry.time] || entry.time,
        vehicle: VEHICLE_MAP[entry.vehicle] || entry.vehicle,
        video: entry.video,
      });
    }

    if (candidates.length) break;
  }

  return candidates;
}

function renderCandidates() {
  const body = getElement('candidateTableBody');
  const fragment = document.createDocumentFragment();

  state.candidates.forEach((candidate) => {
    const row = document.createElement('tr');
    [candidate.filename, candidate.continent, candidate.country, candidate.state, candidate.city, candidate.time, candidate.vehicle]
      .forEach((value) => {
        const cell = document.createElement('td');
        cell.textContent = value;
        cell.title = value;
        row.appendChild(cell);
      });
    fragment.appendChild(row);
  });

  body.replaceChildren(fragment);
}

async function discoverFrames() {
  const baseUrl = FILE_SERVER_BASE_URL;
  const alias = FILE_SERVER_ALIAS;
  const targetCount = Math.max(1, Number(getElement('countInput').value) || 1);
  const perVideo = Math.max(1, Number(getElement('perVideoInput').value) || 1);

  state.candidates = [];
  state.browseCache.clear();
  renderCandidates();
  getElement('downloadImagesButton').disabled = true;
  getElement('downloadManifestButton').disabled = true;
  setStatus('Discovering matching frame images...');

  const seenUrls = new Set();
  const rows = shuffle(matchingRows());

  try {
    for (const row of rows) {
      const entries = shuffle(rowVideoEntries(row));

      for (const entry of entries) {
        const found = await collectFromVideoFolder(baseUrl, alias, row, entry, perVideo, seenUrls);
        state.candidates.push(...found);
        renderCandidates();
        setStatus(`${state.candidates.length.toLocaleString()} image(s) discovered...`);

        if (state.candidates.length >= targetCount) break;
      }

      if (state.candidates.length >= targetCount) break;
    }

    state.candidates = state.candidates.slice(0, targetCount);
    renderCandidates();
    setStatus(`${state.candidates.length.toLocaleString()} image(s) ready to download.`);
    getElement('downloadImagesButton').disabled = state.candidates.length === 0;
    getElement('downloadManifestButton').disabled = state.candidates.length === 0;
  } catch (error) {
    console.error(error);
    setStatus(`Discovery failed: ${error.message}. Check CORS, credentials, and base URL.`);
  }
}

function makeCsvValue(value) {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function downloadText(filename, text, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function downloadManifest() {
  downloadText('traffcoco-frame-manifest.csv', getManifestCsv(), 'text/csv;charset=utf-8');
}

function getManifestCsv() {
  const columns = ['filename', 'url', 'continent', 'country', 'state', 'city', 'time', 'vehicle', 'video'];
  const rows = [
    columns.join(','),
    ...state.candidates.map((candidate) => columns.map((column) => makeCsvValue(candidate[column])).join(',')),
  ];
  return rows.join('\n');
}

async function downloadImages() {
  if (!state.candidates.length) {
    setStatus('Discover frames before downloading images.');
    return;
  }

  if (!window.JSZip) {
    setStatus('ZIP library did not load. Check your connection and refresh the page.');
    return;
  }

  const button = getElement('downloadImagesButton');
  button.disabled = true;
  setStatus(`Preparing ${state.candidates.length.toLocaleString()} image(s) as a ZIP...`);

  const zip = new JSZip();
  const usedNames = new Set();
  let downloaded = 0;
  let failed = 0;

  for (const candidate of state.candidates) {
    try {
      let response;
      try {
        response = await fetch(candidate.url, { headers: authHeaders() });
      } catch (error) {
        throw new Error(`Browser could not fetch ${candidate.url}. Check CORS and Authorization headers. Browser error: ${error.message}`);
      }
      if (!response.ok) throw new Error(`${response.status} ${response.statusText} while fetching ${candidate.url}`);
      const blob = await response.blob();
      const filename = uniqueZipName(candidate.filename, usedNames);
      zip.file(filename, blob);
      downloaded += 1;
      setStatus(`${downloaded.toLocaleString()} of ${state.candidates.length.toLocaleString()} image(s) added to ZIP...`);
    } catch (error) {
      console.error(error);
      failed += 1;
      setStatus(`Added ${downloaded.toLocaleString()} image(s). Failed on ${candidate.filename}: ${error.message}`);
    }
  }

  zip.file('traffcoco-frame-manifest.csv', getManifestCsv());
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  downloadBlob('traffcoco-frames.zip', zipBlob);
  button.disabled = false;
  setStatus(`ZIP downloaded with ${downloaded.toLocaleString()} image(s). ${failed.toLocaleString()} failed.`);
}

function uniqueZipName(filename, usedNames) {
  const cleanFilename = filename || 'frame.jpg';
  if (!usedNames.has(cleanFilename)) {
    usedNames.add(cleanFilename);
    return cleanFilename;
  }

  const dotIndex = cleanFilename.lastIndexOf('.');
  const stem = dotIndex > 0 ? cleanFilename.slice(0, dotIndex) : cleanFilename;
  const extension = dotIndex > 0 ? cleanFilename.slice(dotIndex) : '';
  let counter = 1;

  while (usedNames.has(`${stem}_${counter}${extension}`)) {
    counter += 1;
  }

  const uniqueName = `${stem}_${counter}${extension}`;
  usedNames.add(uniqueName);
  return uniqueName;
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
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
    refreshFilters();
    setStatus('Metadata loaded. Choose filters and discover frames.');
    getElement('discoverButton').disabled = false;
  } catch (error) {
    console.error(error);
    setStatus('Could not load metadata.');
  }

  getElement('continentFilter').addEventListener('change', () => refreshFilters(1));
  getElement('countryFilter').addEventListener('change', () => refreshFilters(2));
  getElement('stateFilter').addEventListener('change', () => refreshFilters(3));
  getElement('cityFilter').addEventListener('change', () => refreshFilters(4));
  getElement('authModeInput').addEventListener('change', updateAuthFields);
  getElement('discoverButton').addEventListener('click', discoverFrames);
  getElement('downloadImagesButton').addEventListener('click', downloadImages);
  getElement('downloadManifestButton').addEventListener('click', downloadManifest);
  updateAuthFields();
}

main();
