import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { db } from '../offline/dexie-db';

const HUSKET_VIKAR_NOEGLE = 'ridecenter_aktiv_vikar_idag';

interface HusketVikar {
  navn: string;
  dato: string;
}

interface VikarKandidat {
  id: string;
  navn: string;
  fast_vikar: boolean;
}

export const VikarSide: React.FC = () => {
  const [fuldeNavn, setFuldeNavn] = useState('');
  const [husketVikar, setHusketVikar] = useState<HusketVikar | null>(null);
  const [kandidater, setKandidater] = useState<VikarKandidat[]>([]);
  const [valgtKandidatId, setValgtKandidatId] = useState<string>('__ny__');
  const [erNavnLaast, setErNavnLaast] = useState(false);
  const [vikarkode, setVikarkode] = useState('');
  const [fejl, setFejl] = useState<string | null>(null);
  const [indsender, setIndsender] = useState(false);
  const navigate = useNavigate();

  // Hent registrerede kandidater fra API og tjek aktiv session i dag
  useEffect(() => {
    const indlaes = async () => {
      try {
        const idagsDato = new Date().toISOString().slice(0, 10);
        let gemtNavn: string | null = null;

        const gemt = localStorage.getItem(HUSKET_VIKAR_NOEGLE);
        if (gemt) {
          const parsed: HusketVikar = JSON.parse(gemt);
          if (parsed.dato === idagsDato && parsed.navn) {
            gemtNavn = parsed.navn;
            setHusketVikar(parsed);
          }
        } else {
          const aktivSession = await db.meta.get('aktiv_session');
          if (aktivSession?.vaerdi?.roller?.includes('Vikar') && aktivSession.vaerdi.navn) {
            const rentNavn = aktivSession.vaerdi.navn.replace(/\s*\(Vikar\)\s*$/, '').trim();
            gemtNavn = rentNavn;
            const h = { navn: rentNavn, dato: idagsDato };
            setHusketVikar(h);
            localStorage.setItem(HUSKET_VIKAR_NOEGLE, JSON.stringify(h));
          }
        }

        let enhedNoegle = localStorage.getItem('ridecenter_enhedsnoegle') || 'demo-enhedsnoegle-stald-tablet-1';
        const res = await fetch('/api/v1/auth/vikar/kandidater', {
          headers: { 'X-Enhed-Noegle': enhedNoegle },
        });

        let fundneKandidater: VikarKandidat[] = [];
        if (res.ok) {
          fundneKandidater = await res.json();
          setKandidater(fundneKandidater);
        }

        // Pre-select hvis vi har et gemt navn fra i dag
        if (gemtNavn) {
          const matchende = fundneKandidater.find(
            (k) => k.navn.toLowerCase() === gemtNavn!.toLowerCase(),
          );
          if (matchende) {
            setValgtKandidatId(matchende.id);
            setFuldeNavn(matchende.navn);
            setErNavnLaast(true);
            return;
          } else {
            setFuldeNavn(gemtNavn);
            setErNavnLaast(true);
            return;
          }
        }

        // Ellers hvis der findes en fast vikar, vælg den første som standard
        const fastVikar = fundneKandidater.find((k) => k.fast_vikar);
        if (fastVikar) {
          setValgtKandidatId(fastVikar.id);
          setFuldeNavn(fastVikar.navn);
          setErNavnLaast(true);
        }
      } catch {
        // Ignorer fejl
      }
    };
    indlaes();
  }, []);

  const skiftKandidat = (kandidatId: string) => {
    setValgtKandidatId(kandidatId);
    setVikarkode('');
    setFejl(null);

    if (kandidatId === '__ny__') {
      setFuldeNavn('');
      setErNavnLaast(false);
    } else {
      const match = kandidater.find((k) => k.id === kandidatId);
      if (match) {
        setFuldeNavn(match.navn);
        setErNavnLaast(true);
      }
    }
  };

  const skiftVikarBruger = () => {
    skiftKandidat('__ny__');
  };

  const tastCiffer = (ciffer: string) => {
    if (indsender) return;
    if (vikarkode.length < 6) {
      const nyKode = vikarkode + ciffer;
      setVikarkode(nyKode);
      setFejl(null);
    }
  };

  const sletSidste = () => {
    if (indsender) return;
    setVikarkode((tidligere) => tidligere.slice(0, -1));
    setFejl(null);
  };

  const nulstil = () => {
    if (indsender) return;
    setVikarkode('');
    setFejl(null);
  };

  const haandterLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setFejl(null);

    const renNavn = fuldeNavn.trim();
    if (renNavn.length < 3) {
      setFejl('Indtast venligst dit fulde navn øverst (mindst 3 tegn)');
      return;
    }

    const renKode = vikarkode.trim();
    if (!/^[0-9]{6}$/.test(renKode)) {
      setFejl('Vikarkoden skal være præcis 6 cifre');
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
      // Gem i localStorage så samme vikar let kan genvælges i dag
      const idagsDato = new Date().toISOString().slice(0, 10);
      localStorage.setItem(
        HUSKET_VIKAR_NOEGLE,
        JSON.stringify({ navn: renNavn, dato: idagsDato }),
      );

      // Gem session i Dexie meta til offline brug
      await db.meta.put({
        noegle: 'aktiv_session',
        vaerdi: {
          bruger_id: session.bruger_id,
          navn: session.navn,
          roller: session.roller,
        },
      });

      navigate('/stald/hold');
    } catch (err: any) {
      setFejl(err?.message ?? 'Der opstod en fejl ved vikar-login');
    } finally {
      setIndsender(false);
    }
  };

  const [visKandidatModal, setVisKandidatModal] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 select-none">
      <div className="w-full max-w-md flex flex-col items-center">
        {/* Top bar med stor, handskevenlig Tilbage-knap og heste-overskrift */}
        <div className="w-full flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={() => navigate('/stald/laas')}
            className="min-h-[48px] px-4 py-2.5 rounded-xl bg-slate-900 border-2 border-slate-700 hover:border-sky-500 hover:bg-slate-850 text-slate-200 font-bold text-sm flex items-center gap-2 cursor-pointer shadow-md active:scale-95 transition"
            title="Tilbage til almindeligt PIN-login"
          >
            <span className="text-base font-black">←</span>
            <span>Tilbage til PIN</span>
          </button>
          <div className="flex items-center gap-2 text-sky-400">
            <span className="text-2xl">🐎</span>
            <span className="text-base font-bold tracking-tight text-white">Vikar-overlevering</span>
          </div>
        </div>

        {/* 1. Vælg profil & Ny vikar - tabletvenlig modal knap */}
        <div className="w-full mb-3">
          <label className="text-xs font-bold text-sky-400 uppercase tracking-wider block mb-1 px-1">
            Vikar-profil
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setVisKandidatModal(true)}
              className="flex-1 min-h-[48px] px-4 rounded-xl bg-slate-900 border-2 border-slate-700 hover:border-sky-500 text-left text-sm font-bold text-white flex items-center justify-between cursor-pointer active:scale-98 transition shadow-sm"
            >
              <span className="truncate">
                {valgtKandidatId === '__ny__' ? '➕ Ny vikar / Indtast navn' : fuldeNavn || 'Vælg vikar...'}
              </span>
              <span className="text-slate-400 text-xs ml-2">▼ Vælg</span>
            </button>

            <button
              type="button"
              onClick={() => skiftKandidat('__ny__')}
              className={`min-h-[48px] px-3.5 rounded-xl border-2 font-bold text-xs flex items-center justify-center gap-1 transition active:scale-95 cursor-pointer whitespace-nowrap shadow-sm ${
                valgtKandidatId === '__ny__'
                  ? 'bg-sky-600 text-white border-sky-400 ring-2 ring-sky-500/50'
                  : 'bg-slate-900 text-slate-200 border-slate-700 hover:bg-slate-800 hover:border-slate-600'
              }`}
              title="Opret eller tast et nyt vikarnavn"
            >
              <span>➕</span>
              <span>Ny vikar</span>
            </button>
          </div>
        </div>

        {/* 2. Navnefelt (uden redundant 'skift vikar' knap) */}
        <div className="w-full mb-3">
          <label
            htmlFor="fulde-navn"
            className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1 px-1"
          >
            Aktiv vikar
          </label>
          <div className="relative w-full">
            <input
              id="fulde-navn"
              type="text"
              readOnly={erNavnLaast}
              value={fuldeNavn}
              onChange={(e) => !erNavnLaast && setFuldeNavn(e.target.value)}
              placeholder="Indtast dit fulde navn..."
              className={`w-full min-h-[48px] px-4 rounded-xl text-base text-center font-bold transition focus:outline-none ${
                erNavnLaast
                  ? 'bg-slate-900/60 border-2 border-sky-500/60 text-sky-200 cursor-not-allowed ring-1 ring-sky-500/30'
                  : 'bg-slate-900 border-2 border-slate-700 text-white placeholder-slate-500 focus:border-sky-500'
              }`}
            />
            {erNavnLaast && (
              <span
                className="absolute right-4 top-1/2 -translate-y-1/2 text-sky-400 text-base font-bold"
                title="Navn er låst til den valgte profil"
              >
                🔒
              </span>
            )}
          </div>
        </div>

        {/* 3. Prikker / ciffervisning for 6-cifret kode */}
        <div className="flex items-center justify-center gap-2.5 mb-3.5">
          {[0, 1, 2, 3, 4, 5].map((index) => {
            const udfyldt = vikarkode.length > index;
            const ciffer = vikarkode[index];
            return (
              <div
                key={index}
                className={`w-8 h-10 rounded-xl border-2 flex items-center justify-center font-mono font-bold text-base transition-all duration-150 ${
                  udfyldt
                    ? 'bg-sky-950 border-sky-400 text-sky-300 scale-105 shadow-md shadow-sky-500/20'
                    : 'border-slate-700 bg-slate-900 text-transparent'
                }`}
              >
                {udfyldt ? ciffer : '•'}
              </div>
            );
          })}
        </div>

        {/* Fejlbesked */}
        {fejl && (
          <div className="mb-3 p-2.5 bg-rose-950/60 border border-rose-800/80 rounded-xl text-rose-300 text-center text-xs font-medium w-full">
            {fejl}
          </div>
        )}

        {/* 4. Touch Numpad (kompakt men glove-friendly) */}
        <div className="grid grid-cols-3 gap-2.5 w-full mb-3.5">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((ciffer) => (
            <button
              key={ciffer}
              type="button"
              onClick={() => tastCiffer(ciffer.toString())}
              disabled={indsender}
              className="min-h-[56px] rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-slate-700 active:scale-95 text-white text-2xl font-semibold border border-slate-800 hover:border-slate-700 transition flex items-center justify-center shadow-md cursor-pointer disabled:opacity-50"
            >
              {ciffer}
            </button>
          ))}
          <button
            type="button"
            onClick={nulstil}
            disabled={indsender || vikarkode.length === 0}
            className="min-h-[56px] rounded-xl bg-slate-900/60 hover:bg-slate-900 active:bg-slate-800 active:scale-95 text-rose-400 text-xs font-bold border border-slate-800 hover:border-slate-700 transition flex items-center justify-center cursor-pointer disabled:opacity-30"
          >
            Slet alt
          </button>
          <button
            type="button"
            onClick={() => tastCiffer('0')}
            disabled={indsender}
            className="min-h-[56px] rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-slate-700 active:scale-95 text-white text-2xl font-semibold border border-slate-800 hover:border-slate-700 transition flex items-center justify-center shadow-md cursor-pointer disabled:opacity-50"
          >
            0
          </button>
          <button
            type="button"
            onClick={sletSidste}
            disabled={indsender || vikarkode.length === 0}
            className="min-h-[56px] rounded-xl bg-slate-900/60 hover:bg-slate-900 active:bg-slate-800 active:scale-95 text-slate-300 text-lg font-bold border border-slate-800 hover:border-slate-700 transition flex items-center justify-center cursor-pointer disabled:opacity-30"
            title="Slet sidste ciffer"
          >
            ⌫
          </button>
        </div>

        {/* 5. Log ind knap */}
        <button
          type="button"
          onClick={() => haandterLogin()}
          disabled={indsender || vikarkode.length !== 6 || fuldeNavn.trim().length < 3}
          className="w-full min-h-[50px] rounded-xl bg-sky-600 hover:bg-sky-500 active:bg-sky-700 disabled:opacity-40 disabled:hover:bg-sky-600 text-white font-bold text-base shadow-lg shadow-sky-950/50 transition flex items-center justify-center gap-2 cursor-pointer"
        >
          {indsender ? (
            <span>Logger ind...</span>
          ) : (
            <>
              <span>🔓</span>
              <span>Lås staldfladen op</span>
            </>
          )}
        </button>
      </div>

      {/* MODAL POPUP TIL VALG AF VIKAR (TOUCH OG HANDSKE-VENLIG) */}
      {visKandidatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs select-none">
          <div className="bg-slate-900 rounded-2xl shadow-2xl max-w-sm w-full border border-slate-700 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div>
                <h3 className="text-base font-bold text-white">Vælg vikar</h3>
                <p className="text-xs text-slate-400">Tryk på dit navn eller opret ny</p>
              </div>
              <button
                type="button"
                onClick={() => setVisKandidatModal(false)}
                className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 overflow-y-auto space-y-2 flex-1">
              <button
                type="button"
                onClick={() => {
                  skiftKandidat('__ny__');
                  setVisKandidatModal(false);
                }}
                className={`w-full min-h-[54px] p-3 rounded-xl border-2 text-left font-bold text-sm flex items-center justify-between cursor-pointer transition active:scale-98 ${
                  valgtKandidatId === '__ny__'
                    ? 'bg-sky-600 text-white border-sky-400'
                    : 'bg-slate-850 hover:bg-slate-800 border-slate-700 text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">➕</span>
                  <div>
                    <div>Ny vikar</div>
                    <div className="text-xs font-normal text-slate-400">Indtast selv dit fulde navn</div>
                  </div>
                </div>
                {valgtKandidatId === '__ny__' && <span>✓</span>}
              </button>

              {kandidater.map((k) => {
                const erValgt = valgtKandidatId === k.id;
                return (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => {
                      skiftKandidat(k.id);
                      setVisKandidatModal(false);
                    }}
                    className={`w-full min-h-[54px] p-3 rounded-xl border-2 text-left font-bold text-sm flex items-center justify-between cursor-pointer transition active:scale-98 ${
                      erValgt
                        ? 'bg-sky-600 text-white border-sky-400'
                        : 'bg-slate-850 hover:bg-slate-800 border-slate-700 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">👤</span>
                      <div>
                        <div>{k.navn}</div>
                        {k.fast_vikar && (
                          <div className="text-xs font-semibold text-sky-300">Fast tilknyttet vikar</div>
                        )}
                      </div>
                    </div>
                    {erValgt && <span>✓</span>}
                  </button>
                );
              })}
            </div>

            <div className="p-3 border-t border-slate-800 bg-slate-950 flex justify-end">
              <button
                type="button"
                onClick={() => setVisKandidatModal(false)}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Luk
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

