import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/space-mono/400.css';
import '@fontsource/space-mono/700.css';
import App from './App';
import './styles/index.css';

// Suppress noisy Effect version mismatch warnings from Midnight SDK
const origWarn = console.warn;
console.warn = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && args[0].includes('Executing an Effect versioned')) return;
  origWarn.apply(console, args);
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
