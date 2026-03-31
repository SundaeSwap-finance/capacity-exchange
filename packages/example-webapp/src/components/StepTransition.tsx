import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Direction } from '../hooks/useTutorialState';

interface StepTransitionProps {
  animKey: number;
  direction: Direction;
  children: ReactNode;
}

type StepPixelCellStyle = CSSProperties & {
  '--ces-step-pixel-bg'?: string;
  '--ces-step-pixel-blur'?: string;
  '--ces-step-pixel-cover-duration'?: string;
  '--ces-step-pixel-reveal-duration'?: string;
  '--ces-step-pixel-black-alpha'?: string;
  '--ces-step-pixel-delay'?: string;
};

type StepPixelOverlayStyle = CSSProperties;

const COVER_DURATION_MS = 620;
const REVEAL_DURATION_MS = 560;
const CELL_SIZE = 104;
const CELL_OVERLAP = 4;
const CELL_DELAY_SPREAD_MS = 220;
const OVERLAY_WIDTH = 560;
const OVERLAY_HEIGHT = 760;
const OVERLAY_VIEWPORT_MARGIN = 16;

function pseudoRandom(index: number): number {
  const x = Math.sin(index * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export function StepTransition({ animKey, direction, children }: StepTransitionProps) {
  const [displayedKey, setDisplayedKey] = useState(animKey);
  const [displayedChildren, setDisplayedChildren] = useState(children);
  const [phase, setPhase] = useState<'idle' | 'covering' | 'revealing'>('idle');
  const [viewport, setViewport] = useState({ width: 480, height: 480 });
  const [overlayRect, setOverlayRect] = useState({ left: 0, top: 0, width: 480, height: 480 });
  const rootRef = useRef<HTMLDivElement | null>(null);
  const incomingKeyRef = useRef(animKey);
  const incomingChildrenRef = useRef(children);
  const initializedRef = useRef(false);

  incomingKeyRef.current = animKey;
  incomingChildrenRef.current = children;

  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const targetNode = node.closest<HTMLElement>('.ces-step-transition-scope') ?? node;

    const updateOverlayBounds = () => {
      const rect = targetNode.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const maxWidth = Math.max(1, Math.round(window.innerWidth - OVERLAY_VIEWPORT_MARGIN * 2));
      const maxHeight = Math.max(1, Math.round(window.innerHeight - OVERLAY_VIEWPORT_MARGIN * 2));
      const width = Math.min(OVERLAY_WIDTH, maxWidth);
      const height = Math.min(OVERLAY_HEIGHT, maxHeight);
      const left = Math.round(
        Math.max(
          OVERLAY_VIEWPORT_MARGIN,
          Math.min(centerX - width / 2, window.innerWidth - OVERLAY_VIEWPORT_MARGIN - width)
        )
      );
      const top = Math.round(
        Math.max(
          OVERLAY_VIEWPORT_MARGIN,
          Math.min(centerY - height / 2, window.innerHeight - OVERLAY_VIEWPORT_MARGIN - height)
        )
      );

      setViewport({
        width,
        height,
      });
      setOverlayRect({
        left,
        top,
        width,
        height,
      });
    };

    updateOverlayBounds();
    const observer = new ResizeObserver(updateOverlayBounds);
    observer.observe(targetNode);
    window.addEventListener('resize', updateOverlayBounds);
    window.addEventListener('scroll', updateOverlayBounds, true);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateOverlayBounds);
      window.removeEventListener('scroll', updateOverlayBounds, true);
    };
  }, []);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      return;
    }

    if (animKey === displayedKey) return;

    setPhase('covering');

    const coverTimer = window.setTimeout(() => {
      setDisplayedKey(incomingKeyRef.current);
      setDisplayedChildren(incomingChildrenRef.current);
      setPhase('revealing');
    }, COVER_DURATION_MS);

    const revealTimer = window.setTimeout(() => {
      setPhase('idle');
    }, COVER_DURATION_MS + REVEAL_DURATION_MS);

    return () => {
      window.clearTimeout(coverTimer);
      window.clearTimeout(revealTimer);
    };
  }, [animKey, displayedKey]);

  useEffect(() => {
    if (phase === 'idle' && animKey === displayedKey) {
      setDisplayedChildren(children);
    }
  }, [animKey, children, displayedKey, phase]);

  useEffect(() => {
    const stage = rootRef.current?.closest<HTMLElement>('.ces-main-stage');
    if (!stage) return;

    if (phase === 'idle') {
      delete stage.dataset.stepTransitionPhase;
      return;
    }

    stage.dataset.stepTransitionPhase = phase;

    return () => {
      if (stage.dataset.stepTransitionPhase === phase) {
        delete stage.dataset.stepTransitionPhase;
      }
    };
  }, [phase]);

  const cells = useMemo(() => {
    const cols = Math.max(1, Math.ceil((viewport.width + CELL_OVERLAP * 2) / CELL_SIZE) + 1);
    const rows = Math.max(1, Math.ceil((viewport.height + CELL_OVERLAP * 2) / CELL_SIZE) + 1);
    const count = cols * rows;
    const maxDistance = Math.hypot(cols - 1 || 1, rows - 1 || 1);
    const xOffset = Math.floor((viewport.width - cols * CELL_SIZE) / 2);
    const yOffset = Math.floor((viewport.height - rows * CELL_SIZE) / 2);

    return Array.from({ length: count }, (_, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const centerDistance = Math.hypot(col - (cols - 1) / 2, row - (rows - 1) / 2) / Math.max(1, maxDistance);
      const wave = direction === 'forward' ? centerDistance : 1 - centerDistance;
      const coverNoise = pseudoRandom(index + 1);
      const revealNoise = pseudoRandom(index + 17);
      const coverDelay = Math.round(coverNoise * CELL_DELAY_SPREAD_MS);
      const revealDelay = Math.max(0, Math.round((wave + (revealNoise - 0.5) * 0.28 + 0.14) * CELL_DELAY_SPREAD_MS));

        return {
        id: index,
        left: xOffset + col * CELL_SIZE - CELL_OVERLAP,
        top: yOffset + row * CELL_SIZE - CELL_OVERLAP,
        coverDelay,
        revealDelay,
        blur: 10 + Math.round(pseudoRandom(index + 73) * 10),
        coverDuration: 110 + Math.round(pseudoRandom(index + 109) * 120),
        revealDuration: 220 + Math.round(pseudoRandom(index + 149) * 140),
        blackAlpha: (0.9 + pseudoRandom(index + 211) * 0.1).toFixed(3),
      };
    });
  }, [direction, viewport]);

  const renderedChildren = phase === 'idle' ? children : displayedChildren;

  return (
    <div ref={rootRef} className="ces-step-transition">
      <div
        key={displayedKey}
        className={`ces-step-content ${
          phase === 'revealing' ? 'ces-step-widget-unpixelate' : phase === 'covering' ? 'ces-step-widget-dim' : ''
        }`}
      >
        {renderedChildren}
      </div>

      {phase !== 'idle' && typeof document !== 'undefined'
        ? createPortal(
            <div
              aria-hidden="true"
              className={`ces-step-pixel-overlay ${phase === 'covering' ? 'ces-step-pixel-overlay-cover' : 'ces-step-pixel-overlay-reveal'}`}
              style={
                {
                  left: `${overlayRect.left}px`,
                  top: `${overlayRect.top}px`,
                  width: `${overlayRect.width}px`,
                  height: `${overlayRect.height}px`,
                } satisfies StepPixelOverlayStyle
              }
            >
              {cells.map((cell) => {
                const cellStyle: StepPixelCellStyle = {
                  left: `${cell.left}px`,
                  top: `${cell.top}px`,
                  width: `${CELL_SIZE + CELL_OVERLAP * 2}px`,
                  height: `${CELL_SIZE + CELL_OVERLAP * 2}px`,
                  '--ces-step-pixel-bg': 'rgb(255 255 255 / 0)',
                  '--ces-step-pixel-blur': `${cell.blur}px`,
                  '--ces-step-pixel-cover-duration': `${cell.coverDuration}ms`,
                  '--ces-step-pixel-reveal-duration': `${cell.revealDuration}ms`,
                  '--ces-step-pixel-black-alpha': cell.blackAlpha,
                  '--ces-step-pixel-delay': `${phase === 'covering' ? cell.coverDelay : cell.revealDelay}ms`,
                };

                return (
                  <span
                    key={cell.id}
                    className="ces-step-pixel-cell"
                    style={cellStyle}
                  />
                );
              })}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
