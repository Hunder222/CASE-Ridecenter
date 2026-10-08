import type { Hestetildeling, Hold, Tildelingskoersel } from '@ridecenter/contracts';
import { Badge } from '../../faelles/ui/Badge';
import { Knap } from '../../faelles/ui/Knap';
import { Tabel, Td, Th } from '../../faelles/ui/Tabel';

function Statusmaerker({
  tildeling,
  koerselOvertraedelser,
}: {
  tildeling: Hestetildeling;
  koerselOvertraedelser: readonly string[];
}) {
  const koder = new Set(tildeling.begrundelse_koder.map((kode) => kode.split(':')[0]));

  // En tildeling er kun et reelt velfærdsbrud hvis:
  // 1. Kørslens samlede Welfare Guard-kontrol rent faktisk har registreret overtrædelser med hesten, ELLER
  // 2. Tildelingen eksplicit har brud i en historisk/manuel plan (hvor Welfare Guard fandt brud).
  // Bemærk: Bløde forklaringer (hvorfor 1. ønske ikke blev opfyldt for rytteren) må IKKE markere den tildelte hest som fejl!
  const hestId = tildeling.hest_id;
  const harVelfaerdsbrud =
    Boolean(hestId) &&
    koerselOvertraedelser.length > 0 &&
    koerselOvertraedelser.some((b) => {
      const [basis, hId] = b.split(':');
      if (hId) return hId === hestId;
      // Hvis koden ikke er kvalificeret med hest-id, tjek om tildelingens egne begrundelseskoder indeholder den
      return koder.has(basis);
    });

  return (
    <span className="flex flex-wrap gap-1">
      {harVelfaerdsbrud && <Badge variant="fejl">⚠️ Velfærdsbrud</Badge>}
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
              <Th className="w-[30%]">Rytter</Th>
              <Th className="w-[25%]">Hest</Th>
              <Th className={onJuster ? 'w-[35%]' : 'w-[45%]'}>Status</Th>
              {onJuster && (
                <Th className="w-[10%] text-right">
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
                <Td className="w-[30%] font-medium">{t.rytter_navn}</Td>
                <Td className="w-[25%]">{t.hest_id ? (hesteNavne.get(t.hest_id) ?? 'Ukendt hest') : '—'}</Td>
                <Td className={onJuster ? 'w-[35%]' : 'w-[45%]'}>
                  <Statusmaerker
                    tildeling={t}
                    koerselOvertraedelser={koersel.welfare_guard_overtraedelser}
                  />
                </Td>
                {onJuster && (
                  <Td className="w-[10%] text-right">
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
