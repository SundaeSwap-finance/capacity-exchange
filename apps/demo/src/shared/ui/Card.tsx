import React from 'react';

interface CardProps {
  children: React.ReactNode;
  title?: string;
}

export function Card({ children, title }: CardProps) {
  return (
    <div className="border rounded-lg p-6 space-y-4">
      {title && <h2 className="text-2xl font-bold">{title}</h2>}
      {children}
    </div>
  );
}
