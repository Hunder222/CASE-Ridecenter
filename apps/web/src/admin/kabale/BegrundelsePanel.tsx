import type { Hestetildeling } from '@ridecenter/contracts';
import type { Ref } from 'react';
import { Badge, type BadgeVariant } from '../../faelles/ui/Badge';

function variantFor(kode: string): BadgeVariant {
  if (kode.startsWith('HC') || kode === 'LEKTION_HEST_OPTAGET' || kode === 'IKKE_TILDELT_KAPACITET')
    return 'fejl';
  if (kode.startsWith('SC')) return 'info';
  return 'neutral';
}

/** Begrundelsen for den valgte tildeling (FR-010): dansk tekst, årsagskoder og turnus næste måned. */
export function BegrundelsePanel({
  tildeling,
  hesteNavne,
  ref,
}: {
  tildeling: Hestetildeling | undefined;
  hesteNavne: ReadonlyMap<string, string>;
  ref?: Ref<HTMLElement>;
}) {
  const koder = [...new Set((tildeling?.begrundelse_koder ?? []).map((kode) => kode.split(':')[0] ?? kode))];
  // Sticky på brede skærme, så panelet er synligt uanset hvor langt nede i holdtabellerne man klikker.
  return (
    <aside
      ref={ref}
      aria-label="Begrundelse"
      className="h-fit scroll-mt-4 self-start rounded-lg border border-stone-300 bg-white p-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto"
    >
      <h2 className="text-lg font-semibold">Begrundelse</h2>
      {!tildeling ? (
        <p className="mt-2 text-stone-700">Vælg en tildeling for at se begrundelsen.</p>
      ) : (
        <div className="mt-2 space-y-3">
          <p>
            <span className="font-medium">{tildeling.rytter_navn}</span>
            {' → '}
            {tildeling.hest_id ? (hesteNavne.get(tildeling.hest_id) ?? 'Ukendt hest') : 'Ikke tildelt'}
          </p>
          <p>{tildeling.begrundelse_tekst}</p>
          <ul aria-label="Årsagskoder" className="flex flex-wrap gap-1">
            {koder.map((kode) => (
              <li key={kode}>
                <Badge variant={variantFor(kode)}>{kode}</Badge>
              </li>
            ))}
          </ul>
          <p className="font-medium">Turnus næste måned: +{tildeling.turnus_naeste_maaned}</p>
        </div>
      )}
    </aside>
  );
}
