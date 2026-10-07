import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { erFremmoedeAabent } from '@ridecenter/domain';
import { db, type LokalHest, type LokalLektion, type LokalPlads } from '../offline/dexie-db';

interface HoldKortData {
  lektion: LokalLektion;
  antalElever: number;
  antalFremmoedt: number;
  antalUdeblevet: number;
  harAdvarsel: boolean;
  advarselTekst?: string;
  erLukket: boolean;
}

export function IDagSide() {
  const navigate = useNavigate();
  const [holdData, setHoldData] = useState<HoldKortData[]>([]);
  const [indlaeser, setIndlaeser] = useState(true);

  const hentDagensData = async () => {
    try {
      const iDagStr = new Date().toISOString().slice(0, 10);
      let lektioner = await db.lektioner.where('dato').equals(iDagStr).toArray();
      let allePladser = await db.pladser.toArray();
      let alleHeste = await db.heste.toArray();

      // Hvis tomt i Dexie, forsøg at hente fra serveren (/api/v1/stald/dag/:dato)
      if (lektioner.length === 0) {
        try {
          const res = await fetch(`/api/v1/stald/dag/${iDagStr}`);
          if (res.ok) {
            const data = await res.json();
            if (data.lektioner && data.lektioner.length > 0) {
              const nyLektioner: LokalLektion[] = [];
              const nyPladser: LokalPlads[] = [];

              for (const l of data.lektioner) {
                nyLektioner.push({
                  id: l.id,
                  dato: l.dato,
                  holdId: l.hold_id,
                  holdnavn: l.holdnavn,
                  starttid: l.starttid,
                  niveau: l.niveau,
                  erSpringhold: l.er_springhold,
                  fremmoedeLukket: l.fremmoede_lukket,
                });

                for (const p of l.pladser) {
                  nyPladser.push({
                    id: p.id,
                    lektionId: l.id,
                    rytterId: p.id,
                    rytterNavnKort: p.rytter_navn_kort,
                    aktuelHestId: p.aktuel_hest_id,
                    planlagtHestId: p.planlagt_hest_id,
                    status: p.afledt_status,
                    godkendteHeste: p.godkendte_heste,
                    cheatSheetKoder: p.cheat_sheet_koder,
                    adfaerdsinstruks: p.adfaerdsinstruks,
                  });
                }
              }

              await db.lektioner.bulkPut(nyLektioner);
              await db.pladser.bulkPut(nyPladser);

              lektioner = nyLektioner;
              allePladser = nyPladser;
            }
          }
        } catch {
          // offline, fortsæt med lokale data
        }
      }

      // Saml kortdata
      const hestMap = new Map<string, LokalHest>(alleHeste.map((h) => [h.id, h]));

      const kort: HoldKortData[] = lektioner
        .sort((a, b) => a.starttid.localeCompare(b.starttid))
        .map((l) => {
          const holdPladser = allePladser.filter((p) => p.lektionId === l.id);
          const antalFremmoedt = holdPladser.filter((p) => p.status === 'Fremmoedt').length;
          const antalUdeblevet = holdPladser.filter((p) => p.status === 'Udeblevet').length;

          // Advarsel hvis sygemeldt hest eller afbud
          let harAdvarsel = false;
          let advarselTekst = '';

          for (const plads of holdPladser) {
            if (plads.aktuelHestId) {
              const hest = hestMap.get(plads.aktuelHestId);
              if (hest && hest.sundhedsstatus && hest.sundhedsstatus !== 'Aktiv') {
                harAdvarsel = true;
                advarselTekst = `Hest ${hest.navn} er meldt ${hest.sundhedsstatus}`;
                break;
              }
            }
            if (plads.status === 'Afbud_rettidigt' || plads.status === 'Afbud_for_sent') {
              harAdvarsel = true;
              advarselTekst = 'Afbud registreret på holdet';
            }
          }

          const erLukket = Boolean(
            l.fremmoedeLukket ||
              !erFremmoedeAabent({
                starttid: l.starttid,
                varighedMin: 60,
                dato: l.dato,
                lukketTidspunkt: null,
                nu: new Date(),
              })
          );

          return {
            lektion: l,
            antalElever: holdPladser.length,
            antalFremmoedt,
            antalUdeblevet,
            harAdvarsel,
            advarselTekst,
            erLukket,
          };
        });

      setHoldData(kort);
    } catch (err) {
      console.error('Fejl ved indlæsning af dagens hold:', err);
    } finally {
      setIndlaeser(false);
    }
  };

  useEffect(() => {
    hentDagensData();
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dagens lektioner</h1>
          <p className="text-sm text-slate-400 mt-1">
            Vælg et hold for hurtig afkrydsning og hestetildeling
          </p>
        </div>
        <button
          onClick={hentDagensData}
          className="min-h-[44px] px-3.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-sm font-medium"
        >
          Opdater
        </button>
      </div>

      {indlaeser ? (
        <div className="flex h-48 items-center justify-center">
          <div className="text-slate-400 font-medium animate-pulse">Indlæser dagens hold...</div>
        </div>
      ) : holdData.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 p-12 text-center">
          <p className="text-slate-400 text-base">Ingen lektioner planlagt for i dag.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {holdData.map(
            ({
              lektion,
              antalElever,
              antalFremmoedt,
              antalUdeblevet,
              harAdvarsel,
              advarselTekst,
              erLukket,
            }) => (
              <button
                key={lektion.id}
                type="button"
                onClick={() => navigate(`/stald/lektion/${lektion.id}`)}
                className="w-full text-left rounded-2xl bg-slate-900 border border-slate-800 hover:border-sky-500/50 hover:bg-slate-850 p-5 shadow-lg transition-all active:scale-[0.99] flex flex-col justify-between gap-4 group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-sky-400 font-bold text-lg">
                      Kl. {lektion.starttid}
                    </span>
                    <div className="flex items-center gap-2">
                      {harAdvarsel && (
                        <span
                          title={advarselTekst}
                          className="px-2 py-0.5 rounded text-xs bg-amber-950/90 text-amber-300 border border-amber-800 flex items-center gap-1 font-medium"
                        >
                          <span>⚠</span> Advarsel
                        </span>
                      )}
                      {erLukket ? (
                        <span className="px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-400 border border-slate-700">
                          Afsluttet
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-xs bg-emerald-950/80 text-emerald-300 border border-emerald-800">
                          Åbent
                        </span>
                      )}
                    </div>
                  </div>

                  <h2 className="text-xl font-bold text-white group-hover:text-sky-300 transition-colors">
                    {lektion.holdnavn}
                  </h2>
                  <div className="text-sm text-slate-400 mt-1 flex items-center gap-2">
                    <span>Niveau: {lektion.niveau}</span>
                    {lektion.erSpringhold && (
                      <span className="px-1.5 py-0.5 rounded text-[11px] bg-amber-950 text-amber-300 border border-amber-800">
                        Spring
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-sm">
                  <span className="text-slate-400">
                    {antalElever} elever tilmeldt
                  </span>
                  <div className="flex items-center gap-2">
                    {antalFremmoedt > 0 && (
                      <span className="text-emerald-400 font-medium">
                        {antalFremmoedt} fremmødt
                      </span>
                    )}
                    {antalUdeblevet > 0 && (
                      <span className="text-rose-400 font-medium">
                        {antalUdeblevet} udeblevet
                      </span>
                    )}
                    {antalFremmoedt === 0 && antalUdeblevet === 0 && (
                      <span className="text-slate-500 italic">Mangler afkrydsning</span>
                    )}
                  </div>
                </div>
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

