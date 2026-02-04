import React from 'react';

type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

interface TooltipProps {
  content: string;
  position?: TooltipPosition;
  children: React.ReactNode;
}

const positionStyles: Record<TooltipPosition, string> = {
  top: 'bottom-full mb-1 left-1/2 -translate-x-1/2',
  bottom: 'top-full mt-1 left-1/2 -translate-x-1/2',
  left: 'right-full mr-2 top-1/2 -translate-y-1/2',
  right: 'left-full ml-2 top-1/2 -translate-y-1/2',
};

export function Tooltip({ content, position = 'right', children }: TooltipProps) {
  return (
    <div className="relative group inline-block">
      {children}
      <div className={`absolute ${positionStyles[position]} hidden group-hover:block z-10 pointer-events-none`}>
        <div className="bg-dark-700 text-dark-200 text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">{content}</div>
      </div>
    </div>
  );
}
