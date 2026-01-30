import React, { useState } from 'react';
import { Card, Prices } from '../lib/components';

export function PricesCard() {
  const [dust, setDust] = useState('1000');

  return (
    <Card className="app-card">
      <h2>Prices</h2>
      <div>
        <label>Dust:</label>
        <input type="text" value={dust} onChange={(e) => setDust(e.target.value)} />
      </div>
      <Prices dust={dust}>
        {({ error, prices }) => {
          if (error) return <div>Error: {error}</div>;
          if (!prices) return <div>No price data</div>;
          return (
            <ul>
              {prices.prices?.map((price, i) => (
                <li key={i}>{price.amount} @ {price.currency}</li>
              ))}
            </ul>
          );
        }}
      </Prices>
    </Card>
  );
}
