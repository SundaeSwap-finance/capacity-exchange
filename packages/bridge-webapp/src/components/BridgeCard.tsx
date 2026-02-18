interface BridgeCardProps {
  title: string;
  description: string;
}

export function BridgeCard({ title, description }: BridgeCardProps) {
  return (
    <div className="card">
      <h2 className="text-xl font-semibold text-dark-100 mb-2">{title}</h2>
      <p className="text-muted">{description}</p>
    </div>
  );
}
