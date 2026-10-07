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
  const [staldensHeste, setStaldensHeste] = useState<LokalHest[]>([]);
  const [dagsbelastningMap, setDagsbelastningMap] = useState<Record<string, number>>({});
  const [indlaeser, setIndlaeser] = useState(true);
  const [valgtForslag, setValgtForslag] = useState<Top3Forslag | null>(null);
  const [aarsag, setAarsag] = useState<'HestSyg' | 'HestSkadet' | 'Adfaerd' | 'Andet'>('HestSyg');
  const [fejl, setFejl] = useState<string | null>(null);
  const [gemmer, setGemmer] = useState(false);
  const [visAlleHeste, setVisAlleHeste] = useState(false);

  useEffect(() => {
    const beregnErstatninger = async () => {
      if (!id) return;
      setIndlaeser(true);
      try {
        let fundetPlads = await db.pladser.get(id);
        if (!fundetPlads) {
          setFejl('Lektionsplads blev ikke fundet lokalt');
          setIndlaeser(false);
          return;
        }

        // Hent lektion
        let lektion = fundetPlads.lektionId ? await db.lektioner.get(fundetPlads.lektionId) : null;
        const datoStr = lektion?.dato ?? new Date().toISOString().slice(0, 10);

        // Hvis godkendteHeste er tom eller mangler, forsøg at hente fra serveren
        if (!fundetPlads.godkendteHeste || fundetPlads.godkendteHeste.length === 0) {
          try {
            const enhedNoegle = localStorage.getItem('ridecenter_enhedsnoegle') ?? 'demo-enhedsnoegle-stald-tablet-1';
            const res = await fetch(`/api/v1/stald/dag/${datoStr}`, {
              headers: { 'X-Enhed-Noegle': enhedNoegle },
            });
            if (res.ok) {
              const dagData = await res.json();
              for (const l of dagData.lektioner ?? []) {
                const matchendePlads = l.pladser?.find((p: any) => p.id === id);
                if (matchendePlads?.godkendte_heste && matchendePlads.godkendte_heste.length > 0) {
                  fundetPlads.godkendteHeste = matchendePlads.godkendte_heste;
                  if (!fundetPlads.rytterNavnKort && matchendePlads.rytter_navn_kort) {
                    fundetPlads.rytterNavnKort = matchendePlads.rytter_navn_kort;
                  }
                  await db.pladser.put(fundetPlads);
                  break;
                }
              }
            }
          } catch {
            // offline, fortsæt med lokale data
          }
        }

        setPlads(fundetPlads);

        if (fundetPlads.aktuelHestId) {
          const hest = await db.heste.get(fundetPlads.aktuelHestId);
          if (hest) setNuvaerendeHest(hest);
        }

        // Hent alle heste og alle pladser for at beregne dagsbelastning
        let alleHeste = await db.heste.toArray();
        if (alleHeste.length === 0) {
          try {
            const hesteRes = await fetch('/api/v1/heste');
            if (hesteRes.ok) {
              const hData = await hesteRes.json();
              alleHeste = hData.map((h: any) => ({
                id: h.id,
                navn: h.navn,
                stangmaal_cm: h.stangmaal_cm,
                sundhedsstatus: h.sundhedsstatus,
                temperament: h.temperament,
                staldnoter: h.staldnoter ?? '',
                hviledag: h.hviledag,
                max_lektioner_dag: h.max_lektioner_dag,
              }));
              await db.heste.bulkPut(alleHeste);
            }
          } catch {}
        }
        setStaldensHeste(alleHeste);

        const allePladser = await db.pladser.toArray();

        // Beregn dagsbelastninger pr. hest
        const dagsbelastninger: Record<string, number> = {};
        for (const p of allePladser) {
          if (p.aktuelHestId) {
            dagsbelastninger[p.aktuelHestId] = (dagsbelastninger[p.aktuelHestId] ?? 0) + 1;
          }
        }
        setDagsbelastningMap(dagsbelastninger);

        // Hent lektionens ugedag (standard til i dag hvis ukendt)
        let lektionUgedag: Ugedag = (new Date().getDay() || 7) as Ugedag;
        if (lektion?.dato) {
          const d = new Date(lektion.dato);
          lektionUgedag = (d.getDay() || 7) as Ugedag;
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
        const godkendteListe = fundetPlads.godkendteHeste && fundetPlads.godkendteHeste.length > 0
          ? fundetPlads.godkendteHeste
          : alleHeste.filter((h) => h.sundhedsstatus === 'Aktiv').map((h) => h.id);

        const top3 = foreslaaErstatninger({
          plads: {
            rytterNavnKort: fundetPlads.rytterNavnKort,
            godkendteHeste: godkendteListe,
          },
          heste: domainHeste,
          dagsbelastninger,
          lektionUgedag,
        });

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

      // Opdater lokal plads i Dexie straks
      const opdateretPlads: LokalPlads = {
        ...plads,
        aktuelHestId: valgtForslag.hestId,
      };
      await db.pladser.put(opdateretPlads);

      // Naviger tilbage til lektionen
      if (plads.lektionId) {
        navigate(`/stald/lektion/${plads.lektionId}`);
      } else {
        navigate('/stald/i-dag');
      }
    } catch (err: any) {
      setFejl(err?.message ?? 'Fejl ved godkendelse af omplacering');
    } finally {
      setGemmer(false);
    }
  };

  if (indlaeser) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-slate-400 font-medium animate-pulse">Beregner bedste erstatningsheste...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => (plads?.lektionId ? navigate(`/stald/lektion/${plads.lektionId}`) : navigate('/stald/i-dag'))}
          className="min-h-[48px] px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-medium flex items-center gap-2 border border-slate-700 cursor-pointer transition"
        >
          ← Tilbage til lektion
        </button>
        <button
          type="button"
          onClick={() => setVisAlleHeste(!visAlleHeste)}
          className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition cursor-pointer flex items-center gap-1.5 ${
            visAlleHeste
              ? 'bg-amber-600 text-white border-amber-500 shadow-sm'
              : 'bg-sky-950/80 text-sky-300 border-sky-800 hover:bg-sky-900/80'
          }`}
        >
          <span>⚡</span>
          <span>{visAlleHeste ? 'Vis kun forslag' : 'Akut erstatning (alle heste)'}</span>
        </button>
      </div>

      {/* Header & Elev/Hest info */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-lg">
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
              {plads?.godkendteHeste && plads.godkendteHeste.length > 0
                ? `${plads.godkendteHeste.length} heste matcher elevens fysiologi`
                : 'Viser alle kompatible aktive heste'}
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
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>🎯 Top-3 egnede erstatningsheste</span>
            <span className="text-xs font-normal text-slate-400">(Beregnet lynhurtigt uden GDPR-data)</span>
          </h2>
        </div>

        {forslag.length === 0 ? (
          <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-8 text-center text-slate-400 space-y-3">
            <p className="font-semibold text-slate-300">Ingen ledige forhåndsgodkendte heste fundet i top-3</p>
            <p className="text-sm">
              Alle godkendte heste for denne elev er enten sygemeldte, har nået dagens maksgrænse eller har hviledag.
            </p>
            <button
              type="button"
              onClick={() => setVisAlleHeste(true)}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-sm transition cursor-pointer shadow-md inline-flex items-center gap-2"
            >
              <span>⚡</span>
              <span>Vælg en anden aktiv hest manuelt (Akut omplacering)</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {forslag.map((kandidat, index) => (
              <div
                key={kandidat.hestId}
                className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-slate-700 transition shadow-md"
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
                  className="min-h-[52px] px-6 rounded-xl bg-sky-600 hover:bg-sky-500 active:bg-sky-650 text-white font-bold text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  Vælg {kandidat.navn}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Manuel akut hesteliste (vises hvis slået til eller hvis der er 0 forslag) */}
      {(visAlleHeste || forslag.length === 0) && (
        <div className="space-y-4 pt-4 border-t border-slate-800">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-amber-300 flex items-center gap-2">
              <span>⚡</span>
              <span>Manuel akut hestevælger (Staldens øvrige heste)</span>
            </h3>
            <span className="text-xs text-slate-400">Overstyrer forslag med logget begrundelse</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {staldensHeste
              .filter((h) => h.sundhedsstatus === 'Aktiv' && h.id !== nuvaerendeHest?.id)
              .map((hest) => {
                const belastning = dagsbelastningMap[hest.id] ?? 0;
                return (
                  <div
                    key={hest.id}
                    className="rounded-2xl bg-slate-900 border border-slate-800 p-4 flex flex-col justify-between gap-3 hover:border-slate-700 transition"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold text-white">{hest.navn}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                          {belastning} lekt. i dag
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        {hest.temperament ?? 'Rolig'} • {hest.stangmaal_cm} cm
                      </div>
                      {hest.staldnoter && (
                        <div className="text-xs text-slate-400 mt-2 italic bg-slate-950/60 p-2 rounded-lg border border-slate-800/60 line-clamp-2">
                          {hest.staldnoter}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setValgtForslag({
                          hestId: hest.id,
                          navn: hest.navn,
                          dagsbelastning: belastning,
                          temperament: (hest.temperament as any) ?? 'Rolig',
                          begrundelseTekst: 'Manuel akut omplacering af personale',
                        });
                      }}
                      className="min-h-[44px] px-3 rounded-xl bg-amber-600 hover:bg-amber-500 active:bg-amber-650 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md"
                    >
                      <span>⚡</span>
                      <span>Vælg {hest.navn}</span>
                    </button>
                  </div>
                );
              })}
          </div>
        </div>
      )}

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
              {plads?.rytterNavnKort} tildeles <strong>{valgtForslag.navn}</strong> som erstatningshest.
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
                    className={`min-h-[48px] rounded-xl text-xs font-medium border transition cursor-pointer ${
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
                className="flex-1 min-h-[52px] rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-medium text-sm border border-slate-700 cursor-pointer"
              >
                Annuller
              </button>
              <button
                type="button"
                onClick={haandterBekraeftOmplacering}
                disabled={gemmer}
                className="flex-1 min-h-[52px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md cursor-pointer"
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
