import React from 'react';
import { HealthCheckCard, ReadyCheckCard, RootInfoCard, PricesCard, OffersCard } from './components';

function App() {
  return (
    <div>
      <h1>Capacity Exchange SDK</h1>
      <div className="space-y-8">
        <PricesCard />
        <OffersCard />
        <HealthCheckCard />
        <ReadyCheckCard />
        <RootInfoCard />
      </div>
    </div>
  );
}

export default App;
