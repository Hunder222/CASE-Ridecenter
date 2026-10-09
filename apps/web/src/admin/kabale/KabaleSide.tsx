import type { Hestetildeling, PubliceringSvar } from '@ridecenter/contracts';
import { useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { forskydMaaned, maanedNavn, naesteMaaned } from '../../faelles/maaned';
import { harRolle, useSession } from '../../faelles/session';
import { ApiFejl } from '../../faelles/api-klient';
import { Dialog } from '../../faelles/ui/Dialog';
import { FejlBesked } from '../../faelles/ui/FejlBesked';
import { Indlaeser } from '../../faelles/ui/Indlaeser';
import { Knap } from '../../faelles/ui/Knap';
import { useGodkend, useKandidater, useKoersel, useKoersler, useKoerTildeling, usePublicer, useSaertildelAlle } from '../api/kabale';
import { useHeste, useHold, useOensker, useRyttere } from '../api/stamdata';
import { BegrundelsePanel } from './BegrundelsePanel';
import { HestVaelger } from './HestVaelger';
import { HoldTabel } from './HoldTabel';
import { KoerselOversigt } from './KoerselOversigt';

function IkkeTildeltStatusBadge({
  koerselId,
  tildelingId,
}: {
  koerselId: string;
  tildelingId: string;
}) {
  const { data: kandidater, isLoading } = useKandidater(koerselId, tildelingId);

  if (isLoading) {
    return (
      <span className="inline-flex items-center rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600 border border-stone-200">
        Beregner…
      </span>
    );
  }

  const harMulighed = kandidater?.some((k) => k.lovlig) ?? false;

  if (harMulighed) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800 border border-amber-300">
        🟡 Dispensation mulig
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-800 border border-rose-300">
      🔴 Ingen dispensation mulig
    </span>
  );
}

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
    const partaftaleRyttere = aktiveRyttere.filter((r) => Boolean(r.partaftale_hest_id));
    const oenskeRyttere = aktiveRyttere.filter((r) => !r.partaftale_hest_id);
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

    for (const r of oenskeRyttere) {
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
      antalPartaftale: partaftaleRyttere.length,
      antalOenskeRyttere: oenskeRyttere.length,
      fuldtUdfyldt,
      delvistUdfyldt,
      mangler,
      topHeste,
    };
  }, [ryttere.data, oensker.data, hesteNavne]);

  if (ryttere.isLoading || oensker.isLoading) {
    return null;
  }

  const pct = stats.antalOenskeRyttere > 0 ? Math.round((stats.fuldtUdfyldt / stats.antalOenskeRyttere) * 100) : 0;

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

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-md bg-stone-50 p-2.5">
          <div className="text-xs font-medium text-stone-500">Aktive ryttere</div>
          <div className="mt-1 text-xl font-bold text-stone-800">{stats.totalAktive}</div>
          <div className="text-[11px] text-stone-500">i rideklubben</div>
        </div>
        <div className="rounded-md bg-sky-50 p-2.5">
          <div className="text-xs font-medium text-sky-800">Partaftale</div>
          <div className="mt-1 text-xl font-bold text-sky-700">{stats.antalPartaftale}</div>
          <div className="text-[11px] text-sky-600">fast hest</div>
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
  const [bekraeftDispensation, setBekraeftDispensation] = useState(false);
  const [bekraeftUfuldstaendigPublicering, setBekraeftUfuldstaendigPublicering] = useState(false);
  const [soegning, setSoegning] = useState('');

  // Saml overtrædelser fra databasen og fra evt. live godkend-fejl
  const godkendFejlBrud =
    godkend.error instanceof ApiFejl && godkend.error.kode === 'WELFARE_GUARD_FEJL'
      ? godkend.error.detaljer
      : [];
  const brud = Array.from(new Set([...(k?.welfare_guard_overtraedelser ?? []), ...godkendFejlBrud]));

  const erKunSoftConstraints =
    brud.length > 0 &&
    brud.every(
      (b) =>
        b.startsWith('HC08_NIVEAU_BEGYNDER') ||
        b.startsWith('HC08_NIVEAU_OEVET') ||
        b.startsWith('HC08_PART_UDEN_NIVEAUGODKENDELSE'),
    );
  const kanGodkendes = k?.status === 'Kladde' && (brud.length === 0 || erKunSoftConstraints);

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
        <nav aria-label="Måned" className="flex gap-1.5 items-center">
          <Link
            to={`/admin/kabale/${forskydMaaned(maaned, -1)}`}
            className="inline-flex items-center px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-stone-700 hover:bg-stone-50 hover:text-stone-900 text-xs font-semibold shadow-xs transition"
          >
            ← Forrige måned
          </Link>
          <Link
            to={`/admin/kabale/${forskydMaaned(maaned, 1)}`}
            className="inline-flex items-center px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-stone-700 hover:bg-stone-50 hover:text-stone-900 text-xs font-semibold shadow-xs transition"
          >
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
              className={`flex items-center justify-center rounded px-2.5 text-white transition-colors hover:bg-emerald-800 cursor-pointer ${
                reserverBegynderHeste || reserverSpringHeste ? 'bg-emerald-900 text-amber-300 font-bold' : ''
              }`}
            >
              <span className="text-base">⚙️</span>
            </button>
          </div>
          {k?.status === 'Kladde' && (
            brud.length === 0 ? (
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
            ) : erKunSoftConstraints ? (
              <button
                type="button"
                onClick={() => {
                  if (bekraeftDispensation) {
                    godkend.mutate({ id: k.id, tilladNiveauDispensation: true });
                  } else {
                    // Scroll ned til og fokuser på den gule dispensationskasse
                    document.getElementById('dispensations-advarsel')?.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                disabled={godkend.isPending}
                className={`min-h-[44px] px-5 rounded-lg font-bold text-base shadow-md transition-all flex items-center gap-2 cursor-pointer ${
                  bekraeftDispensation
                    ? 'bg-amber-600 hover:bg-amber-700 text-white ring-2 ring-amber-400/50'
                    : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300'
                }`}
                title={bekraeftDispensation ? 'Godkend kørsel med bekræftet dispensation' : 'Kræver bekræftelse af dispensation'}
              >
                <span>⚠️</span>
                <span>{godkend.isPending ? 'Godkender…' : bekraeftDispensation ? 'Godkend med dispensation' : 'Kræver dispensation'}</span>
              </button>
            ) : null
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
            className="font-medium underline hover:text-amber-950 cursor-pointer"
          >
            Nulstil
          </button>
        </div>
      )}

      {reserverSpringHeste && (
        <div className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <span>⚙️</span>
            <span>
              <strong>Aktiv indstilling:</strong> Spring-godkendte heste reserveres primært til springhold først.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setReserverSpringHeste(false)}
            className="font-medium underline hover:text-amber-950 cursor-pointer"
          >
            Nulstil
          </button>
        </div>
      )}

      {/* GUL DISPENSATIONSKASSE: Vises hvis der er soft constraints (niveau-advarsler) og kørslen er Kladde */}
      {k?.status === 'Kladde' && erKunSoftConstraints && (
        <div id="dispensations-advarsel" className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4 shadow-sm text-amber-950 space-y-3">
          <div className="flex items-start gap-3">
            <span className="text-2xl shrink-0">⚠️</span>
            <div className="space-y-1">
              <h3 className="font-bold text-sm text-amber-900">
                Planen indeholder {brud.length} hestetildelinger med niveau-dispensation (Soft constraints)
              </h3>
              <p className="text-xs text-amber-800 leading-relaxed">
                Der er tildelt heste til hold, hvor hesten ikke formelt er godkendt til niveauet (f.eks. mangel på begynderheste).
                Alle fysiske velfærdsregler (max lektioner/dag, max ryttervægt, hviledage osv.) overholdes fortsat 100%.
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-amber-200/80 flex items-center justify-between gap-3">
            <label className="flex items-center gap-2.5 text-xs font-semibold text-amber-950 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={bekraeftDispensation}
                onChange={(e) => setBekraeftDispensation(e.target.checked)}
                className="h-4 w-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500 cursor-pointer"
              />
              <span>Jeg bekræfter dispensation for uegnet hestetildeling (godkend via knappen foroven)</span>
            </label>
          </div>
        </div>
      )}

      {/* Skjul FejlBesked for WELFARE_GUARD_FEJL, hvis det udelukkende skyldes soft constraints, da den håndteres i den gule kasse */}
      {!(godkend.error && erKunSoftConstraints) && (
        <FejlBesked fejl={koer.error ?? godkend.error ?? publicer.error ?? koersler.error ?? koersel.error} />
      )}
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
            {/* Søgefelt til kabale (elever, heste, holdtitler såsom "mandag", "15:00", "Letøvet") */}
            <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-xl border border-stone-200 shadow-sm">
              <div className="relative flex-1">
                <input
                  type="search"
                  value={soegning}
                  onChange={(e) => setSoegning(e.target.value)}
                  placeholder="🔍 Søg efter elev, hest eller hold (f.eks. 'mandag', '15:00', 'Letøvet', 'Zigge')..."
                  className="w-full rounded-lg border border-stone-300 bg-stone-50 px-3.5 py-2 text-sm text-stone-900 placeholder-stone-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
              {soegning && (
                <button
                  type="button"
                  onClick={() => setSoegning('')}
                  className="text-xs font-semibold text-stone-500 hover:text-stone-800 cursor-pointer px-2 py-1 rounded hover:bg-stone-100"
                >
                  Ryd søgning
                </button>
              )}
            </div>
            <HoldTabel
              koersel={k}
              overtraedelser={brud}
              hold={hold.data ?? []}
              hesteNavne={hesteNavne}
              valgtId={valgtTildelingId}
              onVaelg={visBegrundelse}
              onJuster={k.status === 'Kladde' ? setJusterer : undefined}
              soegning={soegning}
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
            <div className="rounded-xl border border-amber-300 bg-amber-50/80 p-4 text-xs text-amber-950 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-200/80 pb-3">
                <span className="font-bold text-base sm:text-lg flex items-center gap-2 text-amber-950">
                  <span className="text-xl">💡</span>
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
                    className="!px-4 !py-2.5 text-sm font-bold bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white border-amber-600 shadow-md ring-2 ring-amber-400/50 shrink-0 cursor-pointer"
                  >
                    {saertildel.isPending ? 'Tildeler…' : '⚡ Særtildel alle (dispensation)'}
                  </Knap>
                )}
              </div>
              <p className="text-amber-900 leading-relaxed text-xs">
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
                            {k && <IkkeTildeltStatusBadge koerselId={k.id} tildelingId={t.id} />}
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
          <div className="space-y-4 text-sm text-stone-700">
            <p>
              Planen bliver til lektioner med pladser for alle hold i måneden. Erstatter den en tidligere plan,
              ændres kun lektioner fra i dag.
            </p>

            {k.statistik.ikke_tildelt > 0 && (
              <div className="rounded-xl border-2 border-rose-400 bg-rose-50 p-4 text-rose-950 space-y-3">
                <div className="flex items-start gap-2.5">
                  <span className="text-2xl shrink-0">⚠️</span>
                  <div>
                    <h4 className="font-bold text-sm text-rose-900">
                      Advarsel: {k.statistik.ikke_tildelt} elev(er) mangler hestetildeling
                    </h4>
                    <p className="text-xs text-rose-800 mt-1 leading-relaxed">
                      Planen indeholder elever, som ikke har fået tildelt en hest. Husk at have kontaktet forældre eller elever forud for publicering for at informere dem om situationen.
                    </p>
                  </div>
                </div>

                <label className="flex items-center gap-2.5 pt-2 border-t border-rose-200 text-xs font-bold text-rose-950 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={bekraeftUfuldstaendigPublicering}
                    onChange={(e) => setBekraeftUfuldstaendigPublicering(e.target.checked)}
                    className="h-4 w-4 rounded border-rose-400 text-rose-600 focus:ring-rose-500 cursor-pointer"
                  />
                  <span>Jeg bekræfter at publicere planen med manglende hestetildelinger og har kontaktet forældre</span>
                </label>
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2 pt-2 border-t border-stone-200">
              <Knap variant="sekundaer" onClick={() => setBekraefter(false)}>
                Annullér
              </Knap>
              <Knap
                disabled={publicer.isPending || (k.statistik.ikke_tildelt > 0 && !bekraeftUfuldstaendigPublicering)}
                onClick={() =>
                  publicer.mutate(k.id, {
                    onSuccess: (svar) => {
                      setPubliceret(svar);
                      setBekraefter(false);
                      setBekraeftUfuldstaendigPublicering(false);
                    },
                  })
                }
              >
                Publicér
              </Knap>
            </div>
          </div>
        </Dialog>
      )}
    </section>
  );
}
