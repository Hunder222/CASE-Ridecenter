import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
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

function justerDato(datoStr: string, dage: number): string {
  const parts = datoStr.split('-').map(Number);
  const aar = parts[0] ?? 2026;
  const md = parts[1] ?? 1;
  const dag = parts[2] ?? 1;
  const d = new Date(aar, md - 1, dag + dage);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formaterDatoDansk(datoStr: string): string {
  try {
    const parts = datoStr.split('-').map(Number);
    const aar = parts[0] ?? 2026;
    const md = parts[1] ?? 1;
    const dag = parts[2] ?? 1;
    const d = new Date(aar, md - 1, dag);
    const ugedag = d.toLocaleDateString('da-DK', { weekday: 'long' });
    const dagMaanedAar = d.toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' });
    return `${ugedag.charAt(0).toUpperCase() + ugedag.slice(1)} d. ${dagMaanedAar}`;
  } catch {
    return datoStr;
  }
}

export function IDagSide() {
  const navigate = useNavigate();
  const iDagStr = new Date().toISOString().slice(0, 10);
  const [valgtDato, setValgtDato] = useState<string>(iDagStr);
  const [holdData, setHoldData] = useState<HoldKortData[]>([]);
  const [indlaeser, setIndlaeser] = useState(true);

  const hentData = async (datoStr: string, tvingServer = false) => {
    setIndlaeser(true);
    try {
      let lektioner = await db.lektioner.where('dato').equals(datoStr).toArray();
      let allePladser = await db.pladser.toArray();
      let alleHeste = await db.heste.toArray();

      // Sikr heste i Dexie
      if (alleHeste.length === 0) {
        try {
          const hesteRes = await fetch('/api/v1/heste');
          if (hesteRes.ok) {
            const hesteData = await hesteRes.json();
            const lokHeste: LokalHest[] = hesteData.map((h: any) => ({
              id: h.id,
              navn: h.navn,
              stangmaal_cm: h.stangmaal_cm,
              sundhedsstatus: h.sundhedsstatus,
              temperament: h.temperament,
              staldnoter: h.staldnoter ?? '',
              hviledag: h.hviledag,
              max_lektioner_dag: h.max_lektioner_dag,
            }));
            await db.heste.bulkPut(lokHeste);
            alleHeste = lokHeste;
          }
        } catch {}
      }

      // Hent fra serveren hvis tomt lokalt eller tvingServer er sand
      if (lektioner.length === 0 || tvingServer) {
        try {
          const enhedNoegle = localStorage.getItem('ridecenter_enhedsnoegle') ?? 'demo-enhedsnoegle-stald-tablet-1';
          const res = await fetch(`/api/v1/stald/dag/${datoStr}`, {
            headers: {
              'X-Enhed-Noegle': enhedNoegle,
            },
          });
          if (res.ok) {
            const data = await res.json();
            if (data.lektioner) {
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

              if (nyLektioner.length > 0) {
                await db.lektioner.bulkPut(nyLektioner);
                await db.pladser.bulkPut(nyPladser);
                lektioner = nyLektioner;
                allePladser = await db.pladser.toArray();
              }
            }
          }
        } catch {
          // offline, fortsæt med eksisterende Dexie-data
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

          // Lektionen er kun lukket, hvis der eksplicit er trykket "Afslut hold"
          const erLukket = Boolean(l.fremmoedeLukket);

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
      console.error('Fejl ved indlæsning af hold for dato:', err);
    } finally {
      setIndlaeser(false);
    }
  };

  useEffect(() => {
    hentData(valgtDato);
  }, [valgtDato]);

  const erIDag = valgtDato === iDagStr;

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      {/* Dato navigation bar */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-start">
          <button
            type="button"
            onClick={() => setValgtDato((d) => justerDato(d, -1))}
            className="min-h-[44px] px-3.5 rounded-xl bg-slate-800 hover:bg-slate-750 active:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-sm flex items-center gap-1.5 transition cursor-pointer"
            title="Gå til forrige dag"
          >
            <span>←</span>
            <span className="hidden sm:inline">Forrige dag</span>
          </button>

          <button
            type="button"
            onClick={() => setValgtDato(iDagStr)}
            className={`min-h-[44px] px-4 rounded-xl font-semibold text-sm border transition cursor-pointer ${
              erIDag
                ? 'bg-sky-600 text-white border-sky-400 shadow-md'
                : 'bg-slate-800 hover:bg-slate-750 text-slate-300 border-slate-700'
            }`}
          >
            I dag
          </button>

          <button
            type="button"
            onClick={() => setValgtDato((d) => justerDato(d, 1))}
            className="min-h-[44px] px-3.5 rounded-xl bg-slate-800 hover:bg-slate-750 active:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-sm flex items-center gap-1.5 transition cursor-pointer"
            title="Gå til næste dag"
          >
            <span className="hidden sm:inline">Næste dag</span>
            <span>→</span>
          </button>
        </div>

        <div className="text-center">
          <div className="text-lg sm:text-xl font-bold text-white">
            {formaterDatoDansk(valgtDato)}
          </div>
          {erIDag && (
            <div className="text-xs text-sky-400 font-medium mt-0.5">Dagens program</div>
          )}
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <input
            type="date"
            value={valgtDato}
            onChange={(e) => {
              if (e.target.value) setValgtDato(e.target.value);
            }}
            className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-800 text-slate-200 border border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
            title="Vælg dato"
          />
          <button
            type="button"
            onClick={() => hentData(valgtDato, true)}
            className="min-h-[44px] px-3.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 text-sm font-medium transition cursor-pointer"
            title="Genindlæs data fra serveren"
          >
            🔄 Opdater
          </button>
        </div>
      </div>

      {indlaeser ? (
        <div className="flex h-48 items-center justify-center">
          <div className="text-slate-400 font-medium animate-pulse">Indlæser lektioner...</div>
        </div>
      ) : holdData.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 p-12 text-center bg-slate-900/40">
          <p className="text-slate-400 text-base">
            Ingen lektioner planlagt for {formaterDatoDansk(valgtDato)}.
          </p>
          <div className="mt-4 flex justify-center gap-3">
            {!erIDag && (
              <button
                type="button"
                onClick={() => setValgtDato(iDagStr)}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-sm transition"
              >
                Gå til i dag
              </button>
            )}
            <button
              type="button"
              onClick={() => hentData(valgtDato, true)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm border border-slate-700 transition"
            >
              Prøv at hente fra server
            </button>
          </div>
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
                className="w-full text-left rounded-2xl bg-slate-900 border border-slate-800 hover:border-sky-500/50 hover:bg-slate-850 p-5 shadow-lg transition-all active:scale-[0.99] flex flex-col justify-between gap-4 group cursor-pointer"
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
                          className="px-2.5 py-1 rounded-full text-xs bg-amber-950/90 text-amber-300 border border-amber-800 flex items-center gap-1 font-semibold"
                        >
                          <span>⚠️</span> Advarsel
                        </span>
                      )}
                      {erLukket ? (
                        <span className="px-2.5 py-1 rounded-full text-xs bg-slate-800 text-slate-400 border border-slate-700 font-medium">
                          🔒 Afsluttet
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-xs bg-emerald-950/80 text-emerald-300 border border-emerald-800 font-semibold">
                          ✓ Åbent
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
