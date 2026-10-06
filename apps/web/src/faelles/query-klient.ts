import { QueryClient } from '@tanstack/react-query';
import { ApiFejl } from './api-klient';

export const queryKlient = new QueryClient({
  defaultOptions: {
    queries: {
      // 4xx-svar ændrer sig ikke ved at prøve igen.
      retry: (antalForsoeg, fejl) => !(fejl instanceof ApiFejl && fejl.status < 500) && antalForsoeg < 2,
      refetchOnWindowFocus: false,
    },
  },
});
