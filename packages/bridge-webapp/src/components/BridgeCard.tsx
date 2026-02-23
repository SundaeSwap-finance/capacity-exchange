interface BridgeCardProps {
  title: string;
  description: string;
  children?: React.ReactNode;
}

export function BridgeCard({ title, description, children }: BridgeCardProps) {
  return (
    <div className="card">
      <h2 className="text-xl font-semibold text-dark-100 mb-2">{title}</h2>
      <p className="text-muted mb-4">{description}</p>
      {children}
    </div>
  );
}
