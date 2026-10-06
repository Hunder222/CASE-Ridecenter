import type { Hestetildeling, Hold, Tildelingskoersel } from '@ridecenter/contracts';
import { Badge } from '../../faelles/ui/Badge';
import { Knap } from '../../faelles/ui/Knap';
import { Tabel, Td, Th } from '../../faelles/ui/Tabel';

function Statusmaerker({ tildeling }: { tildeling: Hestetildeling }) {
  const koder = new Set(tildeling.begrundelse_koder.map((kode) => kode.split(':')[0]));
  return (
    <span className="flex flex-wrap gap-1">
      {tildeling.hest_id === null && <Badge variant="fejl">Ikke tildelt – kapacitetsmangel</Badge>}
      {tildeling.oenske_opfyldt !== null && <Badge variant="ok">{tildeling.oenske_opfyldt}. ønske</Badge>}
      {tildeling.er_alternativ_tildeling && (
        <Badge variant="advarsel">Alternativ tildeling (ønsker optaget)</Badge>
      )}
      {koder.has('PARTAFTALE') && <Badge variant="info">Partaftale</Badge>}
      {koder.has('PAAKRAEVET_HEST') && <Badge variant="info">Fast hest</Badge>}
      {tildeling.manuelt_justeret && <Badge>Manuelt justeret</Badge>}
    </span>
  );
}

/** Én tabel pr. hold sorteret på ugedag og starttid (T097). Klik på en række viser begrundelsen. */
export function HoldTabel({
  koersel,
  hold,
  hesteNavne,
  valgtId,
  onVaelg,
  onJuster,
}: {
  koersel: Tildelingskoersel;
  hold: readonly Hold[];
  hesteNavne: ReadonlyMap<string, string>;
  valgtId: string | null;
  onVaelg: (tildelingId: string) => void;
  /** Kun når kørslen er en kladde. */
  onJuster?: (tildeling: Hestetildeling) => void;
}) {
  const holdPrId = new Map(hold.map((h) => [h.id, h]));
  const grupper = new Map<string, Hestetildeling[]>();
  for (const t of koersel.tildelinger ?? []) grupper.set(t.hold_id, [...(grupper.get(t.hold_id) ?? []), t]);
  const sorterede = [...grupper].sort(([a], [b]) => {
    const [ha, hb] = [holdPrId.get(a), holdPrId.get(b)];
    return (ha?.ugedag ?? 8) - (hb?.ugedag ?? 8) || (ha?.starttid ?? '').localeCompare(hb?.starttid ?? '');
  });

  return (
    <div className="space-y-6">
      {sorterede.map(([holdId, tildelinger]) => (
        <Tabel key={holdId} titel={holdPrId.get(holdId)?.holdnavn ?? 'Hold'}>
          <thead>
            <tr>
              <Th>Rytter</Th>
              <Th>Hest</Th>
              <Th>Status</Th>
              {onJuster && (
                <Th>
                  <span className="sr-only">Handling</span>
                </Th>
              )}
            </tr>
          </thead>
          <tbody>
            {tildelinger.map((t) => (
              <tr
                key={t.id}
                tabIndex={0}
                onClick={() => onVaelg(t.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') onVaelg(t.id);
                }}
                className={`cursor-pointer hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-emerald-700 ${
                  t.id === valgtId ? 'bg-emerald-50' : ''
                }`}
              >
                <Td className="font-medium">{t.rytter_navn}</Td>
                <Td>{t.hest_id ? (hesteNavne.get(t.hest_id) ?? 'Ukendt hest') : '—'}</Td>
                <Td>
                  <Statusmaerker tildeling={t} />
                </Td>
                {onJuster && (
                  <Td className="text-right">
                    <Knap
                      variant="sekundaer"
                      onClick={(event) => {
                        event.stopPropagation();
                        onJuster(t);
                      }}
                    >
                      Justér
                    </Knap>
                  </Td>
                )}
              </tr>
            ))}
          </tbody>
        </Tabel>
      ))}
    </div>
  );
}
