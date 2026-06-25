import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import exifr from 'exifr';

const SOURCE_DIR = './photos-source';
const OUTPUT_DIR = './public/photos';
const DATA_FILE = './src/data/photos.json';
const WIDTHS = [400, 800, 1600];
const BLUR_SIZE = 20;

async function generateBlurPlaceholder(filePath) {
  const buffer = await sharp(filePath)
    .resize(BLUR_SIZE)
    .blur(3)
    .webp({ quality: 20 })
    .toBuffer();

  return `data:image/webp;base64,${buffer.toString('base64')}`;
}

async function extractExif(filePath) {
  try {
    const exif = await exifr.parse(filePath, {
      pick: ['DateTimeOriginal', 'Make', 'Model', 'FocalLength', 'FNumber', 'ISO', 'ExposureTime']
    });

    if (!exif) return null;

    let camera = [exif.Make, exif.Model].filter(Boolean).join(' ') || null;
    if (camera?.toLowerCase().includes('plustek')) camera = 'Canon AE-1';

    return {
      date: exif.DateTimeOriginal?.toISOString().split('T')[0] ?? null,
      camera,
      focalLength: exif.FocalLength ?? null,
      aperture: exif.FNumber ?? null,
      iso: exif.ISO ?? null,
      shutter: exif.ExposureTime ? `1/${Math.round(1 / exif.ExposureTime)}` : null
    };
  } catch {
    return null;
  }
}

// Calculate average brightness of the whole image
async function extractAverageBrightness(filePath) {
  const { data } = await sharp(filePath)
    .resize(50, 50, { fit: 'cover' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let total = 0;
  for (let i = 0; i < data.length; i += 3) {
    // Perceived brightness formula (human eye is more sensitive to green)
    total += (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
  }
  return total / (data.length / 3) / 255; // 0-1 scale
}

// Median-cut quantization to find dominant color
async function extractDominantColor(filePath) {
  const { data, info } = await sharp(filePath)
    .resize(50, 50, { fit: 'cover' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Collect pixels as [r, g, b] arrays
  const pixels = [];
  for (let i = 0; i < data.length; i += 3) {
    pixels.push([data[i], data[i + 1], data[i + 2]]);
  }

  // Find the color channel with the greatest range
  function getRange(pixels, channel) {
    let min = 255, max = 0;
    for (const p of pixels) {
      if (p[channel] < min) min = p[channel];
      if (p[channel] > max) max = p[channel];
    }
    return max - min;
  }

  // Recursively split the pixel set into buckets
  function medianCut(pixels, depth) {
    if (depth === 0 || pixels.length === 0) {
      const avg = [0, 0, 0];
      for (const p of pixels) {
        avg[0] += p[0];
        avg[1] += p[1];
        avg[2] += p[2];
      }
      return [{
        color: avg.map(c => Math.round(c / pixels.length)),
        count: pixels.length
      }];
    }

    const ranges = [0, 1, 2].map(c => getRange(pixels, c));
    const channel = ranges.indexOf(Math.max(...ranges));

    pixels.sort((a, b) => a[channel] - b[channel]);
    const mid = Math.floor(pixels.length / 2);

    return [
      ...medianCut(pixels.slice(0, mid), depth - 1),
      ...medianCut(pixels.slice(mid), depth - 1)
    ];
  }

  const buckets = medianCut(pixels, 3); // 8 buckets

  // Calculate saturation for a color
  function getSaturation([r, g, b]) {
    const max = Math.max(r, g, b) / 255;
    const min = Math.min(r, g, b) / 255;
    if (max === 0) return 0;
    return (max - min) / max;
  }

  // Filter out very dark/light colors
  const validBuckets = buckets.filter(bucket => {
    const [r, g, b] = bucket.color;
    const brightness = (r + g + b) / 3;
    return brightness > 30 && brightness < 225;
  });

  // Pick the most saturated color (most vivid)
  const best = (validBuckets.length > 0 ? validBuckets : buckets)
    .sort((a, b) => getSaturation(b.color) - getSaturation(a.color))[0];

  const [r, g, b] = best.color;
  return `#${[r, g, b].map(c => c.toString(16).padStart(2, '0')).join('')}`;
}

async function findImages(dir, baseDir = dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await findImages(fullPath, baseDir));
    } else if (/\.(jpg|jpeg|png|webp|tiff)$/i.test(entry.name)) {
      const relativePath = path.relative(baseDir, fullPath);
      const location = path.dirname(relativePath);
      files.push({
        path: fullPath,
        name: path.basename(entry.name, path.extname(entry.name)),
        location: location === '.' ? null : location
      });
    }
  }

  return files;
}

async function processPhoto({ path: filePath, name, location }) {
  const image = sharp(filePath);
  const metadata = await image.metadata();

  const prefix = location ? `${location.replace(/[\\/]/g, '-')}-` : '';
  const outputName = `${prefix}${name}`;

  console.log(`Processing: ${outputName} (${metadata.width}x${metadata.height})`);

  const sizes = [];
  for (const width of WIDTHS) {
    if (metadata.width < width) continue;

    const outputPath = path.join(OUTPUT_DIR, `${outputName}-${width}.webp`);
    await sharp(filePath)
      .resize(width)
      .webp({ quality: 80 })
      .toFile(outputPath);
    sizes.push(width);
  }

  const [placeholder, exif, color, brightness] = await Promise.all([
    generateBlurPlaceholder(filePath),
    extractExif(filePath),
    extractDominantColor(filePath),
    extractAverageBrightness(filePath)
  ]);

  return {
    id: outputName,
    src: `/photos/${outputName}`,
    location,
    width: metadata.width,
    height: metadata.height,
    sizes,
    placeholder,
    exif,
    color,
    brightness
  };
}

// Film scans have no EXIF date; inherit the median date of the matching
// digital trip so they sort into the right place on a timeline.
const FILM_DATE_SOURCE = {
  'bw/europe': 'digi/centeur',
  'bw/nyc': 'digi/nyc',
  'color/pnw': 'digi/pacnw',
  'color/vietnam': 'digi/vietnam'
};

const normLoc = loc => (loc ? loc.split(/[\\/]/).join('/') : loc);

function assignFilmDates(photos) {
  const datesByLoc = {};
  for (const p of photos) {
    if (p.exif?.date) (datesByLoc[normLoc(p.location)] ??= []).push(p.exif.date);
  }

  const medianByLoc = {};
  for (const [loc, dates] of Object.entries(datesByLoc)) {
    const sorted = dates.sort();
    medianByLoc[loc] = sorted[Math.floor(sorted.length / 2)];
  }

  for (const p of photos) {
    const source = FILM_DATE_SOURCE[normLoc(p.location)];
    if (source && medianByLoc[source]) {
      p.exif = { ...(p.exif ?? {}), date: medianByLoc[source] };
    }
  }
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });

  try {
    await fs.access(SOURCE_DIR);
  } catch {
    console.log(`Create ./photos-source and add some photos, then run: npm run prebuild`);
    return;
  }

  const images = await findImages(SOURCE_DIR);
  console.log(`Found ${images.length} images\n`);

  const photos = [];
  for (const image of images) {
    const photoData = await processPhoto(image);
    photos.push(photoData);
  }

  assignFilmDates(photos);

  await fs.writeFile(DATA_FILE, JSON.stringify(photos, null, 2));
  console.log(`\nWrote ${photos.length} photos to ${DATA_FILE}`);
}

main().catch(console.error);
