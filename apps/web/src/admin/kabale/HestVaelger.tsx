import type { Hestetildeling } from '@ridecenter/contracts';
import { Dialog } from '../../faelles/ui/Dialog';
import { FejlBesked } from '../../faelles/ui/FejlBesked';
import { Indlaeser } from '../../faelles/ui/Indlaeser';
import { useJusterTildeling, useKandidater } from '../api/kabale';

/**
 * Manuel justering med live Welfare Guard (T095, FR-008). Lovlige heste kan vælges. Ulovlige heste er grå og
 * deaktiverede med begrundelsen. Reglerne har ingen undtagelser i brugerfladen (Princip I).
 */
export function HestVaelger({
  koerselId,
  tildeling,
  onLuk,
}: {
  koerselId: string;
  tildeling: Hestetildeling;
  onLuk: () => void;
}) {
  const kandidater = useKandidater(koerselId, tildeling.id);
  const juster = useJusterTildeling(koerselId);

  return (
    <Dialog aaben titel={`Vælg hest til ${tildeling.rytter_navn}`} onLuk={onLuk}>
      {kandidater.isPending && <Indlaeser tekst="Henter heste…" />}
      <FejlBesked fejl={kandidater.error ?? juster.error} />
      {kandidater.data && (
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {kandidater.data.map((kandidat) => (
            <li key={kandidat.hest_id}>
              <button
                type="button"
                disabled={!kandidat.lovlig || juster.isPending}
                onClick={() =>
                  juster.mutate({ tildelingId: tildeling.id, hestId: kandidat.hest_id }, { onSuccess: onLuk })
                }
                className={`h-full w-full rounded border px-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-emerald-700 ${
                  kandidat.lovlig
                    ? 'border-emerald-700 bg-white hover:bg-emerald-50'
                    : 'cursor-not-allowed border-stone-300 bg-stone-100 text-stone-500'
                }`}
              >
                <span className="block font-semibold">
                  {kandidat.navn}
                  {kandidat.hest_id === tildeling.hest_id && ' (nuværende)'}
                </span>
                {!kandidat.lovlig && <span className="mt-1 block text-sm">{kandidat.begrundelse_tekst}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
