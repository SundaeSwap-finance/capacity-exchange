export function LogOutput({ logs, isRunning }: { logs: string; isRunning: boolean }) {
  if (!logs && !isRunning) {
    return null;
  }

  return (
    <div className="space-y-1">
      <div className="text-xs text-dark-400">{isRunning ? 'Live Output:' : 'Output:'}</div>
      <pre className="p-2 bg-dark-900 rounded text-dark-300 text-xs font-mono overflow-x-auto max-h-48 overflow-y-auto">
        {logs || 'Waiting for output...'}
      </pre>
    </div>
  );
}
