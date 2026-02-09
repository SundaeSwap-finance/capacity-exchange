import React from 'react';
import { LabelValue } from '../../../shared/ui';

interface AddressListProps {
  unshieldedAddress: string;
  shieldedAddress: string;
  dustAddress: string;
}

export function AddressList({ unshieldedAddress, shieldedAddress, dustAddress }: AddressListProps) {
  return (
    <div className="space-y-2 text-sm">
      <LabelValue layout="inline" label="Unshielded Address">
        {unshieldedAddress}
      </LabelValue>
      <LabelValue layout="inline" label="Shielded Address">
        {shieldedAddress}
      </LabelValue>
      <LabelValue layout="inline" label="Dust Address">
        {dustAddress}
      </LabelValue>
    </div>
  );
}
