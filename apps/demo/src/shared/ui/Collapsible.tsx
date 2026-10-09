import React, { useState } from 'react';

interface CollapsibleProps {
  title: string;
  defaultOpen: boolean;
  children: React.ReactNode;
}

export function Collapsible({ title, defaultOpen = true, children }: CollapsibleProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border rounded-sm">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium transition-colors"
      >
        <span>{title}</span>
        <span>{isOpen ? '▲' : '▼'}</span>
      </button>
      {isOpen && <div className="px-3 py-3 border-t">{children}</div>}
    </div>
  );
}
