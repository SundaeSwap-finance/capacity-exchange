import { Offer } from '@capacity-exchange/providers';

export interface ConfirmOfferProps {
  offer: Offer;
  dustRequired: bigint;
  onConfirmed: () => void;
  onBack: () => void;
  onCancelled: () => void;
}

export function DefaultConfirmOffer({ offer, dustRequired, onConfirmed, onBack, onCancelled }: ConfirmOfferProps) {
  return (
    <div>
      <span>{dustRequired}</span>
      <span>{offer.offerCurrency}</span>
      <span>{offer.offerAmount}</span>
      <button onClick={onConfirmed}>Confirm</button>
      <button onClick={onBack}>Back</button>
      <button onClick={onCancelled}>Cancel</button>
    </div>
  );
}
