import { useEffect, useState } from 'react';

const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const SCRAMBLE_FRAME_MS = 28;
const SCRAMBLE_DURATION_MS = 420;

function scrambleFrame(target: string, revealedCount: number): string {
  return target
    .split('')
    .map((char, index) => {
      if (char === ' ') return char;
      if (index < revealedCount || /[^A-Za-z0-9]/.test(char)) return char;
      return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
    })
    .join('');
}

interface UnscrambleTextProps {
  text: string;
  className?: string;
}

export function UnscrambleText({ text, className }: UnscrambleTextProps) {
  const [displayText, setDisplayText] = useState(() => scrambleFrame(text, 0));

  useEffect(() => {
    const totalFrames = Math.max(1, Math.round(SCRAMBLE_DURATION_MS / SCRAMBLE_FRAME_MS));
    let frame = 0;

    const timer = window.setInterval(() => {
      frame += 1;
      const revealedCount = Math.floor((frame / totalFrames) * text.length);

      if (frame >= totalFrames) {
        setDisplayText(text);
        window.clearInterval(timer);
        return;
      }

      setDisplayText(scrambleFrame(text, revealedCount));
    }, SCRAMBLE_FRAME_MS);

    return () => window.clearInterval(timer);
  }, [text]);

  return <span className={className}>{displayText}</span>;
}
