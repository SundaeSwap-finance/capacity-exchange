import React from 'react';
import { InfoRow } from '../../../shared/ui';

interface AddressListProps {
  unshieldedAddress: string;
  shieldedAddress: string;
  dustAddress: string;
}

export function AddressList({ unshieldedAddress, shieldedAddress, dustAddress }: AddressListProps) {
  return (
    <div className="space-y-2 text-sm">
      <InfoRow label="Unshielded Address" value={unshieldedAddress} />
      <InfoRow label="Shielded Address" value={shieldedAddress} />
      <InfoRow label="Dust Address" value={dustAddress} />
    </div>
  );
}
