import { useEffect, useState } from 'react';
import { UnscrambleText } from './UnscrambleText';

interface RotatingStatusTextProps {
  messages: string[];
  active: boolean;
  intervalMs?: number;
  className?: string;
  as?: 'p' | 'span';
}

export function RotatingStatusText({
  messages,
  active,
  intervalMs = 2200,
  className = 'text-xs text-ces-text-muted',
  as = 'p',
}: RotatingStatusTextProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [messages]);

  useEffect(() => {
    if (!active || messages.length < 2) return;

    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % messages.length);
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [active, intervalMs, messages]);

  return (
    <UnscrambleText
      key={index}
      text={messages[index] ?? ''}
      className={className}
      as={as}
    />
  );
}
