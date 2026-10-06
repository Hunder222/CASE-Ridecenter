import type { Tildelingskoersel } from '@ridecenter/contracts';
import { Badge, type BadgeVariant } from '../../faelles/ui/Badge';

const STATUSFARVE: Record<Tildelingskoersel['status'], BadgeVariant> = {
  Kladde: 'info',
  Afvist: 'fejl',
  Godkendt: 'ok',
  Publiceret: 'ok',
  Forkastet: 'neutral',
};

/** Status, varighed (SC-004), Welfare Guard-resultat og statistik for kørslen (T096). */
export function KoerselOversigt({ koersel }: { koersel: Tildelingskoersel }) {
  const brud = koersel.welfare_guard_overtraedelser;
  const { statistik } = koersel;
  const tal: [string, number][] = [
    ['1. ønske', statistik.oenske_1],
    ['2. ønske', statistik.oenske_2],
    ['3. ønske', statistik.oenske_3],
    ['Alternativ', statistik.alternativ],
    ['Ikke tildelt', statistik.ikke_tildelt],
  ];
  return (
    <section aria-label="Kørslen" className="rounded-lg border border-stone-300 bg-white p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={STATUSFARVE[koersel.status]}>{koersel.status}</Badge>
        <span>Beregnet på {koersel.varighed_ms} ms</span>
        {brud.length === 0 ? (
          <Badge variant="ok">Welfare Guard: 0 overtrædelser</Badge>
        ) : (
          <Badge variant="fejl">Welfare Guard: {brud.length} overtrædelser</Badge>
        )}
        <span className="text-sm text-stone-700">Motor {koersel.solver_version}</span>
      </div>
      {brud.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-sm text-red-900">
          {brud.map((kode) => (
            <li key={kode}>{kode}</li>
          ))}
        </ul>
      )}
      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {tal.map(([label, antal]) => (
          <div key={label}>
            <dt className="text-sm text-stone-700">{label}</dt>
            <dd className="text-2xl font-semibold">{antal}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
