import { registerSW } from 'virtual:pwa-register';

export function initialiserPWA() {
  const updateSW = registerSW({
    onNeedRefresh() {
      // Auto-update SW ved refresh
      updateSW(true);
    },
    onOfflineReady() {
      console.log('Stald-appen er klar til offline brug');
    },
  });
}

