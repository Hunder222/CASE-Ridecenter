import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { queryKlient } from './faelles/query-klient';
import './index.css';

const rod = document.getElementById('root');
if (!rod) throw new Error('Elementet #root mangler i index.html');

createRoot(rod).render(
  <StrictMode>
    <QueryClientProvider client={queryKlient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
