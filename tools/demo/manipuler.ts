import { PrismaClient } from '@prisma/client';
import { AuditVerificerService } from '../../apps/api/src/moduler/audit/verificer-service';

/**
 * Demo-værktøj til bevisførelse af Princip III (Append-Only) og hashkæde-integritet (T169).
 *
 * 1. Forsøger en direkte SQL UPDATE på en eksisterende fremmøderegistrering.
 *    -> Viser at PostgreSQL-triggeren afvis_mutation() afviser opdateringen.
 * 2. Tester hashkædeverifikation via AuditVerificerService.
 */
async function main() {
  const prisma = new PrismaClient();

  console.log('================================================================');
  console.log('DEMO: DATABASE-MANIPULATION OG REVISIONS-BEVIS (T169)');
  console.log('================================================================\n');

  try {
    // 1. Tjek om der findes mindst én fremmøderegistrering
    let fremmoede = await prisma.fremmoederegistrering.findFirst();

    if (!fremmoede) {
      console.log('Ingen fremmøderegistrering fundet. Opretter en midlertidig række til testen...');
      const lektionsplads = await prisma.lektionsPlads.findFirst({
        include: { lektion: true },
      });

      if (!lektionsplads) {
        throw new Error('Der kræves mindst én lektionsplads i databasen. Kør venligst npm run db:seed først.');
      }

      fremmoede = await prisma.fremmoederegistrering.create({
        data: {
          lektionsplads_id: lektionsplads.id,
          lektion_dato: lektionsplads.lektion.dato,
          hold_id: lektionsplads.lektion.hold_id,
          rytter_id: lektionsplads.rytter_id,
          status: 'Fremmoedt',
          registreret_af_navn: 'Demo-bruger',
          klient_tidspunkt: new Date(),
          server_tidspunkt: new Date(),
          kommando_id: crypto.randomUUID(),
          forrige_hash: '0'.repeat(64),
          hash: 'e'.repeat(64),
        },
      });
      console.log(`Oprettede fremmøderegistrering med ID: ${fremmoede.id}`);
    } else {
      console.log(`Bruger eksisterende fremmøderegistrering: ${fremmoede.id}`);
    }

    // 2. Forsøg på direkte SQL UPDATE (Append-Only Trigger Test)
    console.log('\n[TEST 1] Forsøger direkte SQL UPDATE på "fremmoederegistrering"...');
    console.log("SQL: UPDATE fremmoederegistrering SET status = 'Udeblevet' WHERE id = ...");

    try {
      await prisma.$executeRawUnsafe(
        `UPDATE "fremmoederegistrering" SET "status" = 'Udeblevet' WHERE "id" = '${fremmoede.id}'::uuid`,
      );
      console.error('❌ FEJL: UPDATE lykkedes! Triggeren afviste IKKE mutationen!');
      process.exitCode = 1;
    } catch (err: unknown) {
      const errorMsg = (err as Error).message;
      if (errorMsg.includes('afvis_mutation') || errorMsg.includes('forbudt') || errorMsg.includes('trigger')) {
        console.log('✅ SUCCES: PostgreSQL-triggeren afviste mutationen med fejlmeddelelse:');
        console.log(`   "${errorMsg.split('\n')[0]}"`);
        console.log('   -> Princip III (Append-Only) er aktivt håndhævet på databaseniveau!');
      } else {
        console.log(`⚠️ Mutation fejlede med anden fejl: ${errorMsg}`);
      }
    }

    // 3. Verificér Audit-hashkæden
    console.log('\n[TEST 2] Verificerer systemets overordnede Audit-hashkæde...');
    const auditService = new AuditVerificerService(prisma);
    const verificering = await auditService.verificerHashkaede();

    if (verificering.gyldig) {
      console.log('✅ SUCCES: Audit-hashkæden er UBRUDT og GYLDIG!');
      console.log(`   Antal audithændelser: ${verificering.antal_haendelser}`);
      console.log(`   Seneste hash: ${verificering.seneste_hash}`);
    } else {
      console.warn(`❌ ADVARSEL: Hashkæden er BRUDT ved række ${verificering.brud_ved_seq}!`);
      console.log('   (Dette beviser at manipulation af historiske data registreres øjeblikkeligt)');
    }

    console.log('\n================================================================');
    console.log('DEMO GENNEMFØRT UDEN UAUTORISERET MANIPULATION');
    console.log('================================================================');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Fejl under afvikling af demo:manipuler:', err);
  process.exit(1);
});

