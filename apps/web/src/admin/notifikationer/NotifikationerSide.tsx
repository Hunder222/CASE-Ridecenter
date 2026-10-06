import type { DashboardNotifikation } from '@ridecenter/contracts';
import { Link } from 'react-router';
import { maanedNavn } from '../../faelles/maaned';
import { Badge } from '../../faelles/ui/Badge';
import { FejlBesked } from '../../faelles/ui/FejlBesked';
import { Indlaeser } from '../../faelles/ui/Indlaeser';
import { Knap } from '../../faelles/ui/Knap';
import { useKvitter, useNotifikationer } from '../api/kabale';

function genitiv(navn: string): string {
  return /[sxz]$/i.test(navn) ? `${navn}'` : `${navn}s`;
}

function Tekst({ notifikation }: { notifikation: DashboardNotifikation }) {
  const felt = (noegle: string) => {
    const vaerdi = notifikation.payload[noegle];
    return typeof vaerdi === 'string' || typeof vaerdi === 'number' ? String(vaerdi) : '';
  };
  const maaned = felt('maaned');
  const maanedTekst = /^\d{4}-\d{2}$/.test(maaned) ? maanedNavn(maaned) : maaned;
  switch (notifikation.type) {
    case 'KAPACITETSMANGEL':
      return (
        <p>
          {felt('holdnavn')}: {felt('antal')} ryttere uden lovlig hest i {maanedTekst}.{' '}
          <Link to={`/admin/kabale/${maaned}`} className="text-emerald-800 underline">
            Åbn kabalen
          </Link>
        </p>
      );
    case 'PARTAFTALE_MANGLER_NIVEAUGODKENDELSE':
      return (
        <p>
          {genitiv(felt('rytter_navn'))} partaftale ({felt('hest_navn')}) mangler niveaugodkendelse.{' '}
          <Link to={`/admin/ryttere/${felt('rytter_id')}`} className="text-emerald-800 underline">
            Åbn rytteren
          </Link>
        </p>
      );
    default:
      return (
        <p>
          {notifikation.type}: {JSON.stringify(notifikation.payload)}
        </p>
      );
  }
}

/** Dashboardnotifikationer (kun Ledelse, T098). Ukvitterede vises først. */
export function NotifikationerSide() {
  const notifikationer = useNotifikationer();
  const kvitter = useKvitter();
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Notifikationer</h1>
      <FejlBesked fejl={notifikationer.error ?? kvitter.error} />
      {notifikationer.isPending && <Indlaeser />}
      {notifikationer.data?.length === 0 && <p>Der er ingen notifikationer.</p>}
      <ul className="space-y-2">
        {notifikationer.data?.map((n) => (
          <li
            key={n.id}
            className={`flex flex-wrap items-center gap-3 rounded border px-4 py-3 ${
              n.kvitteret ? 'border-stone-200 bg-stone-50 text-stone-700' : 'border-amber-300 bg-white'
            }`}
          >
            <Tekst notifikation={n} />
            <span className="text-sm text-stone-700">{new Date(n.oprettet).toLocaleString('da-DK')}</span>
            <span className="ml-auto">
              {n.kvitteret ? (
                <Badge>Kvitteret</Badge>
              ) : (
                <Knap variant="sekundaer" onClick={() => kvitter.mutate(n.id)} disabled={kvitter.isPending}>
                  Kvittér
                </Knap>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
