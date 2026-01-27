import React from 'react';
import { Card, RootInfo } from '@capacity-exchange/components';

export function RootInfoCard() {
  return (
    <Card className="app-card">
      <h2>Root Info</h2>
      <RootInfo>
        {({ error, info }) => {
          if (error) return <div>Error: {error}</div>;
          return (
            <div>
              <p>Name: {info?.name}</p>
              <p>Version: {info?.version}</p>
              {info?.env && (
                <div>
                  <h3>Environment:</h3>
                  <ul>
                    {Object.entries(info.env).map(([key, value]) => (
                      <li key={key}><strong>{key}:</strong> {value as any}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        }}
      </RootInfo>
    </Card>
  );
}
