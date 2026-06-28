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

/** Tidies raw EXIF camera strings (drops duplicate makes, shouty all-caps). */
export function cameraName(raw) {
  if (!raw) return '';
  return raw
    .replace(/ricoh imaging company,?\s*ltd\.?,?\s*/i, '')
    .replace(/^canon\s+canon\b/i, 'Canon')
    .replace(/\b[A-Z]{4,}\b/g, w => w[0] + w.slice(1).toLowerCase())
    .replace(/\s+/g, ' ')
    .trim();
}

/** Camera + shooting settings as display strings, skipping missing/invalid values. */
export function exifSettings(exif) {
  if (!exif) return [];
  const parts = [];
  const cam = cameraName(exif.camera);
  if (cam) parts.push(cam);
  if (exif.focalLength) parts.push(`${exif.focalLength}mm`);
  if (exif.aperture) parts.push(`ƒ/${exif.aperture}`);
  if (exif.shutter && exif.shutter !== '1/0') parts.push(`${exif.shutter}s`);
  if (exif.iso) parts.push(`ISO ${exif.iso}`);
  return parts;
}

export function exifDate(exif) {
  if (!exif?.date) return '';
  return new Date(exif.date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC'
  });
}

// --- Hue ordering (mirrors the interactive ColorBarcode) ---
const HUE_MUTED = 0.10;
const HUE_GREY_JITTER = 0.12;
const HUE_COLOR_JITTER = 0.04;
const HUE_SHIFT = 0.05;

function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  switch (max) {
    case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
    case g: h = ((b - r) / d + 2) / 6; break;
    default: h = ((r - g) / d + 4) / 6; break;
  }
  return { h, s, l };
}

const chroma = hsl => (1 - Math.abs(2 * hsl.l - 1)) * hsl.s;

function hueJitter(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((h >>> 0) % 10000) / 10000 - 0.5;
}

/** Sorts photos into the barcode's hue order: muted greys first, then rainbow. */
export function sortByHue(list) {
  return [...list].sort((a, b) => {
    const A = hexToHsl(a.color);
    const B = hexToHsl(b.color);
    const cA = chroma(A);
    const cB = chroma(B);
    const mutedA = cA < HUE_MUTED;
    const mutedB = cB < HUE_MUTED;
    if (mutedA && mutedB) {
      return (cA + A.l * 0.15 + hueJitter(a.id) * HUE_GREY_JITTER)
        - (cB + B.l * 0.15 + hueJitter(b.id) * HUE_GREY_JITTER);
    }
    if (mutedA) return -1;
    if (mutedB) return 1;
    return ((A.h + HUE_SHIFT) % 1 + hueJitter(a.id) * HUE_COLOR_JITTER)
      - ((B.h + HUE_SHIFT) % 1 + hueJitter(b.id) * HUE_COLOR_JITTER);
  });
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
  climbing: 'digi-climbing-climbing2',
  japan: 'digi-japan-japan1',
  italy: 'digi-italy-italy12',
  centeur: 'digi-centeur-germany8',
  pacnw: 'digi-pacnw-sb4',
  vietnam: 'digi-vietnam-vietnam3',
  nyc: 'digi-nyc-nyc4',
  montana: 'digi-montana-montana1'
  
};

const DIGITAL_REGIONS = {
  vietnam: 'Vietnam',
  japan: 'Japan',
  italy: 'Italy',
  centeur: 'France, Netherlands, Germany, Czechia, Austria, Hungary',
  pacnw: 'Washington',
  nyc: 'New York',
  montana: 'Montana',
  climbing: 'Colorado, New Mexico, Nevada, Idaho'
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
