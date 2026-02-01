import { Collapsible } from '../../shared/ui/Collapsible';
import { DeploymentInfoBox } from './DeploymentInfoBox';
import { CounterDeployPanel } from './CounterDeployPanel';
import { TokenMintDeployPanel } from './TokenMintDeployPanel';

export function ContractDeploymentSection() {
  return (
    <Collapsible title="Contract Deployment" defaultOpen>
      <div className="space-y-4">
        <DeploymentInfoBox />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TokenMintDeployPanel />
          <CounterDeployPanel />
        </div>
      </div>
    </Collapsible>
  );
}
