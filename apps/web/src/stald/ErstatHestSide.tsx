import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { foreslaaErstatninger, type Top3Forslag, type Ugedag } from '@ridecenter/domain';
import { db, type LokalHest, type LokalPlads } from '../offline/dexie-db';
import { gemGodkendOmplacering } from '../offline/omplacering-sync';

export const ErstatHestSide: React.FC = () => {
  const { id } = useParams<{ id: string }>(); // lektionsplads_id
  const navigate = useNavigate();

  const [plads, setPlads] = useState<LokalPlads | null>(null);
  const [nuvaerendeHest, setNuvaerendeHest] = useState<LokalHest | null>(null);
  const [forslag, setForslag] = useState<Top3Forslag[]>([]);
  const [indlaeser, setIndlaeser] = useState(true);
  const [valgtForslag, setValgtForslag] = useState<Top3Forslag | null>(null);
  const [aarsag, setAarsag] = useState<'HestSyg' | 'HestSkadet' | 'Adfaerd' | 'Andet'>('HestSyg');
  const [fejl, setFejl] = useState<string | null>(null);
  const [gemmer, setGemmer] = useState(false);

  useEffect(() => {
    const beregnErstatninger = async () => {
      if (!id) return;
      setIndlaeser(true);
      try {
        const fundetPlads = await db.pladser.get(id);
        if (!fundetPlads) {
          setFejl('Lektionsplads blev ikke fundet lokalt');
          setIndlaeser(false);
          return;
        }
        setPlads(fundetPlads);

        if (fundetPlads.aktuelHestId) {
          const hest = await db.heste.get(fundetPlads.aktuelHestId);
          if (hest) setNuvaerendeHest(hest);
        }

        // Hent alle heste og alle pladser for at beregne dagsbelastning
        const alleHeste = await db.heste.toArray();
        const allePladser = await db.pladser.toArray();

        // Beregn dagsbelastninger pr. hest
        const dagsbelastninger: Record<string, number> = {};
        for (const p of allePladser) {
          if (p.aktuelHestId) {
            dagsbelastninger[p.aktuelHestId] = (dagsbelastninger[p.aktuelHestId] ?? 0) + 1;
          }
        }

        // Hent lektionens ugedag (standard til i dag hvis ukendt)
        let lektionUgedag: Ugedag = (new Date().getDay() || 7) as Ugedag;
        if (fundetPlads.lektionId) {
          const lektion = await db.lektioner.get(fundetPlads.lektionId);
          if (lektion?.dato) {
            const d = new Date(lektion.dato);
            lektionUgedag = (d.getDay() || 7) as Ugedag;
          }
        }

        // Formatér hestedata til domænefunktion
        const domainHeste = alleHeste.map((h) => ({
          id: h.id,
          navn: h.navn,
          aktiv: h.sundhedsstatus !== 'Inaktiv',
          sundhedsstatus: (h.sundhedsstatus as any) ?? 'Aktiv',
          temperament: (h.temperament as any) ?? 'Rolig',
          stangmaalCm: h.stangmaal_cm ?? 145,
          maxVaegtKg: 75,
          maxLektionerDag: h.max_lektioner_dag ?? 3,
          maxLektionerUge: 15,
          skaane: false,
          hviledag: (h.hviledag ?? 1) as Ugedag,
        }));

        // Kør offline top-3 erstatningsberegning (< 200 ms)
        const t0 = performance.now();
        const top3 = foreslaaErstatninger({
          plads: {
            rytterNavnKort: fundetPlads.rytterNavnKort,
            godkendteHeste: fundetPlads.godkendteHeste ?? [],
          },
          heste: domainHeste,
          dagsbelastninger,
          lektionUgedag,
        });
        const varighed = performance.now() - t0;
        console.info(`Top-3 erstatning beregnet på ${varighed.toFixed(1)} ms`);

        setForslag(top3);
      } catch (err: any) {
        setFejl(err?.message ?? 'Fejl ved beregning af hesteerstatning');
      } finally {
        setIndlaeser(false);
      }
    };

    beregnErstatninger();
  }, [id]);

  const haandterBekraeftOmplacering = async () => {
    if (!plads || !valgtForslag) return;
    setGemmer(true);
    setFejl(null);
    try {
      await gemGodkendOmplacering({
        lektionspladsId: plads.id,
        tilHestId: valgtForslag.hestId,
        aarsag,
        forslagSnapshot: {
          forslag,
          valgt: valgtForslag,
        },
      });

      // Naviger tilbage til lektionen
      navigate(`/stald/lektion/${plads.lektionId}`);
    } catch (err: any) {
      setFejl(err?.message ?? 'Fejl ved godkendelse af omplacering');
    } finally {
      setGemmer(false);
    }
  };

  if (indlaeser) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="text-slate-400 font-medium">Beregner godkendte erstatninger...</div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Topnavigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => (plads?.lektionId ? navigate(`/stald/lektion/${plads.lektionId}`) : navigate('/stald/hold'))}
          className="min-h-[48px] px-4 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-slate-300 font-medium flex items-center gap-2 border border-slate-700"
        >
          ← Tilbage til lektion
        </button>
        <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-sky-950/80 text-sky-300 border border-sky-800">
          ⚡ Akut erstatning
        </span>
      </div>

      {/* Header & Elev/Hest info */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
        <div>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Elev</span>
          <h1 className="text-2xl font-bold text-white">{plads?.rytterNavnKort ?? 'Ukendt rytter'}</h1>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
          <div>
            <span className="text-xs text-slate-400">Nuværende hest</span>
            <div className="text-base font-semibold text-rose-300 flex items-center gap-2 mt-0.5">
              <span>🚫 {nuvaerendeHest?.navn ?? 'Ingen'}</span>
              {nuvaerendeHest?.sundhedsstatus && (
                <span className="text-xs px-2 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-900">
                  {nuvaerendeHest.sundhedsstatus}
                </span>
              )}
            </div>
          </div>
          <div>
            <span className="text-xs text-slate-400">Forhåndsgodkendte heste</span>
            <div className="text-sm font-medium text-slate-300 mt-0.5">
              {plads?.godkendteHeste?.length ?? 0} heste matcher elevens fysiologi
            </div>
          </div>
        </div>
      </div>

      {fejl && (
        <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-800 text-sm text-rose-300">
          {fejl}
        </div>
      )}

      {/* Top-3 Erstatningsforslag */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <span>🎯 Top-3 egnede erstatningsheste</span>
          <span className="text-xs font-normal text-slate-400">(Beregnet lynhurtigt uden GDPR-data)</span>
        </h2>

        {forslag.length === 0 ? (
          <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-8 text-center text-slate-400">
            <p className="font-semibold text-slate-300">Ingen ledige godkendte erstatningsheste fundet</p>
            <p className="text-sm mt-1">
              Alle forhåndsgodkendte heste for denne elev er enten sygemeldte, har nået dagens maksgrænse eller har hviledag.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {forslag.map((kandidat, index) => (
              <div
                key={kandidat.hestId}
                className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-slate-700 transition"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-full bg-sky-950 text-sky-400 border border-sky-800 text-xs font-bold flex items-center justify-center">
                      #{index + 1}
                    </span>
                    <h3 className="text-xl font-bold text-white">{kandidat.navn}</h3>
                    <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      {kandidat.temperament}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 pl-10">
                    {kandidat.begrundelseTekst} • Dagsbelastning: {kandidat.dagsbelastning} lekt.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setValgtForslag(kandidat)}
                  className="min-h-[56px] px-6 rounded-xl bg-sky-600 hover:bg-sky-500 active:bg-sky-650 text-white font-bold text-sm shadow-md transition flex items-center justify-center gap-2"
                >
                  Vælg {kandidat.navn}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bekræftelsesmodal for omplacering */}
      {valgtForslag && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-100 space-y-5">
            <h2 className="text-xl font-bold text-white">
              Bekræft omplacering til {valgtForslag.navn}
            </h2>
            <p className="text-sm text-slate-300">
              {plads?.rytterNavnKort} tildeles <strong>{valgtForslag.navn}</strong> som akut erstatning.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Årsag til omplacering
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { id: 'HestSyg', label: '🤒 Hest syg' },
                    { id: 'HestSkadet', label: '🩹 Hest skadet' },
                    { id: 'Adfaerd', label: '🐎 Adfærd' },
                    { id: 'Andet', label: '❓ Andet' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setAarsag(item.id)}
                    className={`min-h-[48px] rounded-xl text-xs font-medium border transition ${
                      aarsag === item.id
                        ? 'bg-sky-600 text-white border-sky-500'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setValgtForslag(null)}
                disabled={gemmer}
                className="flex-1 min-h-[56px] rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-medium text-sm border border-slate-700"
              >
                Annuller
              </button>
              <button
                type="button"
                onClick={haandterBekraeftOmplacering}
                disabled={gemmer}
                className="flex-1 min-h-[56px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md"
              >
                {gemmer ? 'Gemmer...' : 'Godkend omplacering'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

