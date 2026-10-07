import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { CheatSheetKort } from '@ridecenter/contracts';
import { db, type LokalLektion } from '../offline/dexie-db';

export const CheatSheetSide: React.FC = () => {
  const { id } = useParams<{ id: string }>(); // lektion_id
  const navigate = useNavigate();

  const [lektion, setLektion] = useState<LokalLektion | null>(null);
  const [kortListe, setKortListe] = useState<CheatSheetKort[]>([]);
  const [indlaeser, setIndlaeser] = useState(true);
  const [fejl, setFejl] = useState<string | null>(null);

  useEffect(() => {
    const hentCheatSheet = async () => {
      if (!id) return;
      setIndlaeser(true);
      try {
        // Hent lektion fra Dexie
        const l = await db.lektioner.get(id);
        if (l) setLektion(l);

        // Hent Cheat Sheet data fra API
        // Dette endpoint returnerer KUN dataminimerede kort (ingen CPR, højde/vægt, Art. 9 diagnoser)
        const res = await fetch(`/api/v1/lektioner/${id}/cheat-sheet`);
        if (res.ok) {
          const data: CheatSheetKort[] = await res.json();
          setKortListe(data);
        } else {
          // Offline fallback: dan kort fra lokale pladser og heste
          const pladser = await db.pladser.where('lektionId').equals(id).toArray();
          const heste = await db.heste.toArray();
          const hesteMap = new Map(heste.map((h) => [h.id, h.navn]));

          const offlineKort: CheatSheetKort[] = pladser.map((p) => ({
            plads_id: p.id,
            rytter_navn_kort: p.rytterNavnKort ?? 'Rytter',
            hest_navn: p.aktuelHestId ? hesteMap.get(p.aktuelHestId) ?? 'Ukendt hest' : null,
            cheat_sheet_koder: p.cheatSheetKoder ?? [],
            adfaerdsinstruks: p.adfaerdsinstruks ?? null,
          }));
          setKortListe(offlineKort);
        }
      } catch (err: any) {
        setFejl(err?.message ?? 'Fejl ved indlæsning af Cheat Sheet');
      } finally {
        setIndlaeser(false);
      }
    };

    hentCheatSheet();
  }, [id]);

  const getKodeBadgeStyle = (kode: string) => {
    if (kode.includes('SKAANSOM') || kode.includes('TRAEK')) {
      return 'bg-amber-950/80 text-amber-300 border-amber-700/80';
    }
    if (kode.includes('AFSTAND') || kode.includes('RO')) {
      return 'bg-indigo-950/80 text-indigo-300 border-indigo-700/80';
    }
    if (kode.includes('OPSTIGNING') || kode.includes('HJELP')) {
      return 'bg-emerald-950/80 text-emerald-300 border-emerald-700/80';
    }
    return 'bg-slate-800 text-slate-300 border-slate-700';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Topnavigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate(`/stald/lektion/${id}`)}
          className="min-h-[48px] px-4 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-slate-300 font-medium flex items-center gap-2 border border-slate-700"
        >
          ← Tilbage til lektion
        </button>
        <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800 flex items-center gap-1.5">
          <span>🛡️</span> GDPR Art. 9 Sikret Cheat Sheet
        </span>
      </div>

      {/* Header */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6">
        <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">
          Lektions-overlevering &amp; Sikkerhed
        </div>
        <h1 className="text-2xl font-bold text-white">
          {lektion ? `${lektion.holdnavn} (Kl. ${lektion.starttid})` : 'Holdets Cheat Sheet'}
        </h1>
        <p className="text-xs text-slate-400 mt-2">
          Standardiserede adfærdskoder og pædagogiske instrukser. Ingen medicinske eller psykiatriske diagnoser jf. GDPR Art. 9.
        </p>
      </div>

      {fejl && (
        <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-800 text-sm text-rose-300">
          {fejl}
        </div>
      )}

      {indlaeser ? (
        <div className="flex items-center justify-center min-h-[200px] text-slate-400 font-medium">
          Henter anonymiserede instrukser...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {kortListe.map((kort) => {
            const harKoder = kort.cheat_sheet_koder && kort.cheat_sheet_koder.length > 0;
            const harInstruks = Boolean(kort.adfaerdsinstruks);

            return (
              <div
                key={kort.plads_id}
                className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 space-y-4 hover:border-slate-700 transition"
              >
                {/* Rytter og hest */}
                <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <div>
                    <h3 className="text-lg font-bold text-white">{kort.rytter_navn_kort}</h3>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Hest: <span className="font-semibold text-slate-300">{kort.hest_navn ?? 'Ingen'}</span>
                    </div>
                  </div>
                  {(!harKoder && !harInstruks) && (
                    <span className="text-xs font-medium px-2 py-1 rounded bg-slate-800 text-slate-400">
                      Standard
                    </span>
                  )}
                </div>

                {/* Standard koder som store badges */}
                {harKoder && (
                  <div>
                    <span className="text-xs font-semibold text-slate-400 block mb-2 uppercase tracking-wider">
                      Sikkerhedskoder
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {kort.cheat_sheet_koder.map((kode) => (
                        <span
                          key={kode}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border tracking-wide font-mono ${getKodeBadgeStyle(
                            kode
                          )}`}
                        >
                          {kode}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Anonymiseret pædagogisk instruks */}
                {harInstruks && (
                  <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/90">
                    <span className="text-xs font-semibold text-sky-400 block mb-1">
                      💡 Pædagogisk instruks
                    </span>
                    <p className="text-xs text-slate-200 leading-relaxed font-sans">
                      {kort.adfaerdsinstruks}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

