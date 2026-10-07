import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { krypter } from '../../apps/api/src/krypto/aes-gcm';
import type { Seeddata, SeedRytter } from './data/typer';

// Skriver seeddata til databasen i én transaktion. Bruges af CLI'en (index.ts) og API-testene.

export interface SeedIndstillinger {
  /** 32 bytes (AES-256-GCM) til art. 9-felterne. */
  krypteringsnoegle: Buffer;
  /** Adgangskode til brugere med e-mail. */
  adgangskode: string;
}

/** Alle Fase 1-tabeller. TRUNCATE rammes ikke af append-only-triggeren på audit_haendelse. */
const TABELLER = [
  'audit_haendelse',
  'dashboard_notifikation',
  'fremmoederegistrering',
  'omplacering',
  'hestestatusmelding',
  'genbesaettelsesforslag',
  'venteliste',
  'rapport_udtraek',
  'cheat_sheet_kode',
  'vikar_engangskode',
  'enhed',
  'lektionsplads',
  'lektion',
  'hestetildeling',
  'tildelingskoersel',
  'elevoenske',
  'holdtilmelding',
  'hold',
  'sikkerhedsprofil',
  'rytter',
  'hest',
  'bruger',
] as const;

export async function nulstilDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(
    `TRUNCATE ${TABELLER.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`,
  );
}

function dato(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function harSikkerhedsprofil(r: SeedRytter): boolean {
  return (
    r.forbudteHeste.length > 0 ||
    r.paakraevedeHeste.length > 0 ||
    r.kunRoligeHeste ||
    r.faldtraumeNote !== null ||
    r.angstkategori !== null ||
    r.internNote !== null
  );
}

export async function skrivSeed(
  prisma: PrismaClient,
  data: Seeddata,
  { krypteringsnoegle, adgangskode }: SeedIndstillinger,
): Promise<void> {
  if (krypteringsnoegle.length !== 32) throw new Error('Krypteringsnøglen skal være 32 bytes');
  const ledelse = data.brugere.find((b) => b.roller.includes('Ledelse'));
  if (!ledelse) throw new Error('Seed mangler en bruger med rollen Ledelse');

  const passwordHash = await argon2.hash(adgangskode);
  const krypterNote = (tekst: string | null) => (tekst === null ? null : krypter(krypteringsnoegle, tekst));
  const holdForRytter = new Map(data.tilmeldinger.map((t) => [t.rytterId, t.holdId]));
  const underviserForHold = new Map(data.hold.map((h) => [h.id, h.fastUnderviserId]));
  const tilmeldingFor = new Map(data.tilmeldinger.map((t) => [`${t.rytterId}|${t.holdId}`, t.id]));
  const nu = new Date();

  await prisma.$transaction(
    async (tx) => {
      // 1. Brugere med password og Argon2id PIN-hash
      for (const b of data.brugere) {
        const pinHash = b.pin ? await argon2.hash(b.pin) : null;
        await tx.bruger.create({
          data: {
            id: b.id,
            navn: b.navn,
            roller: b.roller,
            email: b.email,
            password_hash: b.email ? passwordHash : null,
            pin_hash: pinHash,
          },
        });
      }

      // 2. Standard Cheat Sheet koder (T170)
      const { STANDARD_CHEAT_SHEET_KODER } = await import('./data/cheat-sheet-koder');
      await tx.cheatSheetKode.createMany({
        data: STANDARD_CHEAT_SHEET_KODER,
      });

      // 3. Betroet demo-enhed ("Stald-tablet 1") (T170)
      const demoEnhedsnoegle = 'demo-enhedsnoegle-stald-tablet-1';
      const demoEnhedsnoegleHash = createHash('sha256').update(demoEnhedsnoegle).digest('hex');
      const demoEnrollmentHash = createHash('sha256').update('demo-enrollment-token').digest('hex');
      const enhed = await tx.enhed.create({
        data: {
          navn: 'Stald-tablet 1',
          enrollment_token_hash: demoEnrollmentHash,
          enhedsnoegle_hash: demoEnhedsnoegleHash,
          aktiv: true,
        },
      });

      // 4. 3 aktive 6-cifrede vikarkoder (T170)
      const demoVikarKoder = ['123456', '654321', '888999'];
      const om90Dage = new Date(nu.getTime() + 90 * 24 * 60 * 60 * 1000);
      for (const vk of demoVikarKoder) {
        const vkHash = await argon2.hash(vk);
        await tx.vikarEngangskode.create({
          data: {
            kode_hash: vkHash,
            udstedt_af: ledelse.id,
            udloebsdato: om90Dage,
            status: 'Aktiv',
          },
        });
      }

      await tx.hest.createMany({
        data: data.heste.map((h) => ({
          id: h.id,
          navn: h.navn,
          stangmaal_cm: h.stangmaalCm,
          max_rytter_vaegt_kg: h.maxRytterVaegtKg,
          max_rytter_hoejde_cm: h.maxRytterHoejdeCm,
          temperament: h.temperament,
          godkendt_til_begyndere: h.godkendtTilBegyndere,
          egnet_oevet: h.egnetOevet,
          skaane: h.skaane,
          max_lektioner_dag: h.maxLektionerDag,
          springforbud: h.springforbud,
          max_spring_uge: h.maxSpringUge,
          hviledag: h.hviledag,
          sundhedsstatus: h.sundhedsstatus,
          staldnoter: h.staldnoter,
          aktiv: h.aktiv,
        })),
      });

      await tx.rytter.createMany({
        data: data.ryttere.map((r) => ({
          id: r.id,
          fornavn: r.fornavn,
          efternavn: r.efternavn,
          foedselsdato: dato(r.foedselsdato),
          bopaelskommune: r.bopaelskommune,
          hoejde_cm: r.hoejdeCm,
          vaegt_kg: r.vaegtKg,
          erfaringsniveau: r.erfaringsniveau,
          klar_til_udvikling: r.klarTilUdvikling,
          er_hjaelper: r.erHjaelper,
          kontaktperson_navn: r.kontaktpersonNavn,
          kontakt_telefon: r.kontaktTelefon,
          kontakt_email: r.kontaktEmail,
          partaftale_hest_id: r.partaftaleHestId,
          partaftale_godkendt_trods_niveau: r.partaftaleGodkendtTrodsNiveau,
          aktiv_status: r.aktivStatus,
        })),
      });

      await tx.sikkerhedsprofil.createMany({
        data: data.ryttere.filter(harSikkerhedsprofil).map((r) => {
          const koder: string[] = [];
          let instruks: string | null = null;
          if (r.angstkategori || r.kunRoligeHeste) {
            koder.push('OBS-SKAANSOM', 'TRAEK-OP-I-RO');
            instruks = 'Rytteren har brug for ekstra ro ved opsidning og venlig guidning under opvarmning.';
          }
          if (r.faldtraumeNote) {
            koder.push('AFSTAND-3M', 'HJAELP-OPSTIGNING');
            instruks = 'Hold mindst 3 meters afstand til andre heste i ridehuset. Hjælp gerne med bøjlelængde.';
          }
          return {
            rytter_id: r.id,
            faldtraume_note: krypterNote(r.faldtraumeNote),
            angstkategori: krypterNote(r.angstkategori),
            intern_note: krypterNote(r.internNote),
            forbudte_heste: [...r.forbudteHeste],
            paakraevede_heste: [...r.paakraevedeHeste],
            kun_rolige_heste: r.kunRoligeHeste,
            cheat_sheet_koder: koder,
            adfaerdsinstruks: instruks,
            opdateret_af: ledelse.id,
            opdateret: nu,
          };
        }),
      });

      await tx.hold.createMany({
        data: data.hold.map((h) => ({
          id: h.id,
          holdnavn: h.holdnavn,
          niveau: h.niveau,
          er_springhold: h.erSpringhold,
          ugedag: h.ugedag,
          starttid: h.starttid,
          varighed_min: h.varighedMin,
          max_kapacitet: h.maxKapacitet,
          fast_underviser_id: h.fastUnderviserId,
        })),
      });

      await tx.holdtilmelding.createMany({
        data: data.tilmeldinger.map((t) => ({
          id: t.id,
          rytter_id: t.rytterId,
          hold_id: t.holdId,
          gyldig_fra: dato(t.gyldigFra),
          ancienitet_dato: dato(t.ancienitetDato),
        })),
      });

      // Ønskerne registreres af underviseren på rytterens hold (F1.1: indsamles i stalden).
      await tx.elevoenske.createMany({
        data: data.oensker.map((o) => ({
          rytter_id: o.rytterId,
          maaned: o.maaned,
          prioritet: o.prioritet,
          oensket_hest_id: o.hestId,
          registreret_af: underviserForHold.get(holdForRytter.get(o.rytterId) ?? '') ?? ledelse.id,
        })),
      });

      // Historisk kørsel for måneden før: kilden til turnus (SC-02). Den får ingen lektioner.
      const historiskMaaned = data.historik[0]?.maaned;
      if (historiskMaaned) {
        const udfald = (n: 1 | 2 | 3) => data.historik.filter((h) => h.oenskeOpfyldt === n).length;
        const koersel = await tx.tildelingskoersel.create({
          data: {
            maaned: historiskMaaned,
            status: 'Publiceret',
            startet_af: ledelse.id,
            solver_version: 'historik-import',
            input_hash: createHash('sha256').update(`historik-import:${historiskMaaned}`).digest('hex'),
            varighed_ms: 0,
            statistik: {
              oenske_1: udfald(1),
              oenske_2: udfald(2),
              oenske_3: udfald(3),
              alternativ: data.historik.filter((h) => h.erAlternativ).length,
              ikke_tildelt: 0,
            },
            welfare_guard_resultat: [],
          },
        });
        await tx.hestetildeling.createMany({
          data: data.historik.map((h) => {
            const holdtilmeldingId = tilmeldingFor.get(`${h.rytterId}|${h.holdId}`);
            if (!holdtilmeldingId) throw new Error(`Historik uden tilmelding: rytter ${h.rytterId}`);
            return {
              koersel_id: koersel.id,
              holdtilmelding_id: holdtilmeldingId,
              hest_id: h.hestId,
              oenske_opfyldt: h.oenskeOpfyldt,
              er_alternativ_tildeling: h.erAlternativ,
              turnus_score: 0,
              turnus_naeste_maaned: h.turnusNaesteMaaned,
              begrundelse_tekst: 'Historisk tildeling importeret fra papirlisterne.',
            };
          }),
        });
      }

      // 5. Opret lektioner og lektionspladser for måneden (T170)
      const datoIdagStr = nu.toISOString().slice(0, 10);
      const datoIdag = dato(datoIdagStr);
      for (const hold of data.hold) {
        const underviserId = hold.fastUnderviserId ?? ledelse.id;
        const lektion = await tx.lektion.create({
          data: {
            hold_id: hold.id,
            dato: datoIdag,
            underviser_id: underviserId,
            status: 'Planlagt',
          },
        });

        // Hent holdets tilmeldinger og tildel unikke heste til lektionspladserne
        const holdetsTilmeldinger = data.tilmeldinger.filter((t) => t.holdId === hold.id);
        const brugteHeste = new Set<string>();

        for (const t of holdetsTilmeldinger) {
          const hestTildeling = data.historik.find((h) => h.rytterId === t.rytterId && h.holdId === hold.id);
          let valgtHestId: string | null = null;

          if (hestTildeling?.hestId && !brugteHeste.has(hestTildeling.hestId)) {
            valgtHestId = hestTildeling.hestId;
          } else {
            // Find en hest der ikke allerede er brugt på lektionen
            const ledigHest = data.heste.find((h) => !brugteHeste.has(h.id));
            valgtHestId = ledigHest?.id ?? null;
          }

          if (valgtHestId) {
            brugteHeste.add(valgtHestId);
          }

          await tx.lektionsPlads.create({
            data: {
              lektion_id: lektion.id,
              rytter_id: t.rytterId,
              planlagt_hest_id: valgtHestId,
              aktuel_hest_id: valgtHestId,
            },
          });
        }
      }

      // 6. Pre-stage en realistisk test-case for akut drift (V3):
      // Sæt hesten Toobi som "Sygemeldt" med en helbredsmelding fra staldelev Ella J.
      const toobi = data.heste.find((h) => h.navn === 'Toobi');
      const ella = data.brugere.find((b) => b.navn.startsWith('Ella'));
      if (toobi) {
        await tx.hest.update({
          where: { id: toobi.id },
          data: { sundhedsstatus: 'Sygemeldt' },
        });

        await tx.hestestatusmelding.create({
          data: {
            hest_id: toobi.id,
            type: 'Helbred',
            alvorlighed: 'KanIkkeBruges',
            beskrivelse: 'Halter let på venstre forben i trav. Skal tilses af dyrlæge.',
            meldt_af_bruger_id: ella?.id ?? ledelse.id,
            meldt_af_navn: ella?.navn ?? 'Ella J.',
            klient_tidspunkt: nu,
            server_tidspunkt: nu,
            kommando_id: '11111111-2222-3333-4444-555555555555',
          },
        });
      }
    },
    { timeout: 60_000 },
  );
}
