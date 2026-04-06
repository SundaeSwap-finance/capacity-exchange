import type { ReactNode } from 'react';
import { Collapsible, LabelValue, LoadingSpinner, Message } from '../../../shared/ui';

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
  fields: Field[];
  queryRow: ReactNode;
  modifyRow?: ReactNode;
  result?: Result | null;
  messages?: ReactNode;
}

function FieldsBox({ fields }: { fields: Field[] }) {
  return (
    <div className="p-3 bg-dark-800 rounded border border-dark-600 space-y-2 text-sm">
      {fields.map((field) => (
        <LabelValue key={field.label} label={field.label}>
          {field.value}
        </LabelValue>
      ))}
    </div>
  );
}

export function ContractPanel({
  title,
  isRunning,
  currentOperation,
  error,
  fields,
  queryRow,
  modifyRow,
  result,
  messages,
}: ContractPanelProps) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-dark-200">{title}</h4>

      <div className="flex flex-wrap gap-2 items-center">
        {queryRow}
        {result && (
          <span className="text-sm text-dark-400 ml-2">
            {result.label}: <span className="text-white font-mono text-lg">{result.value}</span>
          </span>
        )}
      </div>

      {modifyRow && <div className="flex flex-wrap gap-2 items-center">{modifyRow}</div>}

      {messages}
      {isRunning && currentOperation && <LoadingSpinner message={`${currentOperation}...`} showElapsed />}
      {error && <Message variant="error">{error}</Message>}
      <Collapsible title="Details" defaultOpen={false}>
        <FieldsBox fields={fields} />
      </Collapsible>
    </div>
  );
}
