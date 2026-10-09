import type { Hestetildeling, Hold, Tildelingskoersel } from '@ridecenter/contracts';
import { Badge } from '../../faelles/ui/Badge';
import { Knap } from '../../faelles/ui/Knap';
import { Tabel, Td, Th } from '../../faelles/ui/Tabel';

function Statusmaerker({
  tildeling,
  hold,
  koerselOvertraedelser,
}: {
  tildeling: Hestetildeling;
  hold?: Hold;
  koerselOvertraedelser: readonly string[];
}) {
  const koder = new Set(tildeling.begrundelse_koder.map((kode) => kode.split(':')[0]));
  const hestId = tildeling.hest_id;

  // Filtrer kun overtrædelser, der vedrører netop denne hest OG dette hold
  const hestOvertraedelser =
    Boolean(hestId) && koerselOvertraedelser.length > 0
      ? koerselOvertraedelser.filter((b) => {
          const [basis, hId] = b.split(':');
          if (hId && hId !== hestId) return false;

          // Hvis overtrædelsen er niveaurelateret, gælder den kun hvis holdet har det pågældende niveau
          if (basis === 'HC08_NIVEAU_BEGYNDER') {
            return hold?.niveau === 'Begynder';
          }
          if (basis === 'HC08_NIVEAU_OEVET') {
            return hold?.niveau === 'Oevet';
          }
          if (basis === 'HC08_PART_UDEN_NIVEAUGODKENDELSE') {
            return koder.has('HC08_PART_UDEN_NIVEAUGODKENDELSE') || koder.has('PARTAFTALE');
          }
          return hId === hestId;
        })
      : [];

  const erSoftConstraintKode = (kode: string) =>
    kode.startsWith('HC08_NIVEAU_BEGYNDER') ||
    kode.startsWith('HC08_NIVEAU_OEVET') ||
    kode.startsWith('HC08_PART_UDEN_NIVEAUGODKENDELSE');

  const harReeltVelfaerdsbrud = hestOvertraedelser.some((b) => !erSoftConstraintKode(b));
  const harNiveauDispensation =
    !harReeltVelfaerdsbrud &&
    (hestOvertraedelser.some(erSoftConstraintKode) ||
      tildeling.begrundelse_tekst.toLowerCase().includes('dispensation') ||
      tildeling.begrundelse_tekst.toLowerCase().includes('særtilladelse'));

  return (
    <span className="flex flex-wrap gap-1">
      {harReeltVelfaerdsbrud && <Badge variant="fejl">⚠️ Velfærdsbrud</Badge>}
      {tildeling.oenske_opfyldt !== null ? (
        <Badge variant="ok">{tildeling.oenske_opfyldt}. ønske</Badge>
      ) : (
        harNiveauDispensation && <Badge variant="advarsel">DISPENSATION</Badge>
      )}
      {tildeling.hest_id === null && <Badge variant="fejl">Ikke tildelt – kapacitetsmangel</Badge>}
      {tildeling.er_alternativ_tildeling && (
        <Badge variant="advarsel">Alternativ tildeling (ønsker optaget)</Badge>
      )}
      {(koder.has('PARTAFTALE') || koder.has('PAAKRAEVET_HEST')) && (
        <Badge variant="info">Partaftale</Badge>
      )}
      {tildeling.manuelt_justeret && <Badge>Manuelt justeret</Badge>}
    </span>
  );
}

/** Én tabel pr. hold sorteret på ugedag og starttid (T097). Klik på en række viser begrundelsen. */
export function HoldTabel({
  koersel,
  overtraedelser,
  hold,
  hesteNavne,
  valgtId,
  onVaelg,
  onJuster,
  soegning = '',
}: {
  koersel: Tildelingskoersel;
  overtraedelser?: readonly string[];
  hold: readonly Hold[];
  hesteNavne: ReadonlyMap<string, string>;
  valgtId: string | null;
  onVaelg: (tildelingId: string) => void;
  /** Kun når kørslen er en kladde. */
  onJuster?: (tildeling: Hestetildeling) => void;
  soegning?: string;
}) {
  const holdPrId = new Map(hold.map((h) => [h.id, h]));
  const grupper = new Map<string, Hestetildeling[]>();
  for (const t of koersel.tildelinger ?? []) grupper.set(t.hold_id, [...(grupper.get(t.hold_id) ?? []), t]);
  const sorterede = [...grupper].sort(([a], [b]) => {
    const [ha, hb] = [holdPrId.get(a), holdPrId.get(b)];
    return (ha?.ugedag ?? 8) - (hb?.ugedag ?? 8) || (ha?.starttid ?? '').localeCompare(hb?.starttid ?? '');
  });

  const q = soegning.trim().toLowerCase();

  const filtreredeHold = sorterede
    .map(([holdId, tildelinger]) => {
      const h = holdPrId.get(holdId);
      const holdNavn = (h?.holdnavn ?? 'Hold').toLowerCase();
      const ugedagNavn = h?.ugedag
        ? ['', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag', 'søndag'][h.ugedag] ?? ''
        : '';
      const starttid = (h?.starttid ?? '').toLowerCase();
      const niveauNavn = (h?.niveau ?? '').toLowerCase();

      // Tjekker om søgeteksten matcher holdtitel eller parametre (f.eks. "mandag", "15:00", "Letøvet")
      const holdTitelMatcher = Boolean(
        q &&
          (holdNavn.includes(q) ||
            ugedagNavn.includes(q) ||
            starttid.includes(q) ||
            niveauNavn.includes(q) ||
            (q === 'letøvet' && holdNavn.includes('letoevet')) ||
            (q === 'øvet' && holdNavn.includes('oevet')) ||
            (q === 'trækhold' && holdNavn.includes('traekhold'))),
      );

      // Filtrer tildelinger for dette hold
      const matchendeTildelinger = tildelinger.filter((t) => {
        if (!q) return true;
        if (holdTitelMatcher) return true;
        const elevMatcher = t.rytter_navn.toLowerCase().includes(q);
        const hestMatcher = Boolean(t.hest_id && hesteNavne.get(t.hest_id)?.toLowerCase().includes(q));
        return elevMatcher || hestMatcher;
      });

      return {
        holdId,
        hold: h,
        tildelinger: matchendeTildelinger,
        skalVises: !q || holdTitelMatcher || matchendeTildelinger.length > 0,
      };
    })
    .filter((grp) => grp.skalVises && grp.tildelinger.length > 0);

  if (filtreredeHold.length === 0) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-8 text-center text-stone-500 shadow-sm">
        Ingen hold, elever eller heste matcher søgningen &quot;{soegning}&quot;.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {filtreredeHold.map(({ holdId, hold: holdData, tildelinger }) => (
        <Tabel key={holdId} titel={holdData?.holdnavn ?? 'Hold'}>
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
                <Td className="w-[25%]">
                  {t.hest_id ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span>{hesteNavne.get(t.hest_id) ?? 'Ukendt hest'}</span>
                      {(t.begrundelse_koder.some((k) => k.startsWith('PAAKRAEVET_HEST')) ||
                        t.begrundelse_tekst.includes('Fast hest af hensyn til rytterens sikkerhed')) && (
                        <span
                          title="Påkrævet hest af hensyn til rytterens sikkerhedsprofil"
                          className="cursor-help rounded bg-amber-100 px-1 py-0.2 text-[11px] font-bold text-amber-800 border border-amber-300"
                        >
                          🔒 Påkrævet
                        </span>
                      )}
                    </span>
                  ) : (
                    '—'
                  )}
                </Td>
                <Td className={onJuster ? 'w-[35%]' : 'w-[45%]'}>
                  <Statusmaerker
                    tildeling={t}
                    hold={holdPrId.get(holdId)}
                    koerselOvertraedelser={overtraedelser ?? koersel.welfare_guard_overtraedelser}
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
