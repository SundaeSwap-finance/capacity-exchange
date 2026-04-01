import { useEffect, useMemo, useState } from 'react';

const CELL_SIZE = 56;
const TOTAL_DURATION_MS = 900;
const MAX_DELAY_MS = 620;
const CELL_FADE_MS = 260;
const CELL_FADE_VARIANCE_MS = 120;

function pseudoRandom(index: number): number {
  const x = Math.sin(index * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export function PagePixelReveal() {
  const [active, setActive] = useState(true);
  const [viewport, setViewport] = useState({ width: 1440, height: 900 });

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setActive(false);
      return;
    }

    const updateViewport = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);

    const timer = window.setTimeout(() => setActive(false), TOTAL_DURATION_MS);

    return () => {
      window.removeEventListener('resize', updateViewport);
      window.clearTimeout(timer);
    };
  }, []);

  const cells = useMemo(() => {
    const cols = Math.ceil(viewport.width / CELL_SIZE);
    const rows = Math.ceil(viewport.height / CELL_SIZE);
    const count = cols * rows;
    const maxCenterDistance = Math.hypot(0.5, 0.5);
    const maxTopDistance = Math.hypot(0.5, 0.86);
    const maxCornerDistance = Math.hypot(1, 1);

    return {
      cols,
      rows,
      items: Array.from({ length: count }, (_, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const x = cols === 1 ? 0.5 : col / (cols - 1);
        const y = rows === 1 ? 0.5 : row / (rows - 1);

        const centerDistance = Math.hypot(x - 0.5, y - 0.5) / maxCenterDistance;
        const topDistance = Math.hypot(x - 0.5, y - 0.14) / maxTopDistance;
        const bottomLeftDistance = Math.hypot(x, 1 - y) / maxCornerDistance;
        const bottomRightDistance = Math.hypot(1 - x, 1 - y) / maxCornerDistance;
        const bottomCornerCloseness = 1 - Math.min(bottomLeftDistance, bottomRightDistance);

        // First openings happen from center, then top-middle pushes outward.
        const centerWave = centerDistance * 0.42;
        const topWave = 0.16 + topDistance * 0.36;
        const bottomHold = Math.max(0, bottomCornerCloseness) * 0.3;
        const lowerScreenBias = Math.pow(y, 1.55) * 0.1;

        // Add clustered noise so adjacent cells don't all reveal together.
        const coarseNoise = pseudoRandom(Math.floor(col / 2) * 97 + Math.floor(row / 2) * 193 + 11);
        const mediumNoise = pseudoRandom(col * 31 + row * 47 + 23);
        const fineNoise = pseudoRandom(index + 1);
        const jitter = (coarseNoise - 0.5) * 0.16 + (mediumNoise - 0.5) * 0.1 + (fineNoise - 0.5) * 0.06;

        const score = Math.max(0, Math.min(1, Math.min(centerWave, topWave) + bottomHold + lowerScreenBias + jitter));

        return {
          id: index,
          delay: Math.round(score * MAX_DELAY_MS),
          duration: CELL_FADE_MS + Math.round((fineNoise - 0.5) * CELL_FADE_VARIANCE_MS),
        };
      }),
    };
  }, [viewport]);

  if (!active) return null;

  return (
    <div aria-hidden="true" className="ces-pixel-overlay">
      {cells.items.map((cell) => (
        <div
          key={cell.id}
          className="ces-pixel-overlay-cell"
          style={{
            left: `${(cell.id % cells.cols) * CELL_SIZE}px`,
            top: `${Math.floor(cell.id / cells.cols) * CELL_SIZE}px`,
            width: `${CELL_SIZE}px`,
            height: `${CELL_SIZE}px`,
            animationDelay: `${cell.delay}ms`,
            animationDuration: `${Math.max(110, cell.duration)}ms`,
          }}
        />
      ))}
    </div>
  );
}
