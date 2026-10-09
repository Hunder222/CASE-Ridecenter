import { useState } from 'react';
import type { Tildelingskoersel } from '@ridecenter/contracts';
import { Badge, type BadgeVariant } from '../../faelles/ui/Badge';

const STATUSFARVE: Record<Tildelingskoersel['status'], BadgeVariant> = {
  Kladde: 'info',
  Afvist: 'fejl',
  Godkendt: 'ok',
  Publiceret: 'ok',
  Forkastet: 'neutral',
};

function formatOvertraedelse(kode: string, hesteNavne?: ReadonlyMap<string, string>): { type: string; beskrivelse: string; hest?: string } {
  const [basis = kode, hestId] = kode.split(':');
  const hestNavn = hestId && hesteNavne ? hesteNavne.get(hestId) : undefined;

  switch (basis) {
    case 'LEKTION_HEST_OPTAGET':
      return {
        type: 'Hest dobbeltbooket',
        beskrivelse: 'Tildelt til flere ryttere på samme hold og tidspunkt',
        hest: hestNavn,
      };
    case 'HC01_DAGSGRAENSE':
      return {
        type: 'Dagsgrænse overskredet',
        beskrivelse: 'Hesten går mere end 3 lektioner på én dag (HC-01)',
        hest: hestNavn,
      };
    case 'HC02_SKAANE_DAGSGRAENSE':
    case 'HC02_SKAANE':
      return {
        type: 'Skånehest overbelastet',
        beskrivelse: 'Skånehest går mere end 2 lektioner på én dag (HC-02)',
        hest: hestNavn,
      };
    case 'HC03_HVILEDAG':
      return {
        type: 'Tildelt på hviledag',
        beskrivelse: 'Hesten er sat på hold på sin faste hviledag (HC-03)',
        hest: hestNavn,
      };
    case 'HC04_SUNDHED':
      return {
        type: 'Sygemeldt hest',
        beskrivelse: 'Hesten er sygemeldt eller inaktiv (HC-04)',
        hest: hestNavn,
      };
    case 'HC05_SPRING_UGEGRAENSE':
    case 'HC05_SPRING':
      return {
        type: 'Springgrænse overskredet',
        beskrivelse: 'Mere end 1 springlektion pr. uge (HC-05)',
        hest: hestNavn,
      };
    case 'HC05_SPRINGFORBUD':
      return {
        type: 'Springforbud brudt',
        beskrivelse: 'Hest med springforbud sat på springhold (HC-05)',
        hest: hestNavn,
      };
    case 'HC06_VAEGT':
      return {
        type: 'Vægtgrænse overskredet',
        beskrivelse: 'Rytter overstiger hestens max vægt (HC-06)',
        hest: hestNavn,
      };
    case 'HC06_HOEJDE':
      return {
        type: 'Højdegrænse overskredet',
        beskrivelse: 'Rytter overstiger hestens max højde (HC-06)',
        hest: hestNavn,
      };
    case 'HC07_KUN_ROLIG':
    case 'HC07_SIKKERHED':
      return {
        type: 'Sikkerhedsprofil brudt',
        beskrivelse: 'Rytter med særlig profil tildelt uegnet hest (HC-07)',
        hest: hestNavn,
      };
    case 'HC08_NIVEAU_BEGYNDER':
    case 'HC08_NIVEAU':
      return {
        type: 'Niveau matcher ikke',
        beskrivelse: 'Begynder tildelt hest ikke godkendt til begyndere (HC-08)',
        hest: hestNavn,
      };
    case 'HC08_PART_UDEN_NIVEAUGODKENDELSE':
      return {
        type: 'Partaftale mangler godkendelse',
        beskrivelse: 'Partrytter mangler ledelsens niveaugodkendelse (HC-08)',
        hest: hestNavn,
      };
    case 'HC08_PARTHEST_RESERVERET':
      return {
        type: 'Parthest reserveret',
        beskrivelse: 'Forbeholdt rytterens partaftale (HC-08)',
        hest: hestNavn,
      };
    case 'IKKE_GODKENDT_TIL_RYTTER':
      return {
        type: 'Ikke godkendt til rytter',
        beskrivelse: 'Hesten er ikke godkendt til rytteren',
        hest: hestNavn,
      };
    default:
      return {
        type: basis,
        beskrivelse: kode,
        hest: hestNavn,
      };
  }
}

/** Status, varighed (SC-004), Welfare Guard-resultat og statistik for kørslen (T096, T211). */
export function KoerselOversigt({
  koersel,
  hesteNavne,
  onVisIkkeTildelt,
}: {
  koersel: Tildelingskoersel;
  hesteNavne?: ReadonlyMap<string, string>;
  onVisIkkeTildelt?: () => void;
}) {
  const [visDetaljer, setVisDetaljer] = useState(false);
  const brud = koersel.welfare_guard_overtraedelser;
  const { statistik } = koersel;
  const erManuel = koersel.solver_version.includes('manuel');

  const tal: [string, number][] = [
    ['1. ønske', statistik.oenske_1],
    ['2. ønske', statistik.oenske_2],
    ['3. ønske', statistik.oenske_3],
    ['Alternativ', statistik.alternativ],
    ['Ikke tildelt', statistik.ikke_tildelt],
  ];

  // Gruppér overtrædelser efter type
  const grupperedeBrud = new Map<string, { count: number; eksempler: string[] }>();
  for (const b of brud) {
    const info = formatOvertraedelse(b, hesteNavne);
    const label = `${info.type}: ${info.beskrivelse}`;
    const entry = grupperedeBrud.get(label) ?? { count: 0, eksempler: [] };
    entry.count += 1;
    if (info.hest && !entry.eksempler.includes(info.hest)) {
      entry.eksempler.push(info.hest);
    }
    grupperedeBrud.set(label, entry);
  }

  const erKunSoftConstraints =
    brud.length > 0 &&
    brud.every(
      (b) =>
        b.startsWith('HC08_NIVEAU_BEGYNDER') ||
        b.startsWith('HC08_NIVEAU_OEVET') ||
        b.startsWith('HC08_PART_UDEN_NIVEAUGODKENDELSE'),
    );

  return (
    <section aria-label="Kørslen" className="rounded-lg border border-stone-300 bg-white p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={STATUSFARVE[koersel.status]}>{koersel.status}</Badge>
        {!erManuel && <span className="text-sm text-stone-600">Beregnet på {koersel.varighed_ms} ms</span>}
        {brud.length === 0 ? (
          <Badge variant="ok">Welfare Guard: 0 overtrædelser</Badge>
        ) : erKunSoftConstraints ? (
          <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900 border border-amber-300">
            Welfare Guard: {brud.length} niveau-advarsler (Soft constraints)
          </span>
        ) : (
          <Badge variant="fejl">Welfare Guard: {brud.length} overtrædelser</Badge>
        )}
        <span className="text-sm text-stone-700">
          {erManuel ? '📋 Manuel fordeling (papirark)' : `Motor ${koersel.solver_version}`}
        </span>
      </div>

      {brud.length > 0 && (
        <div
          className={`mt-4 rounded-xl border p-3.5 ${
            erKunSoftConstraints
              ? 'border-amber-300 bg-amber-50/80 text-amber-950'
              : 'border-rose-200 bg-rose-50/70 text-rose-950'
          }`}
        >
          <div className="flex items-center justify-between">
            <div
              className={`text-xs font-semibold uppercase tracking-wider ${
                erKunSoftConstraints ? 'text-amber-900' : 'text-rose-800'
              }`}
            >
              {erKunSoftConstraints
                ? `💡 Registrerede niveau-uoverensstemmelser (Soft constraints: ${brud.length})`
                : `Registrerede velfærds- og sikkerhedsbrud i planen (${brud.length})`}
            </div>
            <button
              type="button"
              onClick={() => setVisDetaljer(!visDetaljer)}
              className={`text-xs font-medium underline ${
                erKunSoftConstraints
                  ? 'text-amber-800 hover:text-amber-950'
                  : 'text-rose-700 hover:text-rose-900'
              }`}
            >
              {visDetaljer ? 'Skjul detaljer' : `Vis alle (${brud.length})`}
            </button>
          </div>

          <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
            {[...grupperedeBrud.entries()].map(([beskrivelse, { count, eksempler }]) => (
              <div
                key={beskrivelse}
                className={`flex items-start gap-2 rounded border p-2 text-xs ${
                  erKunSoftConstraints
                    ? 'border-amber-200 bg-white text-amber-950'
                    : 'border-rose-200 bg-white text-rose-950'
                }`}
              >
                <span
                  className={`inline-flex shrink-0 items-center justify-center rounded px-1.5 py-0.5 font-bold ${
                    erKunSoftConstraints
                      ? 'bg-amber-100 text-amber-900'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {count}×
                </span>
                <div className="min-w-0">
                  <div className="font-medium">{beskrivelse}</div>
                  {eksempler.length > 0 && (
                    <div className="mt-0.5 truncate text-[11px] text-stone-600">
                      Heste: {eksempler.slice(0, 5).join(', ')}{eksempler.length > 5 ? '…' : ''}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {visDetaljer && (
            <div className="mt-3 border-t border-rose-200 pt-3">
              <div className="mb-1.5 text-xs font-medium text-rose-800">Fuld liste over overtrædelseskoder:</div>
              <ul className="max-h-48 overflow-y-auto space-y-1 font-mono text-xs text-rose-900 pl-2">
                {brud.map((b, i) => {
                  const parts = b.split(':');
                  const targetId = parts[1];
                  const hestNavn = targetId && hesteNavne ? hesteNavne.get(targetId) : undefined;
                  return (
                    <li key={`${b}-${i}`} className="flex items-center gap-1.5">
                      <span className="text-rose-400">•</span>
                      <span>
                        {b}
                        {hestNavn && (
                          <span className="ml-1 font-bold text-rose-950 font-sans">({hestNavn})</span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-stone-100 pt-3 sm:grid-cols-5">
        {tal.map(([label, antal]) => {
          const erIkkeTildelt = label === 'Ikke tildelt';
          const harMangel = erIkkeTildelt && antal > 0;

          if (harMangel) {
            return (
              <button
                key={label}
                type="button"
                onClick={onVisIkkeTildelt}
                className="group flex flex-col items-start rounded-xl border-2 border-rose-500 bg-rose-50 p-2.5 text-left shadow-sm transition hover:bg-rose-100 cursor-pointer"
                title="Klik for at se hvilke elever der mangler hest og justere tildeling"
              >
                <dt className="text-xs font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1">
                  <span>⚠️</span>
                  <span>{label}</span>
                </dt>
                <dd className="mt-0.5 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-rose-600 group-hover:scale-105 transition-transform">
                    {antal}
                  </span>
                  <span className="text-[11px] font-semibold text-rose-700 underline">
                    Vis liste →
                  </span>
                </dd>
              </button>
            );
          }

          return (
            <div key={label} className="p-2.5">
              <dt className="text-sm text-stone-700">{label}</dt>
              <dd className="text-2xl font-semibold">{antal}</dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
