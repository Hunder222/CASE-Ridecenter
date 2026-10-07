import { db, tilfoejOutbox, type LokalBruger } from './dexie-db';

const LOCKOUT_FORSOEG = 5;
const LOCKOUT_VARIGHED_MS = 60_000;

interface LockoutTilstand {
  fejlForsøg: number[];
}

let lokalLockout: LockoutTilstand = {
  fejlForsøg: [],
};

/**
 * Beregner PBKDF2 hash (SHA-256, 100.000 iterationer) i browseren via Web Crypto API.
 */
export async function beregnPBKDF2(pin: string, saltHex: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey'],
  );

  // Konverter saltHex til Uint8Array
  const match = saltHex.match(/.{1,2}/g);
  const saltBytes = new Uint8Array(match ? match.map((byte) => parseInt(byte, 16)) : [0, 0, 0, 0]);

  const derivedBits = await window.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256,
  );

  const hashArray = Array.from(new Uint8Array(derivedBits));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Tjekker om den lokale enhed er låst på grund af for mange forkerte forsøg.
 * Returnerer antal sekunder tilbage af lockout, eller 0 hvis ikke låst.
 */
export function hentLokalLockoutSekunder(): number {
  const nu = Date.now();
  lokalLockout.fejlForsøg = lokalLockout.fejlForsøg.filter((t) => nu - t < LOCKOUT_VARIGHED_MS);
  if (lokalLockout.fejlForsøg.length < LOCKOUT_FORSOEG) {
    return 0;
  }
  const ældste = lokalLockout.fejlForsøg[0] ?? nu;
  const udløb = ældste + LOCKOUT_VARIGHED_MS;
  return Math.max(1, Math.ceil((udløb - nu) / 1000));
}

export function registrerLokalFejl(): void {
  const nu = Date.now();
  lokalLockout.fejlForsøg = lokalLockout.fejlForsøg.filter((t) => nu - t < LOCKOUT_VARIGHED_MS);
  lokalLockout.fejlForsøg.push(nu);
}

export function nulstilLokalLockout(): void {
  lokalLockout.fejlForsøg = [];
}

export interface LokalLoginResultat {
  succes: boolean;
  bruger?: LokalBruger;
  lockoutSekunder?: number;
  fejlbesked?: string;
}

/**
 * Validerer 4-cifret PIN mod cachede brugere i Dexie DB.
 * Ved succes oprettes AuditHaendelse(LOGIN_PIN) i outboxen.
 */
export async function validerLokalPin(pin: string): Promise<LokalLoginResultat> {
  const sekunder = hentLokalLockoutSekunder();
  if (sekunder > 0) {
    return {
      succes: false,
      lockoutSekunder: sekunder,
      fejlbesked: `Enheden er låst. Prøv igen om ${sekunder} sekunder.`,
    };
  }

  const brugere = await db.brugere.toArray();
  const staldBrugere = brugere.filter((b) =>
    b.pinHash && b.roller.some((r) => ['Ridelaerer', 'Ledelse', 'Staldelev'].includes(r)),
  );

  let matchendeBruger: LokalBruger | undefined;

  for (const bruger of staldBrugere) {
    if (!bruger.pinHash) continue;

    // Hvis brugeren har et salt, brug PBKDF2
    const salt = bruger.salt ?? 'stald-salt-1234';
    try {
      const beregnetHash = await beregnPBKDF2(pin, salt);
      if (beregnetHash === bruger.pinHash) {
        matchendeBruger = bruger;
        break;
      }
    } catch (e) {
      // Fallback hvis hashing fejler
    }
  }

  if (!matchendeBruger) {
    registrerLokalFejl();
    const nySekunder = hentLokalLockoutSekunder();
    return {
      succes: false,
      lockoutSekunder: nySekunder,
      fejlbesked: nySekunder > 0
        ? `For mange forkerte forsøg. Enheden er låst i ${nySekunder} sekunder.`
        : 'Forkert PIN-kode.',
    };
  }

  nulstilLokalLockout();

  // Opret lokal session i meta
  await db.meta.put({
    noegle: 'aktiv_session',
    vaerdi: {
      brugerId: matchendeBruger.id,
      navn: matchendeBruger.navn,
      roller: matchendeBruger.roller,
      loggetIndTid: new Date().toISOString(),
    },
  });

  // Føj AuditHaendelse(LOGIN_PIN) til Dexie outbox
  const kommandoId = crypto.randomUUID();
  await tilfoejOutbox({
    kommando_id: kommandoId,
    type: 'RegistrerFremmoede' as any, // outbox bruger KommandoKuvert-format
    klient_tidspunkt: new Date().toISOString(),
    bruger_id: matchendeBruger.id,
    payload: {
      handling: 'LOGIN_PIN',
      detaljer: { navn: matchendeBruger.navn, offline: true },
    },
  });

  return {
    succes: true,
    bruger: matchendeBruger,
  };
}

