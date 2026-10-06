import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { mrvGreedySolver, validerPlan, type AllokeringsResultat } from '@ridecenter/domain';
import { byggFuldData } from '../seed/data/fuld';
import { tilAllokeringsInput } from '../seed/data/til-domaene';

// npm run bench:kabale – SC-004: Kabalen for seed "fuld" (180 ryttere, 29 hold, 22 heste) skal tage
// under 30 sek. inkl. den uafhængige Welfare Guard-kontrol, med 0 overtrædelser (SC-002, SC-003).
// Målet er under 2 sek. Resultatet gemmes til pitch-slides.

const MAANED = '2026-07';
const KOERSLER = 5;
const GRAENSE_MS = 30_000;
const MAAL_MS = 2_000;
const RESULTATFIL = path.join(import.meta.dirname, 'resultat-kabale.json');

const input = tilAllokeringsInput(byggFuldData(MAANED), MAANED);

interface Maaling {
  ms: number;
  resultat: AllokeringsResultat;
  overtraedelser: number;
}

function koer(): Maaling {
  const start = performance.now();
  const resultat = mrvGreedySolver.allokér(input);
  const plan = {
    maaned: input.maaned,
    tildelinger: resultat.tildelinger.map((t) => ({
      holdtilmeldingId: t.holdtilmeldingId,
      hestId: t.hestId,
    })),
  };
  const overtraedelser = validerPlan(plan, input).length;
  return { ms: performance.now() - start, resultat, overtraedelser };
}

koer(); // Opvarmning (JIT), tæller ikke med.
const maalinger = Array.from({ length: KOERSLER }, koer);

const tider = maalinger.map((m) => m.ms).sort((a, b) => a - b);
const afrund = (ms: number | undefined) => Math.round((ms ?? Number.NaN) * 10) / 10;
const ms = {
  min: afrund(tider[0]),
  median: afrund(tider[Math.floor(tider.length / 2)]),
  max: afrund(tider.at(-1)),
};
const overtraedelser = Math.max(...maalinger.map((m) => m.overtraedelser));
const foerste = maalinger[0]?.resultat;
const deterministisk = maalinger.every((m) => JSON.stringify(m.resultat) === JSON.stringify(foerste));
const bestaaet = ms.median < GRAENSE_MS && overtraedelser === 0;

const rapport = {
  tidspunkt: new Date().toISOString(),
  solver_version: mrvGreedySolver.version,
  maaned: MAANED,
  data: {
    ryttere: input.ryttere.length,
    hold: input.hold.length,
    heste: input.heste.length,
    tilmeldinger: input.tilmeldinger.length,
    oensker: input.oensker.length,
  },
  koersler: KOERSLER,
  ms,
  maal_ms: MAAL_MS,
  graense_ms: GRAENSE_MS,
  statistik: foerste?.statistik,
  hold_med_kapacitetsmangel: foerste?.kapacitetsmangel.length ?? 0,
  welfare_guard_overtraedelser: overtraedelser,
  deterministisk,
  bestaaet,
  node: process.version,
};
writeFileSync(RESULTATFIL, `${JSON.stringify(rapport, null, 2)}\n`);

console.log(`Kabalen (${mrvGreedySolver.version}) på seed "fuld" for ${MAANED}`);
console.log(
  `  Data: ${rapport.data.ryttere} ryttere, ${rapport.data.hold} hold, ${rapport.data.heste} heste, ` +
    `${rapport.data.tilmeldinger} tilmeldinger`,
);
console.log(
  `  Tid (allokér + validerPlan, ${KOERSLER} kørsler): min ${ms.min} ms · median ${ms.median} ms · max ${ms.max} ms`,
);
console.log(
  `  Mål < ${MAAL_MS} ms: ${ms.median < MAAL_MS ? 'ja' : 'nej'} · grænse < ${GRAENSE_MS} ms (SC-004)`,
);
console.log('  Statistik:', foerste?.statistik);
console.log(
  `  Welfare Guard-overtrædelser: ${overtraedelser} · deterministisk: ${deterministisk ? 'ja' : 'NEJ'}`,
);
console.log(`  Resultat gemt i ${path.relative(process.cwd(), RESULTATFIL)}`);

if (!bestaaet) {
  console.error(
    overtraedelser > 0
      ? `FEJL: ${overtraedelser} Welfare Guard-overtrædelser (SC-002, SC-003)`
      : `FEJL: medianen ${ms.median} ms er ikke under ${GRAENSE_MS} ms (SC-004)`,
  );
  process.exitCode = 1;
}
