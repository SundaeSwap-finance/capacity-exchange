import { useEffect, useRef, useState } from 'react';

interface AnimatedNumberProps {
  value: number;
  /** When true, ignores value changes until unfrozen. */
  freeze?: boolean;
  duration?: number;
  className?: string;
  formatter?: (n: number) => string;
  flash?: 'green' | 'red' | null;
}

export function AnimatedNumber({
  value,
  freeze = false,
  duration = 600,
  className,
  formatter = (n) => Math.round(n).toLocaleString(),
  flash,
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(value);
  const [isFlashing, setIsFlashing] = useState(false);
  const prevRef = useRef(value);
  const rafRef = useRef<number>(0);
  const isFirstRender = useRef(true);
  // Track the latest value seen while frozen so we can animate to it on unfreeze
  const frozenTargetRef = useRef(value);

  // When frozen, just record the incoming value without animating
  useEffect(() => {
    frozenTargetRef.current = value;
  }, [value]);

  // The effective value: use actual value when not frozen
  const effectiveValue = freeze ? display : value;

  useEffect(() => {
    if (freeze) return;

    const target = frozenTargetRef.current;

    if (isFirstRender.current) {
      isFirstRender.current = false;
      prevRef.current = target;
      setDisplay(target);
      return;
    }

    const from = prevRef.current;
    const to = target;
    prevRef.current = to;

    if (from === to) {
      setDisplay(to);
      return;
    }

    // Trigger flash
    if (flash) {
      setIsFlashing(true);
      setTimeout(() => setIsFlashing(false), 1500);
    }

    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (to - from) * eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [freeze, value, duration, flash]);

  const flashClass = isFlashing
    ? flash === 'green'
      ? 'ces-flash-green'
      : flash === 'red'
        ? 'ces-flash-red'
        : ''
    : '';

  return <span className={`${className ?? ''} ${flashClass}`}>{formatter(display)}</span>;
}
