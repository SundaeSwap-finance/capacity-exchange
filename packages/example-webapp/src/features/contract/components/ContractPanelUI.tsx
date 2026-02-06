import type { ReactNode } from 'react';
import { LoadingSpinner, Message } from '../../../shared/ui';

interface Field {
  label: string;
  value: string;
}

interface Result {
  label: string;
  value: string | number;
}

interface ContractPanelProps {
  title: string;
  isRunning: boolean;
  currentOperation: string | null;
  error: string | null;
  logs: string;
  actions: ReactNode;
  fields: Field[];
  result?: Result | null;
}

function InfoBox({ fields, result }: { fields: Field[]; result?: Result | null }) {
  return (
    <div className="p-3 bg-dark-800 rounded border border-dark-600 space-y-2 text-sm">
      {fields.map((field) => (
        <div key={field.label}>
          <div className="text-xs text-dark-400">{field.label}</div>
          <div className="text-xs text-white break-all font-mono">{field.value}</div>
        </div>
      ))}
      {result && (
        <>
          <div className="border-t border-dark-700 my-2" />
          <div className="flex justify-between items-center">
            <span className="text-xs text-dark-400">{result.label}</span>
            <span className="text-lg text-white font-mono">{result.value}</span>
          </div>
        </>
      )}
    </div>
  );
}

function LogOutput({ logs, isRunning }: { logs: string; isRunning: boolean }) {
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

export function ContractPanel({
  title,
  isRunning,
  currentOperation,
  error,
  logs,
  actions,
  fields,
  result,
}: ContractPanelProps) {
  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-dark-200">{title}</h4>
      <div className="flex flex-wrap gap-2">{actions}</div>
      {isRunning && currentOperation && <LoadingSpinner message={`${currentOperation}...`} />}
      <InfoBox fields={fields} result={result} />
      {error && <Message variant="error">{error}</Message>}
      <LogOutput logs={logs} isRunning={isRunning} />
    </div>
  );
}
