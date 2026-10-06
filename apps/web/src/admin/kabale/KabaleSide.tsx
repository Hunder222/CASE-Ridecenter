import type { Hestetildeling, PubliceringSvar } from '@ridecenter/contracts';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { forskydMaaned, maanedNavn, naesteMaaned } from '../../faelles/maaned';
import { harRolle, useSession } from '../../faelles/session';
import { Dialog } from '../../faelles/ui/Dialog';
import { FejlBesked } from '../../faelles/ui/FejlBesked';
import { Indlaeser } from '../../faelles/ui/Indlaeser';
import { Knap } from '../../faelles/ui/Knap';
import { useGodkend, useKoersel, useKoersler, useKoerTildeling, usePublicer } from '../api/kabale';
import { useHeste, useHold } from '../api/stamdata';
import { BegrundelsePanel } from './BegrundelsePanel';
import { HestVaelger } from './HestVaelger';
import { HoldTabel } from './HoldTabel';
import { KoerselOversigt } from './KoerselOversigt';

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
  const [valgtTildelingId, setValgtTildelingId] = useState<string | null>(null);
  const [justerer, setJusterer] = useState<Hestetildeling | null>(null);
  const [bekraefter, setBekraefter] = useState(false);
  const [publiceret, setPubliceret] = useState<PubliceringSvar | null>(null);
  const hesteNavne = useMemo(() => new Map((heste.data ?? []).map((h) => [h.id, h.navn])), [heste.data]);

  const k = koersel.data;
  const valgt = k?.tildelinger?.find((t) => t.id === valgtTildelingId);

  function koerTildeling() {
    koer.mutate(maaned, {
      onSuccess: (ny) => {
        setValg({ maaned, id: ny.id });
        setValgtTildelingId(null);
        setPubliceret(null);
      },
    });
  }

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
        <div className="ml-auto flex gap-2">
          <Knap onClick={koerTildeling} disabled={koer.isPending}>
            Kør tildeling
          </Knap>
          {k?.status === 'Kladde' && k.welfare_guard_overtraedelser.length === 0 && (
            <Knap variant="sekundaer" onClick={() => godkend.mutate(k.id)} disabled={godkend.isPending}>
              Godkend
            </Knap>
          )}
          {k?.status === 'Godkendt' && harRolle(session, 'Ledelse') && (
            <Knap onClick={() => setBekraefter(true)}>Publicér</Knap>
          )}
        </div>
      </div>

      <FejlBesked fejl={koer.error ?? godkend.error ?? publicer.error ?? koersler.error ?? koersel.error} />
      {publiceret && (
        <p
          role="status"
          className="rounded border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-900"
        >
          Publiceret – {publiceret.antal_lektioner} lektioner oprettet
        </p>
      )}
      {koer.isPending && <Indlaeser tekst="Kabalen lægges…" />}
      {!k && !koersler.isPending && !koer.isPending && (
        <p className="text-stone-700">
          Der er ingen kørsel for {maanedNavn(maaned)} endnu. Klik på "Kør tildeling".
        </p>
      )}

      {k && (
        <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
          <div className="space-y-4">
            <KoerselOversigt koersel={k} />
            <HoldTabel
              koersel={k}
              hold={hold.data ?? []}
              hesteNavne={hesteNavne}
              valgtId={valgtTildelingId}
              onVaelg={setValgtTildelingId}
              onJuster={k.status === 'Kladde' ? setJusterer : undefined}
            />
          </div>
          <BegrundelsePanel tildeling={valgt} hesteNavne={hesteNavne} />
        </div>
      )}

      {justerer && k && <HestVaelger koerselId={k.id} tildeling={justerer} onLuk={() => setJusterer(null)} />}
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
