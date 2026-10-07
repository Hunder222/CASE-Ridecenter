import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { db } from '../offline/dexie-db';

export const VikarSide: React.FC = () => {
  const [vikarkode, setVikarkode] = useState('');
  const [fuldeNavn, setFuldeNavn] = useState('');
  const [fejl, setFejl] = useState<string | null>(null);
  const [indsender, setIndsender] = useState(false);
  const navigate = useNavigate();

  const haandterLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFejl(null);

    const renKode = vikarkode.trim();
    if (!/^[0-9]{6}$/.test(renKode)) {
      setFejl('Vikarkoden skal være præcis 6 cifre');
      return;
    }

    const renNavn = fuldeNavn.trim();
    if (renNavn.length < 3) {
      setFejl('Angiv venligst dit fulde navn (mindst 3 tegn)');
      return;
    }

    setIndsender(true);
    try {
      let enhedNoegle = localStorage.getItem('ridecenter_enhedsnoegle');
      if (!enhedNoegle) {
        enhedNoegle = 'demo-enhedsnoegle-stald-tablet-1';
        localStorage.setItem('ridecenter_enhedsnoegle', enhedNoegle);
      }
      const res = await fetch('/api/v1/auth/vikar/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Enhed-Noegle': enhedNoegle,
        },
        body: JSON.stringify({
          vikarkode: renKode,
          fulde_navn: renNavn,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.besked ?? 'Ugyldig eller udløbet vikarkode');
      }

      const session = await res.json();
      // Gem session i Dexie meta til offline brug
      await db.meta.put({
        noegle: 'aktiv_session',
        vaerdi: {
          bruger_id: session.bruger_id,
          navn: session.navn,
          roller: session.roller,
        },
      });

      // Naviger til staldhold
      navigate('/stald/hold');
    } catch (err: any) {
      setFejl(err?.message ?? 'Der opstod en fejl ved vikar-login');
    } finally {
      setIndsender(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-sky-950 border border-sky-800 text-sky-400 flex items-center justify-center text-xl font-bold">
            🐎
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Vikar-overlevering</h1>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            Log ind med din 6-cifrede engangskode for at tilgå dagens hold og holdets Cheat Sheet.
          </p>
        </div>

        {fejl && (
          <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-800 text-xs text-rose-300">
            {fejl}
          </div>
        )}

        <form onSubmit={haandterLogin} className="space-y-4">
          <div>
            <label htmlFor="vikarkode" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              6-cifret vikarkode
            </label>
            <input
              id="vikarkode"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={vikarkode}
              onChange={(e) => setVikarkode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              className="w-full min-h-[56px] text-center text-2xl tracking-[0.3em] font-mono rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500 font-bold"
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="fulde-navn" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Dit fulde navn
            </label>
            <input
              id="fulde-navn"
              type="text"
              value={fuldeNavn}
              onChange={(e) => setFuldeNavn(e.target.value)}
              placeholder="F.eks. Sofie Vikar"
              className="w-full min-h-[56px] px-4 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm font-medium"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={indsender}
              className="w-full min-h-[56px] rounded-xl bg-sky-600 hover:bg-sky-500 active:bg-sky-650 text-white font-bold text-base shadow-lg shadow-sky-950/50 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              {indsender ? 'Logger ind...' : 'Lås staldfladen op'}
            </button>
          </div>
        </form>

        <div className="pt-4 border-t border-slate-800 text-center">
          <button
            type="button"
            onClick={() => navigate('/stald/laas')}
            className="text-xs text-slate-400 hover:text-slate-300 font-medium underline cursor-pointer"
          >
            ← Tilbage til PIN-login
          </button>
        </div>
      </div>
    </div>
  );
};

