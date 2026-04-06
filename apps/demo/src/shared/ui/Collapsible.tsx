import React, { useState } from 'react';

interface CollapsibleProps {
  title: string;
  defaultOpen: boolean;
  children: React.ReactNode;
}

export function Collapsible({ title, defaultOpen = true, children }: CollapsibleProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-dark-700 rounded">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-dark-300 hover:bg-dark-800 transition-colors"
      >
        <span>{title}</span>
        <span className="text-dark-500">{isOpen ? '▲' : '▼'}</span>
      </button>
      {isOpen && <div className="px-3 py-3 border-t border-dark-700">{children}</div>}
    </div>
  );
}
