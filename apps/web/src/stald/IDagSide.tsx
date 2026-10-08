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

function forskydMaanedStreng(maanedStr: string, delta: number): string {
  const [aarStr = '2026', mdStr = '1'] = maanedStr.split('-');
  const d = new Date(parseInt(aarStr, 10), parseInt(mdStr, 10) - 1 + delta, 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

function formaterMaanedDansk(maanedStr: string): string {
  try {
    const [aarStr = '2026', mdStr = '1'] = maanedStr.split('-');
    const d = new Date(parseInt(aarStr, 10), parseInt(mdStr, 10) - 1, 1);
    const mNavn = d.toLocaleDateString('da-DK', { month: 'long', year: 'numeric' });
    return mNavn.charAt(0).toUpperCase() + mNavn.slice(1);
  } catch {
    return maanedStr;
  }
}

export function IDagSide() {
  const navigate = useNavigate();
  const iDagStr = new Date().toISOString().slice(0, 10);
  const [valgtDato, setValgtDatoState] = useState<string>(() => {
    try {
      return sessionStorage.getItem('stald_valgt_dato') || iDagStr;
    } catch {
      return iDagStr;
    }
  });

  const setValgtDato = (handling: string | ((prev: string) => string)) => {
    setValgtDatoState((prev) => {
      const nyDato = typeof handling === 'function' ? handling(prev) : handling;
      try {
        sessionStorage.setItem('stald_valgt_dato', nyDato);
      } catch {}
      return nyDato;
    });
  };

  const [holdData, setHoldData] = useState<HoldKortData[]>([]);
  const [indlaeser, setIndlaeser] = useState(true);
  const [erVikar, setErVikar] = useState(false);

  // Tjek brugerens rolle
  useEffect(() => {
    const tjekRolle = async () => {
      const sessionPost = await db.meta.get('aktiv_session');
      if (sessionPost?.vaerdi?.roller?.includes('Vikar')) {
        setErVikar(true);
        // Tving altid dato til i dag for en vikar
        setValgtDato(iDagStr);
      }
    };
    tjekRolle();
  }, [iDagStr]);

  // Månedskalender og programnavigation
  const [kalenderData, setKalenderData] = useState<Record<string, number>>({});
  const [visKalenderModal, setVisKalenderModal] = useState(false);
  const [kalenderMaaned, setKalenderMaaned] = useState<string>(valgtDato.slice(0, 7));

  const hentKalenderOversigt = async (maanedStr: string) => {
    try {
      const enhedNoegle = localStorage.getItem('ridecenter_enhedsnoegle') ?? 'demo-enhedsnoegle-stald-tablet-1';
      const res = await fetch(`/api/v1/stald/kalender/${maanedStr}`, {
        headers: { 'X-Enhed-Noegle': enhedNoegle },
      });
      if (res.ok) {
        const data: Array<{ dato: string; antalLektioner: number }> = await res.json();
        const map: Record<string, number> = {};
        for (const item of data) {
          map[item.dato] = item.antalLektioner;
        }
        setKalenderData(map);
        return;
      }
    } catch {}

    try {
      const alleL = await db.lektioner.toArray();
      const map: Record<string, number> = {};
      for (const l of alleL) {
        if (l.dato.startsWith(maanedStr)) {
          map[l.dato] = (map[l.dato] ?? 0) + 1;
        }
      }
      setKalenderData(map);
    } catch {}
  };

  useEffect(() => {
    hentKalenderOversigt(kalenderMaaned);
  }, [kalenderMaaned]);

  const programDatoer = Object.keys(kalenderData).sort();
  const forrigeProgramDato = [...programDatoer].reverse().find((d) => d < valgtDato);
  const naesteProgramDato = programDatoer.find((d) => d > valgtDato);

  const gaaTilForrigeProgram = () => {
    if (forrigeProgramDato) {
      setValgtDato(forrigeProgramDato);
    } else {
      setValgtDato((d) => justerDato(d, -1));
    }
  };

  const gaaTilNaesteProgram = () => {
    if (naesteProgramDato) {
      setValgtDato(naesteProgramDato);
    } else {
      setValgtDato((d) => justerDato(d, 1));
    }
  };

  const kalenderDage = (() => {
    const [aarStr = '2026', mdStr = '1'] = kalenderMaaned.split('-');
    const aar = parseInt(aarStr, 10);
    const md = parseInt(mdStr, 10);
    const foersteDato = new Date(aar, md - 1, 1);
    const sidsteDag = new Date(aar, md, 0).getDate();

    let startUgedag = foersteDato.getDay() - 1;
    if (startUgedag === -1) startUgedag = 6;

    const celler: Array<{ dag?: number; datoStr?: string; antalHold?: number }> = [];
    for (let i = 0; i < startUgedag; i++) {
      celler.push({});
    }

    const pad = (n: number) => String(n).padStart(2, '0');
    for (let dag = 1; dag <= sidsteDag; dag++) {
      const dStr = `${aar}-${pad(md)}-${pad(dag)}`;
      const antalHold = kalenderData[dStr] ?? 0;
      celler.push({ dag, datoStr: dStr, antalHold });
    }

    return celler;
  })();

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
                    rytterStatus: p.rytter_status,
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
      {/* Dato navigation bar - 2 rækker for optimal tablet-plads */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-lg space-y-4">
        {/* Række 1: Fuldbredde datospecifikation uden multiline squeeze */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📅</span>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2 flex-wrap">
                <span>{formaterDatoDansk(valgtDato)}</span>
                {erIDag && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-sky-950 text-sky-300 border border-sky-700 font-bold tracking-normal">
                    Dagens program
                  </span>
                )}
              </h1>
            </div>
          </div>

          {erVikar && (
            <span className="px-3.5 py-1.5 rounded-xl bg-sky-950/80 border border-sky-800 text-sky-300 text-xs font-bold flex items-center gap-1.5">
              <span>🔒</span>
              <span>Vikar: Dagens program</span>
            </span>
          )}
        </div>

        {/* Række 2: Store, handskevenlige navigations- og kalenderknapper */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {!erVikar ? (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={gaaTilForrigeProgram}
                className="min-h-[48px] px-4 rounded-xl bg-slate-800 hover:bg-slate-750 active:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-sm flex items-center gap-2 transition cursor-pointer shadow-sm active:scale-95"
                title="Gå til forrige dato med hold"
              >
                <span className="text-base font-black">←</span>
                <span>Forrige program</span>
              </button>

              <button
                type="button"
                onClick={() => setValgtDato(iDagStr)}
                className={`min-h-[48px] px-5 rounded-xl font-bold text-sm border transition cursor-pointer shadow-sm active:scale-95 ${
                  erIDag
                    ? 'bg-sky-600 text-white border-sky-400 shadow-md ring-2 ring-sky-500/40'
                    : 'bg-slate-800 hover:bg-slate-750 text-slate-300 border-slate-700'
                }`}
              >
                I dag
              </button>

              <button
                type="button"
                onClick={gaaTilNaesteProgram}
                className="min-h-[48px] px-4 rounded-xl bg-slate-800 hover:bg-slate-750 active:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-sm flex items-center gap-2 transition cursor-pointer shadow-sm active:scale-95"
                title="Gå til næste dato med hold"
              >
                <span>Næste program</span>
                <span className="text-base font-black">→</span>
              </button>
            </div>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2.5 ml-auto">
            {!erVikar && (
              <button
                type="button"
                onClick={() => setVisKalenderModal(true)}
                className="min-h-[48px] px-4 rounded-xl bg-sky-950 hover:bg-sky-900 text-sky-200 border border-sky-700/80 font-bold text-sm flex items-center gap-2 transition cursor-pointer shadow-sm active:scale-95"
                title="Åbn månedskalender"
              >
                <span>📅</span>
                <span>Månedskalender</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => hentData(valgtDato, true)}
              className="min-h-[48px] px-4 rounded-xl bg-slate-800 hover:bg-slate-750 active:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-sm flex items-center gap-2 transition cursor-pointer shadow-sm active:scale-95"
              title="Genindlæs data fra serveren"
            >
              <span>🔄</span>
              <span>Opdater</span>
            </button>
          </div>
        </div>
      </div>

      {indlaeser ? (
        <div className="flex h-48 items-center justify-center">
          <div className="text-slate-400 font-medium animate-pulse">Indlæser lektioner...</div>
        </div>
      ) : holdData.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 p-10 text-center bg-slate-900/40 space-y-4">
          <div className="text-3xl">🗓️</div>
          <div>
            <h3 className="text-lg font-bold text-white">
              {erIDag ? 'Ingen hold i dag' : `Ingen lektioner for ${formaterDatoDansk(valgtDato)}`}
            </h3>
            <p className="text-slate-400 text-sm mt-1 max-w-md mx-auto">
              {erIDag
                ? 'Der er ikke planlagt undervisning i dag. Se næste program eller brug månedskalenderen.'
                : 'Der er ingen registrerede hold på denne dato.'}
            </p>
          </div>

          <div className="pt-2 flex flex-wrap justify-center gap-3">
            {naesteProgramDato && (
              <button
                type="button"
                onClick={() => setValgtDato(naesteProgramDato)}
                className="min-h-[44px] px-5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm shadow-lg shadow-sky-950/50 transition cursor-pointer flex items-center gap-2"
              >
                <span>Gå til næste program ({formaterDatoDansk(naesteProgramDato)})</span>
                <span>→</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setVisKalenderModal(true)}
              className="min-h-[44px] px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm border border-slate-700 transition cursor-pointer"
            >
              📅 Vælg fra månedskalender
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

      {/* Månedskalender Modal Pop-up */}
      {visKalenderModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setKalenderMaaned((m) => forskydMaanedStreng(m, -1))}
                  className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center font-bold cursor-pointer"
                  title="Forrige måned"
                >
                  ←
                </button>
                <h3 className="text-xl font-bold text-white px-2">
                  {formaterMaanedDansk(kalenderMaaned)}
                </h3>
                <button
                  type="button"
                  onClick={() => setKalenderMaaned((m) => forskydMaanedStreng(m, 1))}
                  className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center font-bold cursor-pointer"
                  title="Næste måned"
                >
                  →
                </button>
              </div>

              <button
                type="button"
                onClick={() => setVisKalenderModal(false)}
                className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center font-bold text-base cursor-pointer"
                title="Luk"
              >
                ✕
              </button>
            </div>

            {/* Ugedagsoverskrifter */}
            <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
              {['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'].map((dagNavn) => (
                <div key={dagNavn} className="py-1">
                  {dagNavn}
                </div>
              ))}
            </div>

            {/* Dage matrix */}
            <div className="grid grid-cols-7 gap-1.5">
              {kalenderDage.map((c, idx) => {
                if (!c.dag || !c.datoStr) {
                  return <div key={`tom-${idx}`} className="h-16" />;
                }

                const erValgt = c.datoStr === valgtDato;
                const erDagensDato = c.datoStr === iDagStr;
                const harHold = (c.antalHold ?? 0) > 0;

                return (
                  <button
                    key={c.datoStr}
                    type="button"
                    onClick={() => {
                      setValgtDato(c.datoStr!);
                      setVisKalenderModal(false);
                    }}
                    className={`h-16 rounded-xl border p-1 flex flex-col justify-between items-center transition cursor-pointer relative ${
                      erValgt
                        ? 'border-sky-400 bg-sky-950 ring-2 ring-sky-400 text-white shadow-md'
                        : harHold
                        ? 'border-emerald-800/80 bg-emerald-950/40 hover:bg-emerald-900/50 text-slate-200'
                        : 'border-slate-800/60 bg-slate-900/50 hover:bg-slate-800/60 text-slate-400'
                    }`}
                  >
                    <span className={`text-xs font-bold ${erDagensDato ? 'text-sky-400' : ''}`}>
                      {c.dag}
                    </span>

                    {harHold && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-900/90 text-emerald-300 border border-emerald-700/80 leading-none">
                        {c.antalHold} hold
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                <span>Dato med undervisning</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setValgtDato(iDagStr);
                  setVisKalenderModal(false);
                }}
                className="text-sky-400 hover:underline font-semibold cursor-pointer"
              >
                Gå til i dag
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
