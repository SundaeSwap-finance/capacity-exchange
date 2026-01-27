import React, { useState } from 'react';
import { Card, Offers } from '@capacity-exchange/components';

export function OffersCard() {
  const [offerAmount, setOfferAmount] = useState('100');
  const [offerCurrency, setOfferCurrency] = useState('lovelace');

  return (
    <Card className="app-card">
      <h2>Offers</h2>
      <Offers>
        {({ submit, submitting, data, error }) => (
          <div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              await submit({
                apiOffersPostRequest: {
                  requestAmount: offerAmount,
                  offerCurrency: offerCurrency,
                }
              });
            }}>
              <div>
                <label>Amount:</label>
                <input type="text" value={offerAmount} onChange={(e) => setOfferAmount(e.target.value)} />
              </div>
              <div>
                <label>Offer Currency:</label>
                <input type="text" value={offerCurrency} onChange={(e) => setOfferCurrency(e.target.value)} />
              </div>
              <button type="submit" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Offer'}
              </button>
            </form>
            {error && <div>Error: {error}</div>}
            {data && <div>Offer submitted</div>}
          </div>
        )}
      </Offers>
    </Card>
  );
}
