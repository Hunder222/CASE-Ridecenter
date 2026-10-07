import type { FremmoedeStatus } from '@ridecenter/contracts';
import { db } from './dexie-db';
import { syncMotor } from './sync-motor';

/**
 * Gemmer en batch fremmøderegistrering i Dexie outbox og trigger baggrundssync.
 */
export async function gemFremmoedeBatch(
  lektionId: string,
  registreringer: Array<{ lektionsplads_id: string; status: 'Fremmoedt' | 'Udeblevet' }>
) {
  const bruger = localStorage.getItem('ridecenter_bruger');
  let brugerId: string | null = null;
  if (bruger) {
    try {
      brugerId = JSON.parse(bruger).id;
    } catch {
      // ignore
    }
  }

  const kommandoId = crypto.randomUUID();
  const klientTidspunkt = new Date().toISOString();

  await db.outbox.add({
    kommandoId,
    type: 'RegistrerFremmoede',
    klientTidspunkt,
    brugerId,
    payload: {
      lektion_id: lektionId,
      registreringer,
    },
    sendtStatus: 'afventer',
  });

  syncMotor.planlaegSync();
}

/**
 * Gemmer en fremmødekorrektion med begrundelse i Dexie outbox og trigger baggrundssync.
 */
export async function gemKorrigerFremmoede(
  fremmoederegistreringId: string,
  nyStatus: FremmoedeStatus,
  begrundelse: string
) {
  const bruger = localStorage.getItem('ridecenter_bruger');
  let brugerId: string | null = null;
  if (bruger) {
    try {
      brugerId = JSON.parse(bruger).id;
    } catch {
      // ignore
    }
  }

  const kommandoId = crypto.randomUUID();
  const klientTidspunkt = new Date().toISOString();

  await db.outbox.add({
    kommandoId,
    type: 'KorrigerFremmoede',
    klientTidspunkt,
    brugerId,
    payload: {
      fremmoederegistrering_id: fremmoederegistreringId,
      ny_status: nyStatus,
      begrundelse,
    },
    sendtStatus: 'afventer',
  });

  syncMotor.planlaegSync();
}

