import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { FremmoedeStatus } from '@ridecenter/contracts';
import { db, type LokalHest, type LokalLektion, type LokalPlads } from '../offline/dexie-db';
import { gemFremmoedeBatch, gemKorrigerFremmoede } from '../offline/fremmoede-sync';
import { KorrigerPladsDialog } from './KorrigerPladsDialog';

export function LektionSide() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [lektion, setLektion] = useState<LokalLektion | null>(null);
  const [pladser, setPladser] = useState<LokalPlads[]>([]);
  const [hesteMap, setHesteMap] = useState<Map<string, LokalHest>>(new Map());
  const [indlaeser, setIndlaeser] = useState(true);
  const [visAfslutModal, setVisAfslutModal] = useState(false);

  // Korrigeringsdialog state (bruges ved ændringer efter holdet er afsluttet)
  const [korrigerPlads, setKorrigerPlads] = useState<LokalPlads | null>(null);

  // Tilstand til at vise store 'Erstat hest' knapper på alle ryttere
  const [redigerHesteTilstand, setRedigerHesteTilstand] = useState(false);

  const hentData = async () => {
    if (!id) return;
    try {
      // 1. Hent heste fra Dexie eller server
      let alleHeste = await db.heste.toArray();
      if (alleHeste.length === 0) {
        try {
          const hesteRes = await fetch('/api/v1/heste');
          if (hesteRes.ok) {
            const hesteData = await hesteRes.json();
            alleHeste = hesteData.map((h: any) => ({
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
      setHesteMap(new Map(alleHeste.map((h) => [h.id, h])));

      // 2. Hent lektion og pladser
      let l = await db.lektioner.get(id);
      let p = await db.pladser.where('lektionId').equals(id).toArray();

      // Hvis ikke i lokal DB eller hvis rytternavne mangler, hent fra serveren
      const manglerRytterNavne = p.length > 0 && p.some((item) => !item.rytterNavnKort);

      if (!l || p.length === 0 || manglerRytterNavne) {
        const datoStr = l?.dato ?? new Date().toISOString().slice(0, 10);
        const enhedNoegle = localStorage.getItem('ridecenter_enhedsnoegle') ?? 'demo-enhedsnoegle-stald-tablet-1';
        try {
          const res = await fetch(`/api/v1/stald/dag/${datoStr}`, {
            headers: {
              'X-Enhed-Noegle': enhedNoegle,
            },
          });
          if (res.ok) {
            const dagData = await res.json();
            const fundetHold = dagData.lektioner?.find((item: any) => item.id === id);
            if (fundetHold) {
              l = {
                id: fundetHold.id,
                dato: fundetHold.dato,
                holdId: fundetHold.hold_id,
                holdnavn: fundetHold.holdnavn,
                starttid: fundetHold.starttid,
                niveau: fundetHold.niveau,
                erSpringhold: fundetHold.er_springhold,
                fremmoedeLukket: fundetHold.fremmoede_lukket,
              };
              p = fundetHold.pladser.map((pl: any) => ({
                id: pl.id,
                lektionId: id,
                rytterId: pl.id,
                rytterNavnKort: pl.rytter_navn_kort,
                aktuelHestId: pl.aktuel_hest_id,
                planlagtHestId: pl.planlagt_hest_id,
                status: pl.afledt_status,
                rytterStatus: pl.rytter_status,
                godkendteHeste: pl.godkendte_heste,
                cheatSheetKoder: pl.cheat_sheet_koder,
                adfaerdsinstruks: pl.adfaerdsinstruks,
              }));
              await db.lektioner.put(l);
              await db.pladser.bulkPut(p);
            }
          }
        } catch {}
      }

      if (l) setLektion(l);
      setPladser(p);
    } catch (e) {
      console.error('Fejl ved indlæsning af lektion:', e);
    } finally {
      setIndlaeser(false);
    }
  };

  useEffect(() => {
    hentData();
  }, [id]);

  // Sortering (Fase 5 / T208):
  // 1. Prioritet: Rytter+hest par med advarsel (sygemeldt/skadet hest)
  // 2. Prioritet: Sikkerhedskoder / instrukser
  // 3. Prioritet: Opsagte elever
  // 4. Øvrige sorteret alfabetisk
  const sorteredePladser = useMemo(() => {
    return [...pladser].sort((a, b) => {
      const aHest = a.aktuelHestId ? hesteMap.get(a.aktuelHestId) : null;
      const bHest = b.aktuelHestId ? hesteMap.get(b.aktuelHestId) : null;
      const aHestSyg = Boolean(aHest && aHest.sundhedsstatus && aHest.sundhedsstatus !== 'Aktiv');
      const bHestSyg = Boolean(bHest && bHest.sundhedsstatus && bHest.sundhedsstatus !== 'Aktiv');
      if (aHestSyg !== bHestSyg) return aHestSyg ? -1 : 1;

      const aHarKode = (a.cheatSheetKoder && a.cheatSheetKoder.length > 0) || Boolean(a.adfaerdsinstruks);
      const bHarKode = (b.cheatSheetKoder && b.cheatSheetKoder.length > 0) || Boolean(b.adfaerdsinstruks);
      if (aHarKode !== bHarKode) return aHarKode ? -1 : 1;

      const aErOpsagt = a.rytterStatus === 'Opsagt';
      const bErOpsagt = b.rytterStatus === 'Opsagt';
      if (aErOpsagt !== bErOpsagt) return aErOpsagt ? -1 : 1;

      return (a.rytterNavnKort ?? '').localeCompare(b.rytterNavnKort ?? '', 'da');
    });
  }, [pladser, hesteMap]);

  // Holdet er kun lukket, hvis der er foretaget "Afslut hold"
  const erLukket = Boolean(lektion?.fremmoedeLukket);

  // 1. Markér alle fremmødt (< 100 ms i Dexie)
  const haandterMarkerAlleFremmoedt = async () => {
    if (!id || pladser.length === 0) return;
    if (erLukket) return;

    const opdateringer = pladser.map((p) => ({
      ...p,
      status: 'Fremmoedt',
    }));

    // Optimistisk lokal opdatering
    setPladser(opdateringer);
    await db.pladser.bulkPut(opdateringer);

    // Gem i outbox
    await gemFremmoedeBatch(
      id,
      pladser.map((p) => ({
        lektionsplads_id: p.id,
        status: 'Fremmoedt',
      }))
    );
  };

  // 2. Sæt status for enkelt rytter (eller åbn korrektion hvis holdet er afsluttet)
  const haandterSaetStatus = async (plads: LokalPlads, nyStatus: 'Fremmoedt' | 'Udeblevet') => {
    if (erLukket) {
      setKorrigerPlads(plads);
      return;
    }

    const opdateret = { ...plads, status: nyStatus };
    setPladser((prev) => prev.map((p) => (p.id === plads.id ? opdateret : p)));
    await db.pladser.put(opdateret);

    await gemFremmoedeBatch(id!, [
      {
        lektionsplads_id: plads.id,
        status: nyStatus,
      },
    ]);
  };

  // 3. Korrektion bekræftet fra dialog (efter holdet er afsluttet)
  const haandterKorrektionBekraeft = async (
    nyStatus: FremmoedeStatus,
    begrundelse: string
  ) => {
    if (!korrigerPlads || !id) return;
    const pladsId = korrigerPlads.id;
    setKorrigerPlads(null);

    const opdateret = { ...korrigerPlads, status: nyStatus };
    setPladser((prev) => prev.map((p) => (p.id === pladsId ? opdateret : p)));
    await db.pladser.put(opdateret);

    await gemKorrigerFremmoede(pladsId, nyStatus, begrundelse);
  };

  // 4. Afslut hold
  const haandterAfslutHold = async () => {
    if (!id || !lektion) return;
    const nuStr = new Date().toISOString();
    const opdateretLektion = { ...lektion, fremmoedeLukket: nuStr };
    setLektion(opdateretLektion);
    await db.lektioner.put(opdateretLektion);
    setVisAfslutModal(false);

    try {
      await fetch(`/api/v1/lektioner/${id}/afslut`, {
        method: 'POST',
      });
    } catch (e) {
      console.warn('Kunne ikke afslutte lektion online, lukket lokalt');
    }
  };

  if (indlaeser) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-slate-400 font-medium animate-pulse">Indlæser holdliste...</div>
      </div>
    );
  }

  if (!lektion) {
    return (
      <div className="p-6 text-center">
        <p className="text-slate-400 mb-4">Lektionen blev ikke fundet.</p>
        <button
          onClick={() => navigate('/stald/i-dag')}
          className="min-h-[56px] px-6 rounded-xl bg-slate-800 text-white font-medium"
        >
          Tilbage til dagens hold
        </button>
      </div>
    );
  }

  const antalFremmoedt = pladser.filter((p) => p.status === 'Fremmoedt').length;
  const antalUdeblevet = pladser.filter((p) => p.status === 'Udeblevet').length;

  // Find sygemeldte/utilgængelige heste på dette hold
  const sygeHestePaaLektion = pladser
    .map((p) => (p.aktuelHestId ? hesteMap.get(p.aktuelHestId) : null))
    .filter((h): h is LokalHest => Boolean(h && h.sundhedsstatus && h.sundhedsstatus !== 'Aktiv'));

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      {/* Top bjælke & navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => navigate('/stald/i-dag')}
          className="min-h-[48px] px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 font-semibold text-sm flex items-center gap-2 cursor-pointer transition"
        >
          <span>←</span>
          <span>Dagens hold</span>
        </button>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setRedigerHesteTilstand((curr) => !curr)}
            className={`min-h-[48px] px-3.5 rounded-xl border font-bold text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer transition shadow-sm active:scale-95 ${
              redigerHesteTilstand
                ? 'bg-amber-500 text-stone-950 border-amber-300 ring-2 ring-amber-400'
                : 'bg-slate-800 hover:bg-slate-750 text-slate-200 border-slate-700'
            }`}
            title="Vis store 'Erstat hest' knapper på alle ryttere på holdet"
          >
            <span>🔄</span>
            <span>{redigerHesteTilstand ? 'Afslut omplacering' : 'Redigér heste'}</span>
          </button>

          <button
            type="button"
            onClick={() => navigate(`/stald/lektion/${id}/cheat-sheet`)}
            className="min-h-[48px] px-3.5 rounded-xl bg-indigo-950/70 hover:bg-indigo-900 text-indigo-200 border border-indigo-700/80 font-semibold text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer"
          >
            🛡️ Cheat Sheet
          </button>
          {erLukket ? (
            <span className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-amber-950/80 text-amber-300 border border-amber-700/60 flex items-center gap-1.5">
              <span>🔒</span> Afsluttet hold (Korrektion kræver begrundelse)
            </span>
          ) : (
            <button
              onClick={() => setVisAfslutModal(true)}
              className="min-h-[48px] px-5 rounded-xl bg-rose-900/70 hover:bg-rose-800 text-rose-100 border border-rose-700/80 font-semibold text-sm cursor-pointer transition"
            >
              Afslut hold
            </button>
          )}
        </div>
      </div>

      {/* Advarselsbanner for sygemeldte/skadede heste på holdet */}
      {sygeHestePaaLektion.length > 0 && (
        <div className="rounded-2xl bg-amber-950/70 border border-amber-600 p-4 text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <span className="text-3xl">⚠️</span>
            <div>
              <div className="font-bold text-amber-100 text-base">
                Advarsel: Sygemeldt/skadet hest tildelt
              </div>
              <div className="text-sm text-amber-200 mt-0.5">
                {sygeHestePaaLektion.map((h) => `${h.navn} (${h.sundhedsstatus})`).join(', ')} er meldt utilgængelig og skal erstattes.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hold Header */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 flex flex-wrap items-center justify-between gap-4 shadow-lg">
        <div>
          <div className="flex items-center gap-2 text-sky-400 font-bold mb-1">
            <span>Kl. {lektion.starttid}</span>
            <span>•</span>
            <span>Niveau: {lektion.niveau}</span>
            {lektion.erSpringhold && (
              <span className="px-2 py-0.5 rounded text-xs bg-amber-950 text-amber-300 border border-amber-800 font-semibold">
                Spring
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-white">{lektion.holdnavn}</h1>
        </div>
        <div className="flex items-center gap-3 text-sm font-medium">
          <div className="px-3.5 py-2 rounded-xl bg-emerald-950/50 border border-emerald-800 text-emerald-300">
            {antalFremmoedt} Fremmødt
          </div>
          <div className="px-3.5 py-2 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-300">
            {antalUdeblevet} Udeblevet
          </div>
          <div className="px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300">
            {pladser.length} I alt
          </div>
        </div>
      </div>

      {/* Hurtig-handling: Markér alle fremmødt */}
      {!erLukket && (
        <button
          onClick={haandterMarkerAlleFremmoedt}
          className="w-full min-h-[56px] rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-lg shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-3 transition-transform active:scale-[0.99] cursor-pointer"
        >
          <span>✓</span>
          <span>Markér alle fremmødt</span>
        </button>
      )}

      {/* Elevliste (sorteret: 1. Sygemeldt hest, 2. Sikkerhedsprofil, 3. Opsagt elev, 4. Øvrige) */}
      <div className="space-y-3">
        {sorteredePladser.map((plads) => {
          const erFremmoedt = plads.status === 'Fremmoedt';
          const erUdeblevet = plads.status === 'Udeblevet';
          const hest = plads.aktuelHestId ? hesteMap.get(plads.aktuelHestId) : null;
          const hestErSyg = Boolean(hest && hest.sundhedsstatus && hest.sundhedsstatus !== 'Aktiv');
          const harSikkerhedsprofil =
            (plads.cheatSheetKoder && plads.cheatSheetKoder.length > 0) || Boolean(plads.adfaerdsinstruks);
          const erOpsagt = plads.rytterStatus === 'Opsagt';

          return (
            <div
              key={plads.id}
              className={`rounded-2xl border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition shadow-md relative overflow-hidden ${
                erOpsagt
                  ? 'bg-rose-950/40 border-rose-600/90 ring-1 ring-rose-500/60'
                  : hestErSyg
                  ? 'bg-amber-950/40 border-amber-500 ring-2 ring-amber-400/50 shadow-amber-950/50'
                  : harSikkerhedsprofil
                  ? 'bg-slate-900/95 border-amber-800/40'
                  : 'bg-slate-900/90 border-slate-800/80'
              }`}
            >
              <div className="flex-1 min-w-0 sm:pl-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-white truncate">
                    {plads.rytterNavnKort ?? 'Rytter'}
                  </span>

                  {erOpsagt && (
                    <span
                      className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-rose-600 text-white text-xs font-black shadow-sm"
                      title="Eleven er opsagt"
                    >
                      !
                    </span>
                  )}

                  {!erOpsagt && hestErSyg && (
                    <span
                      className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-400 text-stone-950 text-xs font-black shadow-sm"
                      title="Advarsel: Sygemeldt/skadet hest tildelt"
                    >
                      !
                    </span>
                  )}

                  {erOpsagt && (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-900/80 text-rose-200 border border-rose-600 font-bold">
                      ⛔ Elev opsagt
                    </span>
                  )}
                </div>

                <div className="text-sm text-slate-400 flex flex-wrap items-center gap-2 mt-1">
                  <span className="font-medium text-slate-300">Hest:</span>
                  {hest ? (
                    <span className={`font-semibold ${hestErSyg ? 'text-amber-300 flex items-center gap-1.5' : 'text-slate-200'}`}>
                      {hest.navn}
                      {hestErSyg && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-600 font-bold">
                          ⚠️ {hest.sundhedsstatus}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-slate-500 italic">
                      {plads.aktuelHestId ? 'Ukendt hest' : 'Ingen hest'}
                    </span>
                  )}

                  {harSikkerhedsprofil && (
                    <button
                      type="button"
                      onClick={() => navigate(`/stald/lektion/${id}/cheat-sheet`)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-amber-950/40 text-amber-300 border border-amber-800/40 hover:bg-amber-900/50 transition cursor-pointer"
                      title="Eleven har særlige sikkerhedskoder/instrukser. Klik for at se Cheat Sheet."
                    >
                      <span>⚠️</span>
                      <span>Sikkerhedsprofil</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Action area: Stor Erstat hest knap (synlig efter tryk af "Redigér heste" i toppen) + Fremmøde knapper */}
              <div className="flex items-center gap-2.5 shrink-0 flex-wrap sm:flex-nowrap">
                {redigerHesteTilstand && !erOpsagt && (
                  <button
                    type="button"
                    onClick={() => navigate(`/stald/plads/${plads.id}/erstat`)}
                    className={`min-h-[52px] px-4 rounded-xl font-bold text-sm flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer whitespace-nowrap ${
                      hestErSyg
                        ? 'bg-amber-500 hover:bg-amber-400 text-stone-950 ring-2 ring-amber-300 font-black'
                        : 'bg-sky-600 hover:bg-sky-500 text-white border border-sky-400 shadow-sky-950/40'
                    }`}
                    title="Vælg ny erstatningshest til denne rytter"
                  >
                    <span>🔄</span>
                    <span>Erstat hest</span>
                  </button>
                )}

                {erOpsagt ? (
                  <div className="min-h-[52px] px-5 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-sm font-bold flex items-center gap-2">
                    <span>⛔</span>
                    <span>Elev opsagt</span>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => haandterSaetStatus(plads, 'Fremmoedt')}
                      className={`min-h-[52px] px-5 rounded-xl font-bold text-sm transition-all flex items-center gap-1.5 cursor-pointer ${
                        erFremmoedt
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40 ring-2 ring-emerald-400'
                          : 'bg-slate-800 hover:bg-slate-750 text-slate-400 border border-slate-700'
                      }`}
                    >
                      ✓ Fremmødt
                    </button>
                    <button
                      type="button"
                      onClick={() => haandterSaetStatus(plads, 'Udeblevet')}
                      className={`min-h-[52px] px-5 rounded-xl font-bold text-sm transition-all flex items-center gap-1.5 cursor-pointer ${
                        erUdeblevet
                          ? 'bg-rose-600 text-white shadow-md shadow-rose-950/40 ring-2 ring-rose-400'
                          : 'bg-slate-800 hover:bg-slate-750 text-slate-400 border border-slate-700'
                      }`}
                    >
                      ✗ Udeblevet
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bekræft afslutning modal */}
      {visAfslutModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl text-slate-100">
            <h2 className="text-xl font-bold text-white mb-2">Afslut hold?</h2>
            <p className="text-sm text-slate-400 mb-6">
              Når holdet er afsluttet, låses fremmødelisten. Eventuelle efterfølgende ændringer vil kræve en skriftlig begrundelse jf. revisionskrav.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setVisAfslutModal(false)}
                className="flex-1 min-h-[52px] rounded-xl border border-slate-700 bg-slate-800 font-medium text-slate-300 hover:bg-slate-700 cursor-pointer"
              >
                Annuller
              </button>
              <button
                type="button"
                onClick={haandterAfslutHold}
                className="flex-1 min-h-[52px] rounded-xl bg-rose-600 font-semibold text-white hover:bg-rose-500 shadow-lg shadow-rose-900/40 cursor-pointer"
              >
                Ja, afslut hold
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Korrigeringsdialog */}
      <KorrigerPladsDialog
        aaben={!!korrigerPlads}
        rytterNavn={korrigerPlads?.rytterNavnKort ?? 'Rytter'}
        nuvaerendeStatus={(korrigerPlads?.status as any) ?? null}
        onLuk={() => setKorrigerPlads(null)}
        onBekraeft={haandterKorrektionBekraeft}
      />
    </div>
  );
}
