import React from 'react';
import { Badge, Card, ReadyCheck } from '../lib/components';

export function ReadyCheckCard() {
  return (
    <Card className="app-card">
      <h2>Ready Check</h2>
      <ReadyCheck>
        {({ error, readiness }) => {
          if (error) return <div>Error: {error}</div>;
          return (
            <div>
              <p>
                Status:{' '}
                <Badge className={`app-badge ${readiness?.status === 'ok' ? 'app-badge-ok' : 'app-badge-fail'}`}>
                  {readiness?.status}
                </Badge>
              </p>
              {readiness?.wallet && (
                <p>
                  Wallet:{' '}
                  <Badge
                    className={`app-badge ${readiness.wallet.status === 'ok' ? 'app-badge-ok' : 'app-badge-fail'}`}
                  >
                    {readiness.wallet.status}
                  </Badge>
                </p>
              )}
              {readiness?.indexer && (
                <p>
                  Indexer:{' '}
                  <Badge
                    className={`app-badge ${readiness.indexer.status === 'ok' ? 'app-badge-ok' : 'app-badge-fail'}`}
                  >
                    {readiness.indexer.status}
                  </Badge>{' '}
                  (Height: {readiness.indexer.height})
                </p>
              )}
            </div>
          );
        }}
      </ReadyCheck>
    </Card>
  );
}
