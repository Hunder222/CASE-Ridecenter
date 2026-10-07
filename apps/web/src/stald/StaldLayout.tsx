import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router';
import type { SynkTilstand } from '@ridecenter/contracts';
import { SynkIndikator } from '../faelles/ui/SynkIndikator';
import { db } from '../offline/dexie-db';
import { syncMotor } from '../offline/sync-motor';

const INAKTIVITET_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutter

export const StaldLayout: React.FC = () => {
  const [brugerNavn, setBrugerNavn] = useState<string>('Stald');
  const [synkTilstand, setSynkTilstand] = useState<SynkTilstand>('online');
  const [ventendeAntal, setVentendeAntal] = useState<number>(0);
  const [advarsler, setAdvarsler] = useState<string[]>([]);
  const navigate = useNavigate();

  // Hent aktiv session
  useEffect(() => {
    const hentSession = async () => {
      const sessionPost = await db.meta.get('aktiv_session');
      if (sessionPost?.vaerdi?.navn) {
        setBrugerNavn(sessionPost.vaerdi.navn);
      }
    };
    hentSession();
  }, []);

  // Lyt til sync-motor
  useEffect(() => {
    const afmeld = syncMotor.tilfoejLytter((tilstand, antal, adv) => {
      setSynkTilstand(tilstand);
      setVentendeAntal(antal);
      setAdvarsler(adv);
    });
    return () => afmeld();
  }, []);

  // Automatisk inaktivitetslås efter 5 minutter
  useEffect(() => {
    let timer: any = null;

    const nulstilTimer = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        await laasSkærm();
      }, INAKTIVITET_TIMEOUT_MS);
    };

    const aktivitetsHaendelser = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    for (const h of aktivitetsHaendelser) {
      window.addEventListener(h, nulstilTimer, { passive: true });
    }

    nulstilTimer();

    return () => {
      if (timer) clearTimeout(timer);
      for (const h of aktivitetsHaendelser) {
        window.removeEventListener(h, nulstilTimer);
      }
    };
  }, []);

  const laasSkærm = async () => {
    await db.meta.delete('aktiv_session');
    navigate('/stald/laas');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Fast topbar på stald-tabletten */}
      <header className="sticky top-0 z-40 bg-slate-900/95 border-b border-slate-800 px-4 py-3 flex items-center justify-between backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold tracking-tight text-white">Bøgegården Stald</span>
          <SynkIndikator
            tilstand={synkTilstand}
            ventendeAntal={ventendeAntal}
            advarsler={advarsler}
            onClick={() => syncMotor.syncNu()}
          />
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => navigate('/stald/heste')}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs sm:text-sm font-medium text-slate-200 border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
          >
            🐎 Heste
          </button>
          <span className="text-sm font-medium text-slate-300 hidden md:inline">
            {brugerNavn}
          </span>
          <button
            type="button"
            onClick={laasSkærm}
            className="px-4 py-2 min-h-[44px] rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-650 text-sm font-medium text-slate-200 border border-slate-700 transition flex items-center gap-2 cursor-pointer"
          >
            🔒 Lås
          </button>
        </div>
      </header>

      {/* Indhold */}
      <main className="flex-1 p-4 max-w-6xl w-full mx-auto">
        <Outlet />
      </main>
    </div>
  );
};

