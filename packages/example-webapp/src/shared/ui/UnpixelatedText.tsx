import type { CSSProperties, HTMLAttributes } from 'react';

type UnpixelatedTextStyle = CSSProperties & {
  '--ces-unpixelate-delay'?: string;
  '--ces-unpixelate-duration'?: string;
  '--ces-unpixelate-jitter-x'?: string;
  '--ces-unpixelate-jitter-y'?: string;
};

export interface UnpixelatedTextProps extends HTMLAttributes<HTMLSpanElement> {
  text: string;
  durationMs?: number;
  staggerMs?: number;
}

function pseudoRandom(index: number): number {
  const value = Math.sin((index + 1) * 91.137) * 43758.5453;
  return value - Math.floor(value);
}

export function UnpixelatedText({
  text,
  className = '',
  durationMs = 520,
  staggerMs = 42,
  style,
  ...props
}: UnpixelatedTextProps) {
  return (
    <span
      aria-label={text}
      className={`ces-unpixelate ${className}`.trim()}
      style={style}
      {...props}
    >
      {Array.from(text).map((character, index) => {
        if (character === ' ') {
          return (
            <span key={`gap-${index}`} aria-hidden="true" className="ces-unpixelate-gap">
              {'\u00a0'}
            </span>
          );
        }

        const driftX = (pseudoRandom(index) - 0.5) * 0.24;
        const driftY = (pseudoRandom(index + 23) - 0.5) * 0.18;
        const characterStyle: UnpixelatedTextStyle = {
          '--ces-unpixelate-delay': `${index * staggerMs}ms`,
          '--ces-unpixelate-duration': `${durationMs}ms`,
          '--ces-unpixelate-jitter-x': `${driftX.toFixed(3)}em`,
          '--ces-unpixelate-jitter-y': `${driftY.toFixed(3)}em`,
        };

        return (
          <span key={`${character}-${index}`} aria-hidden="true" className="ces-unpixelate-char" style={characterStyle}>
            <span className="ces-unpixelate-glyph">{character}</span>
            <span className="ces-unpixelate-mask" />
          </span>
        );
      })}
    </span>
  );
}
