import React from 'react';
import { Badge, Card, HealthCheck } from '../lib/components';

export function HealthCheckCard() {
  return (
    <Card className="app-card">
      <h2>Health Check</h2>
      <HealthCheck>
        {({ error, status, uptime }) => {
          if (error) return <div>Error: {error}</div>;
          return (
            <div>
              <p>Status: <Badge className={`app-badge ${status === 'ok' ? 'app-badge-ok' : 'app-badge-fail'}`}>{status}</Badge></p>
              <p>Uptime: {uptime}</p>
            </div>
          );
        }}
      </HealthCheck>
    </Card>
  );
}
