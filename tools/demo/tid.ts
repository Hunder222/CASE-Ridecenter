import { klassificerAfbud } from '@ridecenter/domain';

/**
 * CLI-demo-værktøj til simulering og test af virtuel server-tid ifm. afbudsfrister (T169, V5).
 *
 * Anvendelse:
 *   npx tsx tools/demo/tid.ts [YYYY-MM-DDTHH:mm:ss] [lektion-dato]
 * Eksempler:
 *   npx tsx tools/demo/tid.ts 2026-07-15T11:30:00 2026-07-15   -> Rettidigt (før kl. 12:00)
 *   npx tsx tools/demo/tid.ts 2026-07-15T12:05:00 2026-07-15   -> For sent (efter kl. 12:00)
 */
function main() {
  const args = process.argv.slice(2);
  const virtuelTidStr = args[0] ?? '2026-07-15T11:30:00';
  const lektionDatoStr = args[1] ?? '2026-07-15';

  console.log('================================================================');
  console.log('DEMO: VIRTUEL TID & AFBUDSFRIST KL. 12:00 TEST (T169, V5)');
  console.log('================================================================\n');

  const virtuelTid = new Date(virtuelTidStr);
  if (isNaN(virtuelTid.getTime())) {
    console.error(`❌ Ugyldigt tidsformat for virtuel tid: "${virtuelTidStr}". Brug ISO-format som fx "2026-07-15T11:30:00"`);
    process.exit(1);
  }

  console.log(`Virtuel modtagelsestid : ${virtuelTid.toLocaleString('da-DK', { timeZone: 'Europe/Copenhagen' })} (Europe/Copenhagen)`);
  console.log(`Lektionsdato            : ${lektionDatoStr}`);
  console.log('Afbudsfrist regel       : Kl. 12:00:00 lokal tid på lektionsdagen (FR-014 / R10)\n');

  const status = klassificerAfbud({
    lektionDato: lektionDatoStr,
    modtagetTidspunkt: virtuelTid,
  });

  if (status === 'Afbud_rettidigt') {
    console.log('✅ UDFALD: RETTIDIGT AFBUD ("Afbud_rettidigt")');
    console.log('   -> Pladsen frigives til venteliste-genbesættelse (US4).');
    console.log('   -> Rytteren opkræves ikke gebyr.');
  } else {
    console.log('⚠️ UDFALD: FOR SENT AFBUD ("Afbud_for_sent")');
    console.log('   -> Modtaget efter kl. 12:00.');
    console.log('   -> Tæller med i fraværsstatistik for lektionen.');
  }

  console.log('\n================================================================');
}

main();

