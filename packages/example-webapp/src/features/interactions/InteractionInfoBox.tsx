export function InteractionInfoBox() {
  return (
    <div className="p-3 bg-blue-900/20 border border-blue-700/50 rounded">
      <div className="flex gap-2">
        <span className="text-blue-400">ℹ</span>
        <p className="text-blue-300 text-sm">
          These operations use <strong>your connected wallet</strong> to interact with deployed contracts.
        </p>
      </div>
    </div>
  );
}
