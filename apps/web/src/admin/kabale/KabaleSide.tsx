import type { Hestetildeling, PubliceringSvar } from '@ridecenter/contracts';
import { useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { forskydMaaned, maanedNavn, naesteMaaned } from '../../faelles/maaned';
import { harRolle, useSession } from '../../faelles/session';
import { Dialog } from '../../faelles/ui/Dialog';
import { FejlBesked } from '../../faelles/ui/FejlBesked';
import { Indlaeser } from '../../faelles/ui/Indlaeser';
import { Knap } from '../../faelles/ui/Knap';
import { useGodkend, useKoersel, useKoersler, useKoerTildeling, usePublicer, useSaertildelAlle } from '../api/kabale';
import { useHeste, useHold, useOensker, useRyttere } from '../api/stamdata';
import { BegrundelsePanel } from './BegrundelsePanel';
import { HestVaelger } from './HestVaelger';
import { HoldTabel } from './HoldTabel';
import { KoerselOversigt } from './KoerselOversigt';

function ElevoenskeStatistik({
  maaned,
  hesteNavne,
}: {
  maaned: string;
  hesteNavne: Map<string, string>;
}) {
  const ryttere = useRyttere();
  const oensker = useOensker(maaned);

  const stats = useMemo(() => {
    const aktiveRyttere = (ryttere.data ?? []).filter((r) => r.aktiv_status === 'Aktiv');
    const oenskerListe = oensker.data ?? [];

    const prRytter = new Map<string, typeof oenskerListe>();
    for (const o of oenskerListe) {
      const arr = prRytter.get(o.rytter_id) ?? [];
      arr.push(o);
      prRytter.set(o.rytter_id, arr);
    }

    let fuldtUdfyldt = 0;
    let delvistUdfyldt = 0;
    let mangler = 0;

    for (const r of aktiveRyttere) {
      const count = prRytter.get(r.id)?.length ?? 0;
      if (count >= 3) fuldtUdfyldt++;
      else if (count > 0) delvistUdfyldt++;
      else mangler++;
    }

    const hestCount = new Map<string, { total: number; prio1: number }>();
    for (const o of oenskerListe) {
      const current = hestCount.get(o.oensket_hest_id) ?? { total: 0, prio1: 0 };
      current.total += 1;
      if (o.prioritet === 1) current.prio1 += 1;
      hestCount.set(o.oensket_hest_id, current);
    }

    const topHeste = Array.from(hestCount.entries())
      .map(([hestId, data]) => ({
        hestId,
        navn: hesteNavne.get(hestId) ?? 'Ukendt hest',
        total: data.total,
        prio1: data.prio1,
      }))
      .sort((a, b) => b.total - a.total || b.prio1 - a.prio1)
      .slice(0, 5);

    return {
      totalAktive: aktiveRyttere.length,
      fuldtUdfyldt,
      delvistUdfyldt,
      mangler,
      topHeste,
    };
  }, [ryttere.data, oensker.data, hesteNavne]);

  if (ryttere.isLoading || oensker.isLoading) {
    return null;
  }

  const pct = stats.totalAktive > 0 ? Math.round((stats.fuldtUdfyldt / stats.totalAktive) * 100) : 0;

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-3">
        <div>
          <h2 className="text-base font-semibold text-stone-900">
            Elevønsker for {maanedNavn(maaned)}
          </h2>
          <p className="text-xs text-stone-500">
            Statistik over indsamlede elevønsker før tildelingskabalen køres
          </p>
        </div>
        <Link
          to={`/admin/oensker/${maaned}`}
          className="rounded border border-stone-300 bg-stone-50 px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-100 hover:text-stone-900"
        >
          Administrer ønsker →
        </Link>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-md bg-stone-50 p-2.5">
          <div className="text-xs font-medium text-stone-500">Aktive ryttere</div>
          <div className="mt-1 text-xl font-bold text-stone-800">{stats.totalAktive}</div>
          <div className="text-[11px] text-stone-500">i rideklubben</div>
        </div>
        <div className="rounded-md bg-emerald-50 p-2.5">
          <div className="text-xs font-medium text-emerald-800">3 af 3 ønsker</div>
          <div className="mt-1 text-xl font-bold text-emerald-700">
            {stats.fuldtUdfyldt}{' '}
            <span className="text-xs font-normal text-emerald-600">({pct}%)</span>
          </div>
          <div className="text-[11px] text-emerald-600">klar til kabale</div>
        </div>
        <div className="rounded-md bg-amber-50 p-2.5">
          <div className="text-xs font-medium text-amber-800">1-2 ønsker</div>
          <div className="mt-1 text-xl font-bold text-amber-700">{stats.delvistUdfyldt}</div>
          <div className="text-[11px] text-amber-600">delvist udfyldt</div>
        </div>
        <div className="rounded-md bg-rose-50 p-2.5">
          <div className="text-xs font-medium text-rose-800">0 ønsker</div>
          <div className="mt-1 text-xl font-bold text-rose-700">{stats.mangler}</div>
          <div className="text-[11px] text-rose-600">mangler ønsker</div>
        </div>
      </div>

      {stats.topHeste.length > 0 && (
        <div className="mt-3 border-t border-stone-100 pt-3">
          <div className="text-xs font-medium text-stone-600">Mest populære heste for måneden:</div>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {stats.topHeste.map((h, i) => (
              <span
                key={h.hestId}
                className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs text-stone-700"
              >
                <span className="font-semibold text-stone-500">#{i + 1}</span>
                <span className="font-medium text-stone-900">{h.navn}</span>
                <span className="rounded bg-stone-200 px-1.5 py-0.5 text-[10px] font-bold text-stone-700">
                  {h.total} {h.total === 1 ? 'ønske' : 'ønsker'} ({h.prio1} som 1. valg)
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const linkStil = 'rounded px-2 py-1 text-emerald-800 underline hover:bg-stone-100';

/** Kabalen for en måned (US2, T097): kør → justér → godkend → publicér. */
export function KabaleSide() {
  const { maaned = naesteMaaned() } = useParams();
  const { data: session } = useSession();
  const koersler = useKoersler(maaned);
  const [valg, setValg] = useState<{ maaned: string; id: string } | null>(null);
  const koerselId = (valg?.maaned === maaned ? valg.id : null) ?? koersler.data?.[0]?.id ?? null;
  const koersel = useKoersel(koerselId);
  const heste = useHeste();
  const hold = useHold();
  const koer = useKoerTildeling();
  const godkend = useGodkend();
  const publicer = usePublicer();
  const saertildel = useSaertildelAlle(koerselId ?? '');
  const [valgtTildelingId, setValgtTildelingId] = useState<string | null>(null);
  const [justerer, setJusterer] = useState<Hestetildeling | null>(null);
  const [bekraefter, setBekraefter] = useState(false);
  const [publiceret, setPubliceret] = useState<PubliceringSvar | null>(null);
  const hesteNavne = useMemo(() => new Map((heste.data ?? []).map((h) => [h.id, h.navn])), [heste.data]);
  const begrundelseRef = useRef<HTMLElement>(null);

  /** Klik på en række: vis begrundelsen (T097). Panelet rulles ind, hvis det ligger uden for skærmen. */
  function visBegrundelse(tildelingId: string) {
    setValgtTildelingId(tildelingId);
    begrundelseRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  const k = koersel.data;
  const valgt = k?.tildelinger?.find((t) => t.id === valgtTildelingId);

  const [visIndstillinger, setVisIndstillinger] = useState(false);
  const [reserverBegynderHeste, setReserverBegynderHeste] = useState(false);
  const [reserverSpringHeste, setReserverSpringHeste] = useState(false);
  const [visIkkeTildeltModal, setVisIkkeTildeltModal] = useState(false);

  function koerTildeling() {
    koer.mutate(
      { maaned, reserverBegynderHeste, reserverSpringHeste },
      {
        onSuccess: (ny) => {
          setValg({ maaned, id: ny.id });
          setValgtTildelingId(null);
          setPubliceret(null);
        },
      },
    );
  }

  // Find hold og elever uden tildelt hest (ikke_tildelt)
  const ikkeTildelte = useMemo(() => {
    if (!k?.tildelinger) return [];
    return k.tildelinger.filter((t) => t.hest_id === null);
  }, [k?.tildelinger]);

  const ikkeTildelteGrupperet = useMemo(() => {
    const holdMap = new Map((hold.data ?? []).map((h) => [h.id, h]));
    const map = new Map<string, { holdNavn: string; tidspunkt: string; tildelinger: Hestetildeling[] }>();

    for (const t of ikkeTildelte) {
      const h = holdMap.get(t.hold_id);
      const holdNavn = h?.holdnavn ?? 'Ukendt hold';
      const tidspunkt = h ? `Dag ${h.ugedag} kl. ${h.starttid}` : '';
      const entry = map.get(t.hold_id) ?? { holdNavn, tidspunkt, tildelinger: [] };
      entry.tildelinger.push(t);
      map.set(t.hold_id, entry);
    }
    return Array.from(map.values());
  }, [ikkeTildelte, hold.data]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Kabalen – {maanedNavn(maaned)}</h1>
        <nav aria-label="Måned" className="flex gap-1">
          <Link to={`/admin/kabale/${forskydMaaned(maaned, -1)}`} className={linkStil}>
            ← Forrige måned
          </Link>
          <Link to={`/admin/kabale/${forskydMaaned(maaned, 1)}`} className={linkStil}>
            Næste måned →
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-2.5">
          <div className="inline-flex rounded-lg border border-emerald-600 bg-emerald-700 p-0.5 shadow-sm">
            <Knap
              onClick={koerTildeling}
              disabled={koer.isPending}
              className="!border-0 !bg-transparent text-white hover:!bg-emerald-800"
            >
              {koer.isPending ? 'Kører…' : 'Kør tildeling'}
            </Knap>
            <button
              type="button"
              onClick={() => setVisIndstillinger(true)}
              title="Indstillinger til tildeling"
              className={`flex items-center justify-center rounded px-2.5 text-white transition-colors hover:bg-emerald-800 ${
                reserverBegynderHeste ? 'bg-emerald-900 text-amber-300 font-bold' : ''
              }`}
            >
              <span className="text-base">⚙️</span>
            </button>
          </div>
          {k?.status === 'Kladde' && k.welfare_guard_overtraedelser.length === 0 && (
            <button
              type="button"
              onClick={() => godkend.mutate(k.id)}
              disabled={godkend.isPending}
              className="min-h-[44px] px-5 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-base shadow-md shadow-blue-900/20 transition-all hover:scale-[1.02] cursor-pointer flex items-center gap-2 ring-2 ring-blue-400/50"
              title="Godkend denne kørsel som gyldig plan"
            >
              <span>✓</span>
              <span>{godkend.isPending ? 'Godkender…' : 'Godkend kørsel'}</span>
            </button>
          )}
          {k?.status === 'Godkendt' && harRolle(session, 'Ledelse') && (
            <Knap onClick={() => setBekraefter(true)}>Publicér</Knap>
          )}
        </div>
      </div>

      {k?.status === 'Kladde' && (
        <div className="flex items-center justify-between rounded-xl border-2 border-blue-400 bg-blue-50 px-4 py-3 text-sm text-blue-950 shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">ℹ️</span>
            <div>
              <strong className="font-bold">Planen er i status: Kladde.</strong>
              <span className="ml-1 text-blue-900">
                Gennemgå holdene og justér eventuelle pladser. Når du er tilfreds, tryk på den store blå{' '}
                <strong>&quot;Godkend kørsel&quot;</strong> knap foroven.
              </span>
            </div>
          </div>
        </div>
      )}

      {reserverBegynderHeste && (
        <div className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <span>⚙️</span>
            <span>
              <strong>Aktiv indstilling:</strong> Begynder-godkendte heste reserveres primært til begynder- og trækhold.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setReserverBegynderHeste(false)}
            className="font-medium underline hover:text-amber-950"
          >
            Nulstil
          </button>
        </div>
      )}

      <FejlBesked fejl={koer.error ?? godkend.error ?? publicer.error ?? koersler.error ?? koersel.error} />
      {publiceret && (
        <p
          role="status"
          className="rounded border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-900"
        >
          Publiceret – {publiceret.antal_lektioner} lektioner oprettet
        </p>
      )}

      <ElevoenskeStatistik maaned={maaned} hesteNavne={hesteNavne} />

      {koer.isPending && <Indlaeser tekst="Kabalen lægges…" />}
      {!k && !koersler.isPending && !koer.isPending && (
        <p className="text-stone-700">
          Der er ingen kørsel for {maanedNavn(maaned)} endnu. Klik på "Kør tildeling".
        </p>
      )}

      {k && (
        <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
          <div className="space-y-4">
            <KoerselOversigt
              koersel={k}
              hesteNavne={hesteNavne}
              onVisIkkeTildelt={() => setVisIkkeTildeltModal(true)}
            />
            <HoldTabel
              koersel={k}
              hold={hold.data ?? []}
              hesteNavne={hesteNavne}
              valgtId={valgtTildelingId}
              onVaelg={visBegrundelse}
              onJuster={k.status === 'Kladde' ? setJusterer : undefined}
            />
          </div>
          <BegrundelsePanel ref={begrundelseRef} tildeling={valgt} hesteNavne={hesteNavne} />
        </div>
      )}

      {justerer && k && (
        <HestVaelger
          koerselId={k.id}
          tildeling={justerer}
          tilladNiveauDispensation={justerer.hest_id === null}
          onLuk={() => setJusterer(null)}
        />
      )}

      {visIkkeTildeltModal && (
        <Dialog
          aaben
          titel={`Elever uden hestetildeling (${ikkeTildelte.length})`}
          onLuk={() => setVisIkkeTildeltModal(false)}
        >
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1 text-sm">
            <div className="rounded-xl border border-amber-300 bg-amber-50/80 p-3.5 text-xs text-amber-950 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/80 pb-2">
                <span className="font-bold flex items-center gap-1.5 text-amber-900">
                  <span>💡</span>
                  <span>Særtilladelse (Soft constraint)</span>
                </span>
                {k?.status === 'Kladde' && ikkeTildelte.length > 0 && (
                  <Knap
                    disabled={saertildel.isPending}
                    onClick={() => {
                      saertildel.mutate(undefined, {
                        onSuccess: (svar) => {
                          alert(`${svar.antal_tildelt} elev(er) blev tildelt hest med særtilladelse.`);
                        },
                        onError: () => {
                          alert('Kunne ikke gennemføre automatisk særtildeling');
                        },
                      });
                    }}
                    className="!px-3 !py-1 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white border-amber-600 shrink-0"
                  >
                    {saertildel.isPending ? 'Tildeler…' : '⚡ Særtildel alle (dispensation)'}
                  </Knap>
                )}
              </div>
              <p className="text-amber-900 leading-relaxed">
                Niveau-mismatch betragtes som en <strong>soft constraint</strong> (et pædagogisk/uddannelsesmæssigt hensyn), da det ikke bryder hestevelfærden (fysiske grænser som max ryttervægt, dagsbelastning og hviledage overholdes stadig 100%). Elever og ridelærere skal blot være opmærksomme på hesten under lektionen.
              </p>
            </div>

            <p className="text-stone-600 text-xs">
              Disse elever har ikke kunnet få tildelt en hest automatisk pga. kapacitetsmangel.
              Du kan trykke på <strong>&quot;Justér&quot;</strong> for at tildele en hest manuelt med niveau-dispensation, eller bruge knappen ovenfor for automatisk særtildeling.
            </p>

            {ikkeTildelteGrupperet.length === 0 ? (
              <p className="text-emerald-700 font-semibold py-4">Alle elever har fået tildelt en hest! 🎉</p>
            ) : (
              ikkeTildelteGrupperet.map((grp) => (
                <div key={grp.holdNavn} className="space-y-2">
                  <div className="font-bold text-stone-900 border-b border-stone-200 pb-1 flex items-center justify-between">
                    <span>{grp.holdNavn}</span>
                    <span className="text-xs font-normal text-stone-500">{grp.tidspunkt}</span>
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-stone-200 text-stone-500">
                        <th className="py-2 font-semibold">Rytter</th>
                        <th className="py-2 font-semibold">Hest</th>
                        <th className="py-2 font-semibold">Status</th>
                        <th className="py-2 font-semibold text-right">Handling</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {grp.tildelinger.map((t) => (
                        <tr key={t.id} className="hover:bg-stone-50">
                          <td className="py-2.5 font-medium text-stone-900">{t.rytter_navn}</td>
                          <td className="py-2.5 text-stone-500">—</td>
                          <td className="py-2.5">
                            <span className="inline-flex rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700 border border-rose-200">
                              Ikke tildelt – kapacitetsmangel
                            </span>
                          </td>
                          <td className="py-2.5 text-right">
                            <Knap
                              variant="sekundaer"
                              className="!px-2.5 !py-1 text-xs font-bold"
                              onClick={() => {
                                setJusterer(t);
                                setVisIkkeTildeltModal(false);
                              }}
                            >
                              Justér
                            </Knap>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))
            )}
          </div>
          <div className="mt-5 flex justify-end gap-2 border-t border-stone-200 pt-3">
            <Knap onClick={() => setVisIkkeTildeltModal(false)}>Luk</Knap>
          </div>
        </Dialog>
      )}

      {visIndstillinger && (
        <Dialog aaben titel="Indstillinger til tildelingskabalen" onLuk={() => setVisIndstillinger(false)}>
          <div className="space-y-4 text-sm text-stone-700">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={reserverBegynderHeste}
                onChange={(e) => setReserverBegynderHeste(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
              />
              <div>
                <div className="font-semibold text-stone-900">Reserver begynder-heste til begynderhold først</div>
                <p className="text-xs text-stone-500 mt-0.5">
                  Prioriterer tildeling til Begynder- og Trækhold først, og styrer øvede ryttere over på andre egnede heste, så begynderhestene ikke optages forud for holdets behov.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer border-t border-stone-100 pt-3">
              <input
                type="checkbox"
                checked={reserverSpringHeste}
                onChange={(e) => setReserverSpringHeste(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
              />
              <div>
                <div className="font-semibold text-stone-900">Reserver spring-heste til springhold først</div>
                <p className="text-xs text-stone-500 mt-0.5">
                  Prioriterer springhold først i køen og reserverer heste, der må springe, så de ikke bruges på almindelige dressur- eller begynderhold, hvis der er kapacitetsmangel til spring.
                </p>
              </div>
            </label>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Knap onClick={() => setVisIndstillinger(false)}>Luk</Knap>
          </div>
        </Dialog>
      )}
      {bekraefter && k && (
        <Dialog aaben titel={`Publicér planen for ${maanedNavn(maaned)}`} onLuk={() => setBekraefter(false)}>
          <p>
            Planen bliver til lektioner med pladser for alle hold i måneden. Erstatter den en tidligere plan,
            ændres kun lektioner fra i dag.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Knap variant="sekundaer" onClick={() => setBekraefter(false)}>
              Annullér
            </Knap>
            <Knap
              disabled={publicer.isPending}
              onClick={() =>
                publicer.mutate(k.id, {
                  onSuccess: (svar) => {
                    setPubliceret(svar);
                    setBekraefter(false);
                  },
                })
              }
            >
              Publicér
            </Knap>
          </div>
        </Dialog>
      )}
    </section>
  );
}
