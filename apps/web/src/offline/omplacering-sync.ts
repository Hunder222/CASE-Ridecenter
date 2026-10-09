import { db } from './dexie-db';
import { syncMotor } from './sync-motor';

/**
 * Henter aktuel bruger_id fra session eller localStorage
 */
async function hentAktivBrugerId(): Promise<string | null> {
  const sessionPost = await db.meta.get('aktiv_session');
  if (sessionPost?.vaerdi?.bruger_id) {
    return sessionPost.vaerdi.bruger_id;
  }
  const bruger = localStorage.getItem('ridecenter_bruger');
  if (bruger) {
    try {
      const parsed = JSON.parse(bruger);
      return parsed.bruger_id ?? parsed.id ?? null;
    } catch {
      // ignore
    }
  }
  return null;
}

/**
 * Gemmer en hestestatusmelding lokalt i Dexie og tilføjer MeldHestStatus til outbox.
 */
export async function gemHestStatusMelding(input: {
  hestId: string;
  type: 'Helbred' | 'Adfaerd';
  alvorlighed: 'Info' | 'Obs' | 'KanIkkeBruges' | 'Sygemeldt' | 'Skadet' | 'Karantaene' | 'Raskmeldt';
  beskrivelse: string;
}): Promise<void> {
  const brugerId = await hentAktivBrugerId();
  const kommandoId = crypto.randomUUID();
  const klientTidspunkt = new Date().toISOString();

  // Opdatér lokal hest sundhedsstatus hvis Sygemeldt, Skadet, Karantaene eller Raskmeldt
  const hest = await db.heste.get(input.hestId);
  if (hest) {
    if (input.alvorlighed === 'KanIkkeBruges' || input.alvorlighed === 'Sygemeldt') {
      await db.heste.update(input.hestId, {
        sundhedsstatus: 'Sygemeldt',
      });
    } else if (input.alvorlighed === 'Skadet') {
      await db.heste.update(input.hestId, {
        sundhedsstatus: 'Skadet',
      });
    } else if (input.alvorlighed === 'Karantaene') {
      await db.heste.update(input.hestId, {
        sundhedsstatus: 'Karantaene',
      });
    } else if (input.alvorlighed === 'Raskmeldt') {
      await db.heste.update(input.hestId, {
        sundhedsstatus: 'Aktiv',
      });
    }
  }

  // Læg i outbox
  await db.outbox.add({
    kommandoId,
    type: 'MeldHestStatus',
    klientTidspunkt,
    brugerId,
    payload: {
      hest_id: input.hestId,
      type: input.type,
      alvorlighed: input.alvorlighed,
      beskrivelse: input.beskrivelse,
    },
    sendtStatus: 'afventer',
  });

  syncMotor.planlaegSync();
}

/**
 * Gemmer en godkendt omplacering lokalt og tilføjer GodkendOmplacering til outbox.
 */
export async function gemGodkendOmplacering(input: {
  lektionspladsId: string;
  tilHestId: string;
  aarsag: 'HestSyg' | 'HestSkadet' | 'Adfaerd' | 'Andet';
  forslagSnapshot: unknown;
}): Promise<void> {
  const brugerId = await hentAktivBrugerId();
  const kommandoId = crypto.randomUUID();
  const klientTidspunkt = new Date().toISOString();

  // Opdatér lokal plads
  await db.pladser.update(input.lektionspladsId, {
    aktuelHestId: input.tilHestId,
  });

  // Læg i outbox
  await db.outbox.add({
    kommandoId,
    type: 'GodkendOmplacering',
    klientTidspunkt,
    brugerId,
    payload: {
      lektionsplads_id: input.lektionspladsId,
      til_hest_id: input.tilHestId,
      aarsag: input.aarsag,
      forslag_snapshot: input.forslagSnapshot,
    },
    sendtStatus: 'afventer',
  });

  syncMotor.planlaegSync();
}

