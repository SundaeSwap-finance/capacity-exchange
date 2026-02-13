import React from 'react';

export function Copyable({ text }: { text: string }) {
  return (
    <code
      className="bg-black/30 px-1 rounded cursor-pointer hover:bg-black/50 transition-colors break-all"
      title="Click to copy"
      onClick={() => navigator.clipboard.writeText(text)}
    >
      {text}
    </code>
  );
}
