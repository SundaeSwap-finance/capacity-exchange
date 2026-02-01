export function DeploymentInfoBox() {
  return (
    <div className="p-3 bg-blue-900/20 border border-blue-700/50 rounded">
      <div className="flex gap-2">
        <span className="text-blue-400">ℹ</span>
        <p className="text-blue-300 text-sm">
          Contracts are deployed from the server wallet configured via the{' '}
          <code className="bg-blue-900/40 px-1 rounded">WALLET_SEED_FILE</code> environment variable.
        </p>
      </div>
    </div>
  );
}
