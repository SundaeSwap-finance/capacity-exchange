import { useEffect, useRef, useState } from 'react';

interface AnimatedNumberProps {
  value: number;
  /** When true, ignores value changes until unfrozen. */
  freeze?: boolean;
  duration?: number;
  className?: string;
  formatter?: (n: number) => string;
  /** 'auto' picks green for increase, red for decrease. Or force a specific color. */
  flash?: 'auto' | 'green' | 'red' | null;
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
  const [flashColor, setFlashColor] = useState<'green' | 'red' | null>(null);
  const prevRef = useRef(value);
  const rafRef = useRef<number>(0);
  const isFirstRender = useRef(true);
  const frozenTargetRef = useRef(value);

  useEffect(() => {
    frozenTargetRef.current = value;
  }, [value]);

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

    if (flash) {
      const color = flash === 'auto'
        ? (to > from ? 'green' : 'red')
        : flash;
      setFlashColor(color);
      setTimeout(() => setFlashColor(null), 1500);
    }

    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (to - from) * eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [freeze, value, duration, flash]);

  const flashClass = flashColor === 'green'
    ? 'ces-flash-green'
    : flashColor === 'red'
      ? 'ces-flash-red'
      : '';

  return <span className={`${className ?? ''} ${flashClass}`}>{formatter(display)}</span>;
}
