// data.json keeps the mapping.csv cells as text, e.g. "43.65" or "[[0],[0,1]]".
// normaliseCrowdRow turns them back into numbers and (nested) lists so the pages can use them.
const CROWD_NUMBER_FIELDS = [
  'id',
  'lat',
  'lon',
  'gmp',
  'population_locality',
  'population_country',
  'traffic_mortality',
  'literacy_rate',
  'avg_height',
  'med_age',
  'gini',
  'traffic_index',
];
const CROWD_NUMBER_LIST_FIELDS = ['time_of_day', 'start_time', 'end_time', 'vehicle_type', 'upload_date'];
const CROWD_TEXT_LIST_FIELDS = ['locality_aka'];

function parseCrowdNumber(value) {
  if (typeof value !== 'string') return value;
  const text = value.trim();
  if (text === '') return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : value;
}

function parseCrowdList(value, toLeaf) {
  if (typeof value !== 'string') return value;
  const text = value.trim();
  if (!text.startsWith('[')) return value;
  let index = 0;

  const skipSpaces = () => {
    while (text[index] === ' ') index += 1;
  };

  const parseItem = () => {
    skipSpaces();
    if (text[index] === '[') {
      index += 1;
      const items = [];
      skipSpaces();
      while (index < text.length && text[index] !== ']') {
        const item = parseItem();
        if (item !== undefined) items.push(item);
        skipSpaces();
        if (text[index] === ',') index += 1;
      }
      index += 1;
      return items;
    }

    const start = index;
    while (index < text.length && text[index] !== ',' && text[index] !== ']') index += 1;
    const leaf = text.slice(start, index).trim();
    return leaf === '' ? undefined : toLeaf(leaf);
  };

  return parseItem();
}

function normaliseCrowdRow(row) {
  const parsed = { ...row };
  CROWD_NUMBER_FIELDS.forEach((field) => {
    if (field in parsed) parsed[field] = parseCrowdNumber(parsed[field]);
  });
  CROWD_NUMBER_LIST_FIELDS.forEach((field) => {
    if (field in parsed) parsed[field] = parseCrowdList(parsed[field], parseCrowdNumber);
  });
  CROWD_TEXT_LIST_FIELDS.forEach((field) => {
    if (field in parsed) parsed[field] = parseCrowdList(parsed[field], (leaf) => leaf);
  });
  return parsed;
}
