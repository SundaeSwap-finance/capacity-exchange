import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/space-mono/400.css';
import '@fontsource/space-mono/700.css';
import App from './App';
import './styles/index.css';

// Suppress noisy Effect version mismatch warnings from Midnight SDK
for (const method of ['log', 'warn', 'info', 'debug', 'error'] as const) {
  const orig = console[method];
  console[method] = (...args: unknown[]) => {
    if (args.some((a) => typeof a === 'string' && a.includes('Executing an Effect versioned'))) {
      return;
    }
    orig.apply(console, args);
  };
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
