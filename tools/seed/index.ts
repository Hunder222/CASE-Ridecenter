import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { config as indlaesEnv } from 'dotenv';
import { byggFredagsdata } from './data/fredag';
import { byggFuldData } from './data/fuld';
import { nulstilDatabase, skrivSeed } from './skriv-seed';

// npm run db:seed -- --scenarie=fredag|fuld [--maaned=YYYY-MM] [--nulstil]

indlaesEnv({ path: path.resolve(import.meta.dirname, '../../.env'), quiet: true });

function argument(navn: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${navn}=`))?.slice(navn.length + 3);
}

const scenarie = argument('scenarie') ?? 'fuld';
const maaned = argument('maaned') ?? '2026-10';
const nulstil = process.argv.includes('--nulstil');

if (scenarie !== 'fredag' && scenarie !== 'fuld') {
  throw new Error(`Ukendt scenarie "${scenarie}". Brug --scenarie=fredag eller --scenarie=fuld`);
}
if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(maaned))
  throw new Error(`Ugyldig måned "${maaned}". Brug formatet ÅÅÅÅ-MM`);

const krypteringsnoegle = Buffer.from(process.env.KRYPTERINGSNOEGLE ?? '', 'base64');
if (krypteringsnoegle.length !== 32)
  throw new Error('KRYPTERINGSNOEGLE skal være 32 bytes base64 (se .env.example)');
const adgangskode = process.env.SEED_ADGANGSKODE ?? '';
if (adgangskode.length < 8) throw new Error('SEED_ADGANGSKODE skal være mindst 8 tegn (se .env.example)');

const data = scenarie === 'fuld' ? byggFuldData(maaned) : byggFredagsdata(maaned);
const prisma = new PrismaClient();
try {
  if (nulstil) await nulstilDatabase(prisma);
  else if ((await prisma.bruger.count()) > 0) {
    throw new Error('Databasen indeholder allerede data. Kør med --nulstil for at starte forfra.');
  }
  await skrivSeed(prisma, data, { krypteringsnoegle, adgangskode });
  console.log(
    `Seed "${scenarie}" for ${maaned}: ${data.brugere.length} brugere, ${data.heste.length} heste, ` +
      `${data.ryttere.length} ryttere, ${data.hold.length} hold, ${data.tilmeldinger.length} tilmeldinger, ` +
      `${data.oensker.length} ønsker og ${data.historik.length} historiske tildelinger.`,
  );
  console.log(
    'Log ind på /admin som malene@demo.dk (Ledelse) eller marie@demo.dk (Ridelærer) med SEED_ADGANGSKODE.',
  );
  console.log('\n--- DEMO STALD TABLET & PIN-KODER (T170) ---');
  console.log('PIN-koder (6-cifrede): Malene: 111111 | Marie: 222222 | Camilla: 222333 | Birgit: 222444 | Ella J: 333333');
  console.log('Aktive 5-cifrede vikarkoder: 12345 (Sofie Fast vikar), 54321, 88899');
  console.log('Betroet enhed: "Stald-tablet 1"');
  console.log('--------------------------------------------\n');
} finally {
  await prisma.$disconnect();
}
