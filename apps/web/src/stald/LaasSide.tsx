import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { db } from '../offline/dexie-db';
import { hentLokalLockoutSekunder, validerLokalPin } from '../offline/lokal-pin';

export const LaasSide: React.FC = () => {
  const [pin, setPin] = useState('');
  const [fejlbesked, setFejlbesked] = useState('');
  const [lockoutSekunder, setLockoutSekunder] = useState(0);
  const [behandler, setBehandler] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const tjekLockout = () => {
      const sekunder = hentLokalLockoutSekunder();
      setLockoutSekunder(sekunder);
    };

    tjekLockout();
    const interval = setInterval(tjekLockout, 1000);
    return () => clearInterval(interval);
  }, []);

  const tastCiffer = (ciffer: string) => {
    if (lockoutSekunder > 0 || behandler) return;
    if (pin.length < 4) {
      const nyPin = pin + ciffer;
      setPin(nyPin);
      if (nyPin.length === 4) {
        bekraeftPin(nyPin);
      }
    }
  };

  const sletSidste = () => {
    if (lockoutSekunder > 0 || behandler) return;
    setPin((tidligere) => tidligere.slice(0, -1));
    setFejlbesked('');
  };

  const nulstil = () => {
    if (lockoutSekunder > 0 || behandler) return;
    setPin('');
    setFejlbesked('');
  };

  const bekraeftPin = async (indtastetPin: string) => {
    setBehandler(true);
    setFejlbesked('');

    try {
      // 1. Prøv først via API hvis vi er online (brug betroet demo-enhedsnøgle som fallback hvis ikke gemt i localStorage)
      let enhedNoegle = localStorage.getItem('ridecenter_enhedsnoegle');
      if (!enhedNoegle) {
        enhedNoegle = 'demo-enhedsnoegle-stald-tablet-1';
        localStorage.setItem('ridecenter_enhedsnoegle', enhedNoegle);
      }
      let apiSucces = false;

      if (navigator.onLine && enhedNoegle) {
        try {
          const res = await fetch('/api/v1/auth/pin', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Enhed-Noegle': enhedNoegle,
            },
            body: JSON.stringify({ pin: indtastetPin }),
          });

          if (res.ok) {
            apiSucces = true;
            const session = await res.json();
            await db.meta.put({
              noegle: 'aktiv_session',
              vaerdi: {
                brugerId: session.bruger_id,
                navn: session.navn,
                roller: session.roller,
                loggetIndTid: new Date().toISOString(),
              },
            });
            navigate('/stald/hold');
            return;
          } else if (res.status === 429) {
            const data = await res.json();
            setFejlbesked(data.besked ?? 'Enheden er låst. Prøv igen om 60 sekunder.');
            setLockoutSekunder(60);
            setPin('');
            return;
          }
        } catch {
          // Fallback til offline
        }
      }

      // 2. Offline fallback hvis netværk fejlede eller ikke svarede
      if (!apiSucces) {
        const resultat = await validerLokalPin(indtastetPin);
        if (resultat.succes) {
          navigate('/stald/hold');
          return;
        } else {
          setFejlbesked(resultat.fejlbesked ?? 'Forkert PIN-kode.');
          if (resultat.lockoutSekunder) {
            setLockoutSekunder(resultat.lockoutSekunder);
          }
          setPin('');
        }
      }
    } finally {
      setBehandler(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 select-none">
      <div className="w-full max-w-sm flex flex-col items-center">
        {/* Logo & Titel */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-2xl" role="img" aria-label="Hest">🐎</span>
            <h1 className="text-3xl font-bold tracking-tight text-white">Bøgegården Stald</h1>
          </div>
          <p className="text-slate-400 text-sm">Indtast 4-cifret PIN for at låse op</p>
        </div>

        {/* PIN prikker */}
        <div className="flex gap-4 mb-8">
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
              className={`w-5 h-5 rounded-full border-2 transition-all duration-200 ${
                pin.length > index
                  ? 'bg-blue-500 border-blue-400 scale-110 shadow-lg shadow-blue-500/50'
                  : 'border-slate-600 bg-slate-900'
              }`}
            />
          ))}
        </div>

        {/* Fejlbesked eller lockout countdown */}
        {lockoutSekunder > 0 ? (
          <div className="mb-6 p-3 bg-red-950/60 border border-red-700/60 rounded-xl text-red-300 text-center text-sm font-medium w-full">
            Låst pga. forkerte forsøg. Vent {lockoutSekunder} sekunder…
          </div>
        ) : fejlbesked ? (
          <div className="mb-6 p-3 bg-rose-950/50 border border-rose-800/50 rounded-xl text-rose-300 text-center text-sm font-medium w-full">
            {fejlbesked}
          </div>
        ) : null}

        {/* Numerisk tastatur med store touch-taster (min 56px, her 72px) */}
        <div className="grid grid-cols-3 gap-4 w-full mb-8">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((ciffer) => (
            <button
              key={ciffer}
              type="button"
              disabled={lockoutSekunder > 0 || behandler}
              onClick={() => tastCiffer(ciffer)}
              className="h-20 min-h-[56px] rounded-2xl bg-slate-900 border border-slate-800 text-3xl font-semibold text-white active:bg-slate-800 hover:bg-slate-850 active:scale-95 transition flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-slate-950"
            >
              {ciffer}
            </button>
          ))}
          <button
            type="button"
            disabled={lockoutSekunder > 0 || behandler}
            onClick={nulstil}
            className="h-20 min-h-[56px] rounded-2xl bg-slate-900/60 border border-slate-800/80 text-lg font-medium text-slate-400 active:bg-slate-800 hover:bg-slate-900 active:scale-95 transition flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Nulstil
          </button>
          <button
            type="button"
            disabled={lockoutSekunder > 0 || behandler}
            onClick={() => tastCiffer('0')}
            className="h-20 min-h-[56px] rounded-2xl bg-slate-900 border border-slate-800 text-3xl font-semibold text-white active:bg-slate-800 hover:bg-slate-850 active:scale-95 transition flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-slate-950"
          >
            0
          </button>
          <button
            type="button"
            disabled={lockoutSekunder > 0 || behandler || pin.length === 0}
            onClick={sletSidste}
            className="h-20 min-h-[56px] rounded-2xl bg-slate-900/60 border border-slate-800/80 text-2xl font-medium text-slate-400 active:bg-slate-800 hover:bg-slate-900 active:scale-95 transition flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ⌫
          </button>
        </div>

        {/* Vikar login link knap */}
        <button
          type="button"
          onClick={() => navigate('/stald/vikar')}
          className="w-full py-4 min-h-[56px] rounded-xl bg-slate-900/90 border border-slate-700/80 text-blue-400 font-medium text-base hover:bg-slate-800 active:scale-98 transition text-center cursor-pointer"
        >
          Jeg er vikar (6-cifret kode)
        </button>
      </div>
    </div>
  );
};

