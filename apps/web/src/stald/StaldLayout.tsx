import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
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
  const [roller, setRoller] = useState<string[]>([]);
  const navigate = useNavigate();
  const location = useLocation();

  const erVikar = roller.includes('Vikar');

  const erHoldSide =
    location.pathname === '/stald' ||
    location.pathname.startsWith('/stald/i-dag') ||
    location.pathname.startsWith('/stald/hold') ||
    location.pathname.startsWith('/stald/lektion');
  const erOenskerSide = location.pathname.startsWith('/stald/oensker');
  const erHesteSide = location.pathname.startsWith('/stald/heste');

  // Hent aktiv session og afvis uautoriseret adgang
  useEffect(() => {
    const hentSession = async () => {
      const sessionPost = await db.meta.get('aktiv_session');
      if (sessionPost?.vaerdi?.navn) {
        setBrugerNavn(sessionPost.vaerdi.navn);
        const sesRoller: string[] = sessionPost.vaerdi.roller ?? [];
        setRoller(sesRoller);

        // Hvis vikaren forsøger at tilgå ønsker eller heste, send til i-dag
        if (sesRoller.includes('Vikar')) {
          if (
            location.pathname.startsWith('/stald/oensker') ||
            location.pathname.startsWith('/stald/heste')
          ) {
            navigate('/stald/i-dag', { replace: true });
          }
        }
      } else {
        navigate('/stald/laas', { replace: true });
      }
    };
    hentSession();
  }, [navigate, location.pathname]);

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
            onClick={() => navigate('/stald/i-dag')}
            className={`px-3 py-1.5 min-h-[44px] rounded-xl text-xs sm:text-sm font-semibold border transition flex items-center gap-1.5 cursor-pointer ${
              erHoldSide
                ? 'bg-sky-600 text-white border-sky-400 shadow-md shadow-sky-950/50'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
          >
            📅 Dagens hold
          </button>
          {!erVikar && (
            <>
              <button
                type="button"
                onClick={() => navigate('/stald/oensker')}
                className={`px-3 py-1.5 min-h-[44px] rounded-xl text-xs sm:text-sm font-semibold border transition flex items-center gap-1.5 cursor-pointer ${
                  erOenskerSide
                    ? 'bg-sky-600 text-white border-sky-400 shadow-md shadow-sky-950/50'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                }`}
              >
                ⭐ Elevønsker
              </button>
              <button
                type="button"
                onClick={() => navigate('/stald/heste')}
                className={`px-3 py-1.5 min-h-[44px] rounded-xl text-xs sm:text-sm font-semibold border transition flex items-center gap-1.5 cursor-pointer ${
                  erHesteSide
                    ? 'bg-sky-600 text-white border-sky-400 shadow-md shadow-sky-950/50'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                }`}
              >
                🐎 Heste
              </button>
            </>
          )}
          <span className="text-sm font-medium text-slate-300 hidden md:inline ml-1">
            {brugerNavn}
          </span>
          <button
            type="button"
            onClick={laasSkærm}
            className="px-3.5 py-1.5 min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-650 text-xs sm:text-sm font-medium text-slate-300 border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
            title="Lås tablet"
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

