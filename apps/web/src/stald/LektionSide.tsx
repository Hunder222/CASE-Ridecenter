import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { FremmoedeStatus } from '@ridecenter/contracts';
import { erFremmoedeAabent } from '@ridecenter/domain';
import { db, type LokalLektion, type LokalPlads } from '../offline/dexie-db';
import { gemFremmoedeBatch, gemKorrigerFremmoede } from '../offline/fremmoede-sync';
import { KorrigerPladsDialog } from './KorrigerPladsDialog';

export function LektionSide() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [lektion, setLektion] = useState<LokalLektion | null>(null);
  const [pladser, setPladser] = useState<LokalPlads[]>([]);
  const [indlaeser, setIndlaeser] = useState(true);
  const [visAfslutModal, setVisAfslutModal] = useState(false);

  // Korrigeringsdialog state
  const [korrigerPlads, setKorrigerPlads] = useState<LokalPlads | null>(null);

  const hentData = async () => {
    if (!id) return;
    try {
      let l = await db.lektioner.get(id);
      let p = await db.pladser.where('lektionId').equals(id).toArray();

      // Hvis ikke i lokal DB, prøv API
      if (!l || p.length === 0) {
        const iDagStr = new Date().toISOString().slice(0, 10);
        const res = await fetch(`/api/v1/stald/dag/${iDagStr}`);
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
              godkendteHeste: pl.godkendte_heste,
              cheatSheetKoder: pl.cheat_sheet_koder,
              adfaerdsinstruks: pl.adfaerdsinstruks,
            }));
            await db.lektioner.put(l);
            await db.pladser.bulkPut(p);
          }
        }
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

  const erLukket = (() => {
    if (!lektion) return false;
    if (lektion.fremmoedeLukket) return true;
    return !erFremmoedeAabent({
      starttid: lektion.starttid,
      varighedMin: 60,
      dato: lektion.dato,
      lukketTidspunkt: null,
      nu: new Date(),
    });
  })();

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

  // 2. Toggle enkelt rytter mellem Fremmødt og Udeblevet
  const haandterSkiftStatus = async (plads: LokalPlads) => {
    if (erLukket) {
      setKorrigerPlads(plads);
      return;
    }

    const nyStatus: FremmoedeStatus =
      plads.status === 'Fremmoedt' ? 'Udeblevet' : 'Fremmoedt';

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

  // 3. Korrektion bekræftet fra dialog
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
          onClick={() => navigate('/stald/hold')}
          className="min-h-[56px] px-6 rounded-xl bg-slate-800 text-white font-medium"
        >
          Tilbage til dagens hold
        </button>
      </div>
    );
  }

  const antalFremmoedt = pladser.filter((p) => p.status === 'Fremmoedt').length;
  const antalUdeblevet = pladser.filter((p) => p.status === 'Udeblevet').length;

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      {/* Top bjælke & navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/stald/hold')}
          className="min-h-[48px] px-4 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-slate-300 font-medium flex items-center gap-2 border border-slate-700"
        >
          ← Dagens hold
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/stald/oensker/${id}`)}
            className="min-h-[48px] px-4 rounded-xl bg-sky-900/60 hover:bg-sky-850 text-sky-200 border border-sky-700/80 font-semibold text-sm"
          >
            Ønsker
          </button>
          {erLukket ? (
            <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-950/80 text-amber-300 border border-amber-700/60 flex items-center gap-1.5">
              <span>🔒</span> Afsluttet hold (Korrektion kræver begrundelse)
            </span>
          ) : (
            <button
              onClick={() => setVisAfslutModal(true)}
              className="min-h-[48px] px-5 rounded-xl bg-rose-900/60 hover:bg-rose-850 text-rose-200 border border-rose-700/80 font-semibold"
            >
              Afslut hold
            </button>
          )}
        </div>
      </div>

      {/* Hold Header */}
      <div className="rounded-2xl bg-slate-850 border border-slate-800 p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sky-400 font-semibold text-sm mb-1">
            <span>Kl. {lektion.starttid}</span>
            <span>•</span>
            <span>{lektion.niveau}</span>
            {lektion.erSpringhold && (
              <span className="px-2 py-0.5 rounded text-xs bg-amber-950/80 text-amber-300 border border-amber-800/60 font-normal">
                Spring
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-white">{lektion.holdnavn}</h1>
        </div>
        <div className="flex items-center gap-4 text-sm font-medium">
          <div className="px-3 py-2 rounded-xl bg-emerald-950/40 border border-emerald-900 text-emerald-300">
            {antalFremmoedt} Fremmødt
          </div>
          <div className="px-3 py-2 rounded-xl bg-rose-950/40 border border-rose-900 text-rose-300">
            {antalUdeblevet} Udeblevet
          </div>
          <div className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300">
            {pladser.length} I alt
          </div>
        </div>
      </div>

      {/* Hurtig-handling: Markér alle fremmødt */}
      {!erLukket && (
        <button
          onClick={haandterMarkerAlleFremmoedt}
          className="w-full min-h-[56px] rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-lg shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-3 transition-transform active:scale-[0.99]"
        >
          <span>✓</span>
          <span>Markér alle fremmødt</span>
        </button>
      )}

      {/* Elevliste (mindst 56px touch felter) */}
      <div className="space-y-3">
        {pladser.map((plads) => {
          const erFremmoedt = plads.status === 'Fremmoedt';
          const erUdeblevet = plads.status === 'Udeblevet';

          return (
            <div
              key={plads.id}
              className="rounded-2xl bg-slate-900/90 border border-slate-800/80 p-4 flex items-center justify-between gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="text-lg font-semibold text-white truncate">
                  {plads.rytterNavnKort ?? 'Rytter'}
                </div>
                <div className="text-sm text-slate-400 flex items-center gap-2 mt-0.5">
                  <span className="font-medium text-slate-300">Hest:</span>
                  <span>{plads.aktuelHestId ? 'Tildelt hest' : 'Ingen hest'}</span>
                  {plads.cheatSheetKoder && plads.cheatSheetKoder.length > 0 && (
                    <span className="px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-400 font-mono">
                      {plads.cheatSheetKoder.join(', ')}
                    </span>
                  )}
                </div>
              </div>

              {/* Status toggle knapper */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (plads.status !== 'Fremmoedt') haandterSkiftStatus(plads);
                  }}
                  className={`min-h-[56px] px-5 rounded-xl font-bold text-sm transition-all flex items-center gap-1.5 ${
                    erFremmoedt
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40 ring-2 ring-emerald-400'
                      : 'bg-slate-800/80 hover:bg-slate-750 text-slate-400 border border-slate-700/80'
                  }`}
                >
                  ✓ Fremmødt
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (plads.status !== 'Udeblevet') haandterSkiftStatus(plads);
                  }}
                  className={`min-h-[56px] px-5 rounded-xl font-bold text-sm transition-all flex items-center gap-1.5 ${
                    erUdeblevet
                      ? 'bg-rose-600 text-white shadow-md shadow-rose-950/40 ring-2 ring-rose-400'
                      : 'bg-slate-800/80 hover:bg-slate-750 text-slate-400 border border-slate-700/80'
                  }`}
                >
                  ✗ Udeblevet
                </button>
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
                className="flex-1 min-h-[56px] rounded-xl border border-slate-700 bg-slate-800 font-medium text-slate-300 hover:bg-slate-700"
              >
                Annuller
              </button>
              <button
                type="button"
                onClick={haandterAfslutHold}
                className="flex-1 min-h-[56px] rounded-xl bg-rose-600 font-semibold text-white hover:bg-rose-500 shadow-lg shadow-rose-900/40"
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

