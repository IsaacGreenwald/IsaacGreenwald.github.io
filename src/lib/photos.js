import photos from '../data/photos.json';

const MEDIUM_ORDER = ['digi', 'color', 'bw'];

const MEDIUM_NAMES = {
  bw: 'Black & White',
  color: 'Color Film',
  digi: 'Digital'
};

const PLACE_NAMES = {
  centeur: 'Central Europe',
  pacnw: 'Pacific Northwest',
  pnw: 'Pacific Northwest',
  nyc: 'New York City'
};

function titleCase(s) {
  return s.replace(/\b\w/g, c => c.toUpperCase());
}

export function mediumName(medium) {
  return MEDIUM_NAMES[medium] ?? titleCase(medium);
}

export function placeName(place) {
  return PLACE_NAMES[place] ?? titleCase(place);
}

function parseLocation(location) {
  const [medium, place] = location.split(/[\\/]/);
  return { medium, place };
}

export function srcset(photo) {
  return photo.sizes.map(w => `${photo.src}-${w}.webp ${w}w`).join(', ');
}

export function getPhotos(medium, place) {
  return photos.filter(p => {
    const loc = parseLocation(p.location);
    return loc.medium === medium && loc.place === place;
  });
}

function orient(p) {
  const ar = p.width / p.height;
  if (ar >= 1.3) return 'landscape';
  if (ar <= 0.77) return 'portrait';
  return 'square';
}


function interleaveOrient(list) {
  const buckets = { landscape: [], portrait: [], square: [] };
  for (const p of list) buckets[orient(p)].push(p);
  const idx = { landscape: 0, portrait: 0, square: 0 };
  const out = [];
  while (out.length < list.length) {
    let pick = null;
    let best = Infinity;
    for (const k of ['landscape', 'portrait', 'square']) {
      if (idx[k] >= buckets[k].length) continue;
      const frac = idx[k] / buckets[k].length;
      if (frac < best) { best = frac; pick = k; }
    }
    out.push(buckets[pick][idx[pick]++]);
  }
  return out;
}


export function getFilmPhotos() {
  const bw = photos.filter(p => parseLocation(p.location).medium === 'bw');
  const color = photos.filter(p => parseLocation(p.location).medium === 'color');
  return [...interleaveOrient(bw), ...interleaveOrient(color)];
}

const DIGITAL_ORDER = ['vietnam', 'japan', 'italy', 'centeur', 'pacnw', 'nyc', 'montana', 'climbing'];

const DIGITAL_COVERS = {
  vietnam: 'digi-vietnam-vietnam3',
  japan: 'digi-japan-japan1',
  italy: 'digi-italy-italy12',
  centeur: 'digi-centeur-germany8',
  pacnw: 'digi-pacnw-sb4',
  nyc: 'digi-nyc-nyc4',
  montana: 'digi-montana-montana1',
  climbing: 'digi-climbing-climbing2'
};

const DIGITAL_REGIONS = {
  vietnam: 'Southeast Asia',
  japan: 'Japan',
  italy: 'Italy',
  centeur: 'Central Europe',
  pacnw: 'Pacific Northwest',
  nyc: 'New York',
  montana: 'Montana',
  climbing: ''
};

function medianYear(list) {
  const years = list
    .map(p => p.exif?.date && Number(p.exif.date.slice(0, 4)))
    .filter(Boolean)
    .sort((a, b) => a - b);
  return years.length ? years[Math.floor(years.length / 2)] : null;
}

/** Returns the digital portfolios as ordered "sets", each with a chosen cover. */
export function getDigitalSets() {
  const byPlace = new Map();
  for (const photo of photos) {
    const { medium, place } = parseLocation(photo.location);
    if (medium !== 'digi') continue;
    if (!byPlace.has(place)) byPlace.set(place, []);
    byPlace.get(place).push(photo);
  }

  const order = place => {
    const i = DIGITAL_ORDER.indexOf(place);
    return i === -1 ? Infinity : i;
  };

  return [...byPlace.entries()]
    .sort((a, b) => order(a[0]) - order(b[0]))
    .map(([place, list]) => ({
      place,
      name: placeName(place),
      region: DIGITAL_REGIONS[place] ?? '',
      year: medianYear(list),
      count: list.length,
      photos: list,
      cover: list.find(p => p.id === DIGITAL_COVERS[place]) ?? list[0]
    }));
}

export function getDigitalPhotos(place) {
  return getPhotos('digi', place);
}

export function getPortfolios() {
  const byMedium = new Map();

  for (const photo of photos) {
    const { medium, place } = parseLocation(photo.location);
    if (!byMedium.has(medium)) byMedium.set(medium, new Map());
    const places = byMedium.get(medium);
    if (!places.has(place)) places.set(place, []);
    places.get(place).push(photo);
  }

  const order = m => {
    const i = MEDIUM_ORDER.indexOf(m);
    return i === -1 ? Infinity : i;
  };

  return [...byMedium.entries()]
    .sort((a, b) => order(a[0]) - order(b[0]))
    .map(([medium, places]) => ({
      medium,
      mediumName: mediumName(medium),
      places: [...places.entries()].map(([place, photos]) => ({
        place,
        placeName: placeName(place),
        photos,
        cover: photos[0]
      }))
    }));
}

export function getAllPortfolios() {
  return getPortfolios().flatMap(m =>
    m.places.map(p => ({ medium: m.medium, place: p.place, photos: p.photos }))
  );
}
