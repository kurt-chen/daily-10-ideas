import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.js';
import { registerServiceWorker } from './pwa.js';
import './styles.css';

registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
