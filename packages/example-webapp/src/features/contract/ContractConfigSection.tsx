import { Collapsible } from '../../shared/ui/Collapsible';
import { CounterContractPanel } from './CounterContractPanel';
import { TokenMintContractPanel } from './TokenMintContractPanel';

export function ContractConfigSection() {
  return (
    <Collapsible title="Contract Operations" defaultOpen={false}>
      <div className="space-y-6">
        <CounterContractPanel />

        <div className="border-t border-dark-700" />

        <TokenMintContractPanel />
      </div>
    </Collapsible>
  );
}
