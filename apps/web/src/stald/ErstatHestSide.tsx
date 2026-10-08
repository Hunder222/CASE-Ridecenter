import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { foreslaaErstatninger, type Top3Forslag, type Ugedag } from '@ridecenter/domain';
import { db, type LokalHest, type LokalLektion, type LokalPlads } from '../offline/dexie-db';
import { gemGodkendOmplacering } from '../offline/omplacering-sync';

interface ValgtErstatning extends Top3Forslag {
  erUegnet?: boolean;
  advarselstekst?: string;
}

export const ErstatHestSide: React.FC = () => {
  const { id } = useParams<{ id: string }>(); // lektionsplads_id
  const navigate = useNavigate();

  const [plads, setPlads] = useState<LokalPlads | null>(null);
  const [nuvaerendeHest, setNuvaerendeHest] = useState<LokalHest | null>(null);
  const [lektion, setLektion] = useState<LokalLektion | null>(null);
  const [lektionUgedag, setLektionUgedag] = useState<Ugedag>(1);
  const [forslag, setForslag] = useState<Top3Forslag[]>([]);
  const [staldensHeste, setStaldensHeste] = useState<LokalHest[]>([]);
  const [dagsbelastningMap, setDagsbelastningMap] = useState<Record<string, number>>({});
  const [optagedePaaLektion, setOptagedePaaLektion] = useState<Set<string>>(new Set());
  const [indlaeser, setIndlaeser] = useState(true);
  const [valgtForslag, setValgtForslag] = useState<ValgtErstatning | null>(null);
  const [aarsag, setAarsag] = useState<'HestSyg' | 'HestSkadet' | 'Adfaerd' | 'Andet'>('HestSyg');
  const [fejl, setFejl] = useState<string | null>(null);
  const [gemmer, setGemmer] = useState(false);
  const [visOevrigeEgnede, setVisOevrigeEgnede] = useState(false);
  const [visUegnede, setVisUegnede] = useState(false);
  const [erVikar, setErVikar] = useState(false);

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
        if (lektion) setLektion(lektion);
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

        // Hent aktiv session for at tjekke om brugeren er Vikar
        const sessionPost = await db.meta.get('aktiv_session');
        const vikarRolle = sessionPost?.vaerdi?.roller?.includes('Vikar') ?? false;
        setErVikar(vikarRolle);

        // Hent alle heste og alle pladser for at beregne dagsbelastning på lektionsdatoen
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

        // Find lektioner på samme dato for kun at beregne DAGS-belastning
        const sammeDagsLektioner = await db.lektioner.where('dato').equals(datoStr).toArray();
        const sammeDagsLektionIds = new Set(sammeDagsLektioner.map((l) => l.id));

        const allePladser = await db.pladser.toArray();

        // Beregn dagsbelastninger KUN for lektioner på samme dato
        const dagsbelastninger: Record<string, number> = {};
        for (const p of allePladser) {
          if (p.aktuelHestId && sammeDagsLektionIds.has(p.lektionId)) {
            dagsbelastninger[p.aktuelHestId] = (dagsbelastninger[p.aktuelHestId] ?? 0) + 1;
          }
        }
        setDagsbelastningMap(dagsbelastninger);

        // Hent lektionens ugedag (standard til i dag hvis ukendt)
        let lektionUgedagBeregnet: Ugedag = (new Date().getDay() || 7) as Ugedag;
        if (lektion?.dato) {
          const d = new Date(lektion.dato);
          lektionUgedagBeregnet = (d.getDay() || 7) as Ugedag;
        }
        setLektionUgedag(lektionUgedagBeregnet);

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

        // Find heste optaget på netop denne lektion af andre elever
        const optagedeLektionHeste = new Set<string>();
        for (const p of allePladser) {
          if (p.lektionId === fundetPlads.lektionId && p.id !== fundetPlads.id && p.aktuelHestId) {
            optagedeLektionHeste.add(p.aktuelHestId);
          }
        }
        setOptagedePaaLektion(optagedeLektionHeste);

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
          lektionUgedag: lektionUgedagBeregnet,
          optagedeHesteIds: Array.from(optagedeLektionHeste),
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

  const top3Ids = useMemo(() => new Set(forslag.map((f) => f.hestId)), [forslag]);
  const godkendteSet = useMemo(() => new Set(plads?.godkendteHeste ?? []), [plads?.godkendteHeste]);

  const oevrigeEgnede = useMemo(() => {
    return staldensHeste.filter((h) => {
      if (h.id === nuvaerendeHest?.id) return false;
      if (top3Ids.has(h.id)) return false;
      if (optagedePaaLektion.has(h.id)) return false;
      if (h.sundhedsstatus !== 'Aktiv') return false;
      if (h.hviledag === lektionUgedag) return false;
      const belastning = dagsbelastningMap[h.id] ?? 0;
      if (belastning >= (h.max_lektioner_dag ?? 3)) return false;
      if (godkendteSet.size > 0 && !godkendteSet.has(h.id)) return false;
      return true;
    });
  }, [staldensHeste, nuvaerendeHest, top3Ids, godkendteSet, lektionUgedag, dagsbelastningMap, optagedePaaLektion]);

  const uegnedeHeste = useMemo(() => {
    return staldensHeste.filter((h) => {
      if (h.id === nuvaerendeHest?.id) return false;
      if (top3Ids.has(h.id)) return false;
      const belastning = dagsbelastningMap[h.id] ?? 0;
      const erHviledag = h.hviledag === lektionUgedag;
      const erOverMax = belastning >= (h.max_lektioner_dag ?? 3);
      const erOptagetHer = optagedePaaLektion.has(h.id);
      const erGodkendtProfil = godkendteSet.size === 0 || godkendteSet.has(h.id);
      const erEgnet = h.sundhedsstatus === 'Aktiv' && !erHviledag && !erOverMax && !erOptagetHer && erGodkendtProfil;
      return !erEgnet;
    });
  }, [staldensHeste, nuvaerendeHest, top3Ids, godkendteSet, lektionUgedag, dagsbelastningMap, optagedePaaLektion]);

  const getUegnetAarsag = (hest: LokalHest, belastning: number): string => {
    if (optagedePaaLektion.has(hest.id)) {
      return 'Allerede optaget på denne lektion';
    }
    if (hest.sundhedsstatus && hest.sundhedsstatus !== 'Aktiv') {
      return `Sundhedsstatus: ${hest.sundhedsstatus}`;
    }
    if (hest.hviledag === lektionUgedag) {
      return 'Har hviledag i dag';
    }
    if (belastning >= (hest.max_lektioner_dag ?? 3)) {
      return `Maks dagsbelastning nået (${belastning}/${hest.max_lektioner_dag ?? 3} lekt.)`;
    }
    if (lektion?.niveau === 'Begynder' && hest.godkendt_til_begyndere === false) {
      return 'Ikke godkendt til begynderhold';
    }
    if (lektion?.niveau === 'Oevet' && hest.egnet_oevet === false) {
      return 'Ikke egnet til øvet hold';
    }
    if (godkendteSet.size > 0 && !godkendteSet.has(hest.id)) {
      return 'Ikke godkendt til rytterens profil (fysik/sikkerhed)';
    }
    return 'Uegnet ifølge tildelingsregler';
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
          <span>←</span>
          <span>Tilbage til lektion</span>
        </button>
        <span className="text-xs text-slate-400 font-mono">
          ID: {id?.slice(0, 8)} • {erVikar ? '🔒 Vikar-tilstand' : '🔑 Personale-tilstand'}
        </span>
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
            {erVikar && (
              <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl text-amber-300 text-xs font-medium max-w-md mx-auto">
                🔒 Som vikar kan du kun tildele forhåndsgodkendte heste. Kontakt fast underviser eller ledelse for omplacering af denne rytter.
              </div>
            )}
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
                    {kandidat.begrundelseTekst}
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

      {/* Udvidet hestevælger (KUN for fast personale / ridelærere, ALDRIG for vikarer) */}
      {!erVikar ? (
        <div className="space-y-4 pt-4 border-t border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-200">
                Udvidede valgmuligheder for personale
              </h3>
              <p className="text-xs text-slate-400">
                Ledere og ridelærere kan vælge andre egnede heste, samt uegnede i nødstilfælde
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setVisOevrigeEgnede(!visOevrigeEgnede)}
                className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                  visOevrigeEgnede
                    ? 'bg-sky-900/60 text-sky-200 border-sky-600 ring-1 ring-sky-500'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
                }`}
              >
                {visOevrigeEgnede ? 'Skjul øvrige egnede' : `Vis øvrige egnede (${oevrigeEgnede.length})`}
              </button>

              <button
                type="button"
                onClick={() => setVisUegnede(!visUegnede)}
                className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                  visUegnede
                    ? 'bg-rose-950/80 text-rose-200 border-rose-600 ring-1 ring-rose-500'
                    : 'bg-slate-800 text-rose-400 border-slate-700 hover:bg-slate-750'
                }`}
              >
                <span>⚠️</span>
                <span>{visUegnede ? 'Skjul uegnede' : `Uegnede i nødstilfælde (${uegnedeHeste.length})`}</span>
              </button>
            </div>
          </div>

          {/* Øvrige egnede heste liste */}
          {visOevrigeEgnede && (
            <div className="space-y-3 pt-2">
              <div className="text-xs font-bold text-sky-400 uppercase tracking-wider">
                Øvrige godkendte & egnede heste ({oevrigeEgnede.length})
              </div>
              {oevrigeEgnede.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-xs text-slate-400 italic">
                  Ingen andre godkendte egnede heste til rådighed i stalden lige nu.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {oevrigeEgnede.map((hest) => {
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
                              begrundelseTekst: 'Manuelt valgt øvrig egnet hest af personale',
                            });
                          }}
                          className="min-h-[44px] px-3 rounded-xl bg-sky-700 hover:bg-sky-600 active:bg-sky-750 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md"
                        >
                          <span>Vælg {hest.navn}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Uegnede heste (Nødsituation) liste */}
          {visUegnede && (
            <div className="space-y-3 pt-3 rounded-2xl bg-rose-950/20 border border-rose-900/60 p-4">
              <div>
                <div className="text-xs font-bold text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
                  <span>⚠️</span>
                  <span>Uegnede heste – kun til akut nødstilfælde ({uegnedeHeste.length})</span>
                </div>
                <p className="text-xs text-rose-200/80 mt-1">
                  Disse heste overtræder elevgodkendelse, sundhedsstatus eller hviletid. Vælg kun hvis ingen anden løsning er mulig.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
                {uegnedeHeste.map((hest) => {
                  const belastning = dagsbelastningMap[hest.id] ?? 0;
                  const uegnetGrund = getUegnetAarsag(hest, belastning);
                  const erHviledag = hest.hviledag === lektionUgedag;

                  return (
                    <div
                      key={hest.id}
                      className={`rounded-2xl border p-4 flex flex-col justify-between gap-3 shadow-md ${
                        erHviledag
                          ? 'bg-slate-900/95 border-sky-600/80 ring-1 ring-sky-500/50'
                          : 'bg-slate-900/95 border-rose-900/80'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-lg font-bold text-white flex items-center gap-1.5">
                            {hest.navn}
                            {erHviledag && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-sky-950 text-sky-300 border border-sky-600 font-bold">
                                💤 Hviledag
                              </span>
                            )}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded border ${
                            erHviledag
                              ? 'bg-sky-950/80 text-sky-300 border-sky-700'
                              : 'bg-rose-950 text-rose-300 border border-rose-900'
                          }`}>
                            {belastning} lekt. i dag
                          </span>
                        </div>
                        <div className={`text-xs font-semibold mt-1.5 p-1.5 rounded border ${
                          erHviledag
                            ? 'bg-sky-950/50 text-sky-200 border-sky-700/60'
                            : 'bg-rose-950/50 text-rose-300/90 border-rose-900/50'
                        }`}>
                          ⚠️ {uegnetGrund}
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
                            begrundelseTekst: `NØDTILFÆLDE: Manuel omplacering til uegnet hest (${uegnetGrund})`,
                            erUegnet: true,
                            advarselstekst: uegnetGrund,
                          });
                        }}
                        className="min-h-[44px] px-3 rounded-xl bg-rose-700 hover:bg-rose-600 active:bg-rose-750 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md"
                      >
                        <span>⚠️ Vælg {hest.navn} (Nødtilfælde)</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Vikar information - ingen adgang til øvrige eller uegnede heste */
        <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl text-slate-400 text-xs flex items-center gap-2">
          <span>🔒</span>
          <span>Vikarer er låst til godkendte top-3 forslag for at beskytte heste- og ryttersikkerhed.</span>
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
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">
                  Bekræft omplacering til {valgtForslag.navn}
                </h2>
                <p className="text-sm text-slate-300 mt-1">
                  {plads?.rytterNavnKort} tildeles <strong>{valgtForslag.navn}</strong> som erstatningshest.
                </p>
              </div>
              {valgtForslag.erUegnet && (
                <span className="px-2 py-1 rounded bg-rose-950 text-rose-300 border border-rose-800 text-xs font-bold">
                  Nødstilfælde
                </span>
              )}
            </div>

            {valgtForslag.erUegnet && (
              <div className="p-3.5 bg-rose-950/70 border-2 border-rose-600 rounded-xl text-rose-200 text-xs space-y-1.5">
                <div className="font-bold flex items-center gap-1.5 text-rose-100 text-sm">
                  <span>⚠️</span>
                  <span>ADVARSEL: NØDTILFÆLDE / UEGNET HEST</span>
                </div>
                <p>
                  Denne hest er registreret som <strong>uegnet</strong> ({valgtForslag.advarselstekst}).
                </p>
                <p className="text-[11px] text-rose-300">
                  Dette valg overstyrer hestetildelingen og logges med revisionsspor i auditloggen.
                </p>
              </div>
            )}

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
                className={`flex-1 min-h-[52px] rounded-xl text-white font-bold text-sm shadow-md cursor-pointer transition ${
                  valgtForslag.erUegnet
                    ? 'bg-rose-600 hover:bg-rose-500 active:bg-rose-650'
                    : 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-650'
                }`}
              >
                {gemmer ? 'Gemmer...' : valgtForslag.erUegnet ? 'Godkend nødtilfælde' : 'Godkend omplacering'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
