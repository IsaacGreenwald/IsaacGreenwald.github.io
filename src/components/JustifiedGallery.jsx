import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { exifSettings, exifDate } from '../lib/photos.js';

function srcset(photo) {
  return photo.sizes.map(w => `${photo.src}-${w}.webp ${w}w`).join(', ');
}

// Justified-rows layout (Flickr / Google Photos style) with look-ahead.
// Each row is scaled so its photos span the full width exactly — flush both
// edges, uniform gaps, zero cropping. Row heights vary (that's what absorbs
// the math), but at every break we choose to close the row with or without
// the next photo based on whichever height lands closest to the target, which
// keeps heights tightly clustered around targetHeight.
function computeRows(photos, containerWidth, targetHeight, gap, uniform) {
  if (!containerWidth) return [];

  // Height that makes `sum` of aspect ratios fill the width across `count` items.
  const heightFor = (sum, count) => (containerWidth - gap * (count - 1)) / sum;
  const makeRow = (items, sum) => {
    if (uniform) {
      // Constant height for every row; widths scaled to fill the container
      // exactly. The width/aspect mismatch is absorbed by object-fit: cover
      // (a small, even crop). Look-ahead already chose the break needing the
      // least adjustment, so the crop stays minimal.
      const avail = containerWidth - gap * (items.length - 1);
      const widthPerAr = avail / sum;
      return {
        height: targetHeight,
        items: items.map(it => ({ ...it, width: it.ar * widthPerAr }))
      };
    }
    const height = heightFor(sum, items.length);
    return { height, items: items.map(it => ({ ...it, width: it.ar * height })) };
  };

  const rows = [];
  let row = [];
  let arSum = 0;

  for (const photo of photos) {
    const ar = photo.width / photo.height;
    const heightWith = heightFor(arSum + ar, row.length + 1);

    if (heightWith > targetHeight) {
      // Row not full yet — keep adding.
      row.push({ photo, ar });
      arSum += ar;
      continue;
    }

    // Adding this photo would meet/undershoot the target height. Close the row
    // either before or after it, whichever height is nearer the target.
    const heightWithout = row.length ? heightFor(arSum, row.length) : Infinity;
    if (row.length && Math.abs(heightWithout - targetHeight) < Math.abs(heightWith - targetHeight)) {
      rows.push(makeRow(row, arSum));
      row = [{ photo, ar }];
      arSum = ar;
    } else {
      row.push({ photo, ar });
      rows.push(makeRow(row, arSum + ar));
      row = [];
      arSum = 0;
    }
  }

  // Leftover last row.
  if (row.length) {
    if (uniform) {
      // Keep constant height; left-aligned at natural widths (don't stretch a
      // sparse final row across the whole container).
      rows.push({
        height: targetHeight,
        last: true,
        items: row.map(it => ({ ...it, width: it.ar * targetHeight }))
      });
    } else {
      const height = heightFor(arSum, row.length);
      if (height > targetHeight * 1.5) {
        rows.push({ height: targetHeight, items: row.map(it => ({ ...it, width: it.ar * targetHeight })) });
      } else {
        rows.push(makeRow(row, arSum));
      }
    }
  }

  return rows;
}

function useContainerWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      setWidth(entries[0].contentRect.width);
    });
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  return [ref, width];
}

function Lightbox({ photos, index, onClose, onNav }) {
  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') onNav(1);
      else if (e.key === 'ArrowLeft') onNav(-1);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose, onNav]);

  const photo = photos[index];
  const big = photo.sizes[photo.sizes.length - 1];
  const settings = exifSettings(photo.exif);
  const date = exifDate(photo.exif);

  return (
    <div className="lb-overlay" onClick={onClose}>
      <button className="lb-close" aria-label="Close" onClick={onClose}>×</button>
      <button
        className="lb-arrow lb-prev"
        aria-label="Previous"
        onClick={e => { e.stopPropagation(); onNav(-1); }}
      >‹</button>
      <figure className="lb-figure" onClick={e => e.stopPropagation()}>
        <img className="lb-img" src={`${photo.src}-${big}.webp`} alt="" />
        {(settings.length > 0 || date) && (
          <figcaption className="lb-caption">
            {settings.length > 0 && <span className="lb-settings">{settings.join('  ·  ')}</span>}
            {date && <span className="lb-date">{date}</span>}
          </figcaption>
        )}
      </figure>
      <button
        className="lb-arrow lb-next"
        aria-label="Next"
        onClick={e => { e.stopPropagation(); onNav(1); }}
      >›</button>
    </div>
  );
}

export default function JustifiedGallery({
  photos,
  targetRowHeight = 280,
  gap = 0,
  rowGap = gap,
  uniform = false
}) {
  const [ref, width] = useContainerWidth();
  const [open, setOpen] = useState(null);

  const rows = useMemo(
    () => computeRows(photos, width, targetRowHeight, gap, uniform),
    [photos, width, targetRowHeight, gap, uniform]
  );

  const nav = dir =>
    setOpen(i => (i + dir + photos.length) % photos.length);

  return (
    <div className="jgallery" ref={ref} style={{ display: 'flex', flexDirection: 'column', rowGap: `${rowGap}px` }}>
      {rows.map((row, ri) => (
        <div className="jrow" key={ri} style={{ gap: `${gap}px`, height: `${row.height}px` }}>
          {row.items.map(({ photo, width: w }) => (
            <figure
              className="jphoto"
              key={photo.id}
              style={{ width: `${w}px`, height: `${row.height}px` }}
              onClick={() => setOpen(photos.indexOf(photo))}
            >
              <img
                src={`${photo.src}-800.webp`}
                srcSet={srcset(photo)}
                sizes={`${Math.ceil(w)}px`}
                width={photo.width}
                height={photo.height}
                alt=""
                loading="lazy"
                style={{ backgroundImage: `url(${photo.placeholder})`, backgroundSize: 'cover' }}
                onLoad={e => { e.currentTarget.style.backgroundImage = 'none'; }}
              />
            </figure>
          ))}
        </div>
      ))}

      {open !== null && (
        <Lightbox
          photos={photos}
          index={open}
          onClose={() => setOpen(null)}
          onNav={nav}
        />
      )}

      <style>{`
        .jgallery { width: 100%; }
        .jrow { display: flex; width: 100%; overflow: hidden; }
        .jphoto {
          margin: 0;
          overflow: hidden;
          background: #111;
          cursor: zoom-in;
          flex: 0 0 auto;
        }
        .jphoto img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .lb-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          background: rgba(0, 0, 0, 0.94);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: zoom-out;
        }
        .lb-figure {
          margin: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.85rem;
          cursor: default;
        }
        .lb-img {
          max-width: 92vw;
          max-height: 84vh;
          object-fit: contain;
          box-shadow: 0 8px 50px rgba(0, 0, 0, 0.6);
        }
        .lb-caption {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.3rem;
          text-align: center;
          color: #cfcfcf;
        }
        .lb-settings {
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.13em;
          color: #b8b8b8;
        }
        .lb-date {
          font-family: 'Newsreader', Georgia, serif;
          font-style: italic;
          font-size: 0.95rem;
          color: #8a8a8a;
        }
        .lb-close {
          position: fixed;
          top: 1rem;
          right: 1.25rem;
          font-size: 2.5rem;
          line-height: 1;
          color: #fff;
          background: none;
          border: none;
          cursor: pointer;
          opacity: 0.7;
          transition: opacity 0.2s;
        }
        .lb-close:hover { opacity: 1; }
        .lb-arrow {
          position: fixed;
          top: 50%;
          transform: translateY(-50%);
          font-size: 3.5rem;
          line-height: 1;
          color: #fff;
          background: none;
          border: none;
          cursor: pointer;
          opacity: 0.55;
          transition: opacity 0.2s;
          padding: 1rem;
        }
        .lb-arrow:hover { opacity: 1; }
        .lb-prev { left: 0.5rem; }
        .lb-next { right: 0.5rem; }
      `}</style>
    </div>
  );
}
