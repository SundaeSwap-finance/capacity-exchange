import { useEffect, useState } from 'react';

interface RotatingStatusTextProps {
  messages: string[];
  active: boolean;
  intervalMs?: number;
  className?: string;
  as?: 'p' | 'span';
}

const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const SCRAMBLE_FRAME_MS = 28;
const SCRAMBLE_DURATION_MS = 420;

function scrambleFrame(target: string, revealedCount: number): string {
  return target
    .split('')
    .map((char, index) => {
      if (char === ' ') {
        return char;
      }

      if (index < revealedCount || /[^A-Za-z0-9]/.test(char)) {
        return char;
      }

      return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
    })
    .join('');
}

export function RotatingStatusText({
  messages,
  active,
  intervalMs = 2200,
  className = 'text-xs text-ces-text-muted',
  as = 'p',
}: RotatingStatusTextProps) {
  const [index, setIndex] = useState(0);
  const [displayText, setDisplayText] = useState(messages[0] ?? '');

  useEffect(() => {
    setIndex(0);
  }, [messages]);

  useEffect(() => {
    const target = messages[index] ?? '';
    setDisplayText(scrambleFrame(target, 0));

    if (!target) {
      return;
    }

    const totalFrames = Math.max(1, Math.round(SCRAMBLE_DURATION_MS / SCRAMBLE_FRAME_MS));
    let frame = 0;

    const timer = window.setInterval(() => {
      frame += 1;
      const revealedCount = Math.floor((frame / totalFrames) * target.length);

      if (frame >= totalFrames) {
        setDisplayText(target);
        window.clearInterval(timer);
        return;
      }

      setDisplayText(scrambleFrame(target, revealedCount));
    }, SCRAMBLE_FRAME_MS);

    return () => window.clearInterval(timer);
  }, [index, messages]);

  useEffect(() => {
    if (!active || messages.length < 2) {
      return;
    }

    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % messages.length);
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [active, intervalMs, messages]);

  const Component = as;
  return <Component className={className}>{displayText}</Component>;
}
