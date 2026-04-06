interface NetworkBannerProps {
  networkId: string;
}

export function NetworkBanner({ networkId }: NetworkBannerProps) {
  return (
    <div className="sticky top-0 z-50 w-full bg-purple-900/40 border-b border-purple-700/50 px-4 py-2 flex items-center gap-2 backdrop-blur-sm">
      <span className="text-purple-300 text-sm font-medium">Network</span>
      <span className="text-white text-sm font-mono font-semibold">{networkId}</span>
    </div>
  );
}
