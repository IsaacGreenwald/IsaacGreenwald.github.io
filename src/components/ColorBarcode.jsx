import { useState, useRef, useLayoutEffect, useEffect } from 'react';

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
    case b: h = ((r - g) / d + 4) / 6; break;
  }

  return { h, s, l };
}

const MUTED = 0.10;
const GREY_JITTER = 0.12;
const COLOR_JITTER = 0.04;
const HUE_SHIFT = 0.05;
const REVERSED = false; 

const ANIM = {
  duration: 800,        // ms each stripe takes to reach its new slot
  stagger: 0.05,         // ms of delay added per stripe (the wave)
  dipOpacity: 0.7,     // mid-flight opacity (0 = fully vanish)
  dipScaleY: 1,        
  easing: 'ease-in-out'
};

function signedJitter(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((h >>> 0) % 10000) / 10000 - 0.5;
}

function chroma(hsl) {
  return (1 - Math.abs(2 * hsl.l - 1)) * hsl.s;
}


function colorDistance(hexA, hexB) {
  const a = hexToHsl(hexA);
  const b = hexToHsl(hexB);
  const mutedA = chroma(a) < MUTED;
  const mutedB = chroma(b) < MUTED;

  if (mutedA || mutedB) {
    const base = Math.abs(a.l - b.l) + Math.abs(chroma(a) - chroma(b));
    return mutedA === mutedB ? base : base + 2;
  }

  let dh = Math.abs(a.h - b.h);
  if (dh > 0.5) dh = 1 - dh;
  return dh * 4 + Math.abs(a.l - b.l) * 0.5 + Math.abs(a.s - b.s) * 0.3;
}

function sample(arr, n) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

const BW_SAT = 0.1;

function isBW(photo) {
  return hexToHsl(photo.color).s < BW_SAT;
}


const MATCH_LABELS = {
  hue: 'photos in this color',
  brightness: 'similar brightness',
  date: 'around this time'
};

const photoTime = p => new Date(p.exif?.date || 0).getTime();

const formatDate = d => d ? new Date(d).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : '—';
const greyHex = v => { const n = Math.round(v * 255); return `rgb(${n},${n},${n})`; };

// Nearest photos to the clicked one by whatever metric the bar is sorted by,
// randomly sampled from a small pool so repeat clicks surface different shots.
function nearbyMatches(photos, clicked, sortBy, count = 4, poolSize = 12) {
  let candidates = photos.filter(p => p.id !== clicked.id);
  let distance;

  if (sortBy === 'brightness') {
    distance = p => Math.abs(p.brightness - clicked.brightness);
  } else if (sortBy === 'date') {
    const t = photoTime(clicked);
    // Days dominate; brightness only orders photos sharing the same date
    // (film scans all carry the same placeholder date).
    distance = p => Math.abs(photoTime(p) - t) / 86400000 + Math.abs(p.brightness - clicked.brightness) * 0.4;
  } else {
    candidates = candidates.filter(p => isBW(p) === isBW(clicked));
    distance = p => colorDistance(p.color, clicked.color);
  }

  const pool = candidates
    .map(p => ({ photo: p, d: distance(p) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, poolSize)
    .map(x => x.photo);
  return sample(pool, count);
}

const sortFunctions = {

  hue: (a, b) => {
    const A = hexToHsl(a.color);
    const B = hexToHsl(b.color);
    const cA = chroma(A);
    const cB = chroma(B);
    const mutedA = cA < MUTED;
    const mutedB = cB < MUTED;

    if (mutedA && mutedB) {
      const kA = cA + A.l * 0.15 + signedJitter(a.id) * GREY_JITTER;
      const kB = cB + B.l * 0.15 + signedJitter(b.id) * GREY_JITTER;
      return kA - kB;
    }
    if (mutedA) return -1;
    if (mutedB) return 1;

    const aShifted = (A.h + HUE_SHIFT) % 1 + signedJitter(a.id) * COLOR_JITTER;
    const bShifted = (B.h + HUE_SHIFT) % 1 + signedJitter(b.id) * COLOR_JITTER;
    return aShifted - bShifted;
  },
  brightness: (a, b) => a.brightness - b.brightness,
  date: (a, b) => (a.exif?.date || '').localeCompare(b.exif?.date || '')
};

function Lightbox({ items, index, onClose, onNav }) {
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

  const photo = items[index];
  const big = photo.sizes[photo.sizes.length - 1];

  return (
    <div className="lb-overlay" onClick={onClose}>
      <button className="lb-close" aria-label="Close" onClick={onClose}>×</button>
      <button className="lb-arrow lb-prev" aria-label="Previous" onClick={e => { e.stopPropagation(); onNav(-1); }}>‹</button>
      <img className="lb-img" src={`${photo.src}-${big}.webp`} alt="" onClick={e => e.stopPropagation()} />
      <button className="lb-arrow lb-next" aria-label="Next" onClick={e => { e.stopPropagation(); onNav(1); }}>›</button>
    </div>
  );
}

export default function ColorBarcode({ photos }) {
  const [sortBy, setSortBy] = useState('hue');
  const [selected, setSelected] = useState(null);
  const [matches, setMatches] = useState([]);
  const [matchMode, setMatchMode] = useState('hue');
  const [hoveredId, setHoveredId] = useState(null);
  const [lightbox, setLightbox] = useState(null);

  const wrapperRef = useRef(null);
  const posRef = useRef(new Map());
  const prevSort = useRef(sortBy);

  const sortedPhotos = [...photos].sort(sortFunctions[sortBy]);
  if (REVERSED) sortedPhotos.reverse();

  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const els = [...wrapper.querySelectorAll('.stripe')];
    const newPos = new Map();
    for (const el of els) newPos.set(el.dataset.id, { left: el.offsetLeft, top: el.offsetTop });

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (prevSort.current !== sortBy && !reduce) {
      els.forEach((el, i) => {
        const oldP = posRef.current.get(el.dataset.id);
        const newP = newPos.get(el.dataset.id);
        if (!oldP) return;
        const dx = oldP.left - newP.left;
        const dy = oldP.top - newP.top;
        if (!dx && !dy) return;
        el.animate(
          [
            { transform: `translate(${dx}px, ${dy}px) scaleY(1)`, opacity: 1, offset: 0 },
            { transform: `translate(${dx * 0.5}px, ${dy * 0.5}px) scaleY(${ANIM.dipScaleY})`, opacity: ANIM.dipOpacity, offset: 0.5 },
            { transform: 'translate(0, 0) scaleY(1)', opacity: 1, offset: 1 }
          ],
          { duration: ANIM.duration, easing: ANIM.easing, delay: i * ANIM.stagger }
        );
      });
    }

    prevSort.current = sortBy;
    posRef.current = newPos;
  }, [sortBy]);

  const handleSortChange = (newSort) => {
    setSortBy(newSort);
  };

  const handleStripeClick = (photo) => {
    setSelected(photo);
    setMatchMode(sortBy);
    setMatches(nearbyMatches(photos, photo, sortBy));
  };

  const navLightbox = (dir) =>
    setLightbox(i => (i + dir + matches.length) % matches.length);

  return (
    <div className="color-barcode">
      <div className="sort-controls">
        {Object.keys(sortFunctions).map(key => (
          <button
            key={key}
            onClick={() => handleSortChange(key)}
            className={sortBy === key ? 'active' : ''}
          >
            {key}
          </button>
        ))}
      </div>

      <div className="barcode-wrapper" ref={wrapperRef}>
        {sortedPhotos.map((photo, index) => {
          const tileStyle = sortBy === 'brightness'
            ? { backgroundColor: photo.color, filter: `saturate(1.2) brightness(${0.3 + photo.brightness * 1.4})` }
            : { backgroundColor: photo.color };

          return (
            <div
              key={photo.id}
              data-id={photo.id}
              className={`stripe ${selected?.id === photo.id ? 'selected' : ''} ${hoveredId === photo.id ? 'highlight' : ''}`}
              style={tileStyle}
              onClick={() => handleStripeClick(photo)}
              title={photo.color}
            />
          );
        })}
      </div>

      {selected && (
        <div className="matches">
          <div className="matches-head">
            {matchMode === 'date' ? (
              <span className="date-chip">{formatDate(selected.exif?.date)}</span>
            ) : (
              <span
                className="swatch"
                style={{ backgroundColor: matchMode === 'brightness' ? greyHex(selected.brightness) : selected.color }}
              />
            )}
            <span className="matches-label">{MATCH_LABELS[matchMode]}</span>
          </div>
          <div className="matches-grid">
            {matches.map((photo, i) => (
              <button
                key={photo.id}
                className="match"
                onClick={() => setLightbox(i)}
                onMouseEnter={() => setHoveredId(photo.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <img
                  src={`${photo.src}-400.webp`}
                  alt=""
                  loading="lazy"
                  style={{ backgroundImage: `url(${photo.placeholder})`, backgroundSize: 'cover' }}
                  onLoad={e => { e.currentTarget.style.backgroundImage = 'none'; }}
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {lightbox !== null && (
        <Lightbox
          items={matches}
          index={lightbox}
          onClose={() => setLightbox(null)}
          onNav={navLightbox}
        />
      )}

      <style>{`
        .color-barcode {
          width: 100%;
          padding: 2rem 0;
        }

        .sort-controls {
          display: flex;
          gap: 2rem;
          margin-bottom: 1.75rem;
          justify-content: center;
        }

        .sort-controls button {
          position: relative;
          border: none;
          background: none;
          color: inherit;
          cursor: pointer;
          font-family: var(--font-sans);
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.18em;
          padding: 0.3rem 0;
          opacity: 0.4;
          transition: opacity 0.25s ease;
        }

        .sort-controls button:hover {
          opacity: 0.75;
        }

        .sort-controls button.active {
          opacity: 1;
        }

        .sort-controls button::after {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 1px;
          background: currentColor;
          transform: scaleX(0);
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .sort-controls button.active::after {
          transform: scaleX(1);
        }

        .barcode-wrapper {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 200px;
        }

        .stripe {
          position: relative;
          flex: 0 0 3px;
          height: 100%;
          filter: saturate(1.2);
          cursor: pointer;
          transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease;
        }

        .stripe.selected {
          transform: scaleY(1.25);
          outline: 1px solid rgba(255, 255, 255, 0.7);
          outline-offset: -1px;
          z-index: 1;
        }

        .stripe.highlight {
          transform: scaleX(2.6) scaleY(1.55);
          box-shadow: 0 0 10px rgba(255, 255, 255, 0.7);
          z-index: 2;
        }

        .stripe:hover {
          transform: scaleX(2.6) scaleY(1.2);
          filter: saturate(1.5) brightness(1.25);
          box-shadow: 0 0 12px rgba(255, 255, 255, 0.55);
          z-index: 3;
        }

        .matches {
          margin: 4rem auto 0;
          max-width: 1040px;
          padding-top: 2.25rem;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          opacity: 0.82;
          transition: opacity 0.3s ease;
          animation: fade-in 0.4s ease;
        }

        .matches:hover {
          opacity: 1;
        }

        @keyframes fade-in {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 0.82; transform: translateY(0); }
        }

        .matches-head {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.45rem;
          margin-bottom: 1.25rem;
        }

        .swatch {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          border: 1px solid rgba(255, 255, 255, 0.25);
        }

        .date-chip {
          font-family: var(--font-serif);
          font-size: 1.05rem;
          font-weight: 500;
          letter-spacing: 0.01em;
          opacity: 0.9;
        }

        .matches-label {
          font-size: 0.6rem;
          text-transform: uppercase;
          letter-spacing: 0.22em;
          opacity: 0.4;
        }

        .matches-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 0.6rem;
          justify-content: center;
        }

        .match {
          display: block;
          height: 150px;
          padding: 0;
          border: none;
          overflow: hidden;
          background: #111;
          cursor: zoom-in;
        }

        .match img {
          display: block;
          width: auto;
          height: 100%;
          object-fit: contain;
          transition: transform 0.25s ease;
        }

        .match:hover img {
          transform: scale(1.05);
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

        .lb-img {
          max-width: 92vw;
          max-height: 92vh;
          object-fit: contain;
          cursor: default;
          box-shadow: 0 8px 50px rgba(0, 0, 0, 0.6);
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
          transition: opacity 0.2s ease;
        }

        .lb-close:hover {
          opacity: 1;
        }

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
          padding: 1rem;
          transition: opacity 0.2s ease;
        }

        .lb-arrow:hover {
          opacity: 1;
        }

        .lb-prev { left: 0.5rem; }
        .lb-next { right: 0.5rem; }
      `}</style>
    </div>
  );
}
