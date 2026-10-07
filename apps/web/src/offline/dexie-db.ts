import Dexie, { type Table } from 'dexie';
import type { KommandoKuvert } from '@ridecenter/contracts';

export interface LokalBruger {
  id: string;
  navn: string;
  roller: string[];
  pinHash?: string | null;
  salt?: string;
}

export interface LokalVikarKode {
  id: string;
  kodeHash: string;
  status: string;
}

export interface LokalLektion {
  id: string;
  dato: string;
  holdId: string;
  holdnavn: string;
  starttid: string;
  niveau: string;
  erSpringhold: boolean;
  fremmoedeLukket: string | null;
}

export interface LokalPlads {
  id: string;
  lektionId: string;
  rytterId: string;
  rytterNavnKort?: string;
  aktuelHestId: string | null;
  planlagtHestId: string | null;
  status: string | null;
  godkendteHeste?: string[];
  cheatSheetKoder?: string[];
  adfaerdsinstruks?: string | null;
}

export interface LokalHest {
  id: string;
  navn: string;
  stangmaal_cm?: number;
  sundhedsstatus: string;
  temperament?: string;
  staldnoter?: string;
  hviledag?: number;
  max_lektioner_dag?: number;
}

export interface OutboxPost {
  id?: number;
  kommandoId: string;
  type: string;
  klientTidspunkt: string;
  brugerId: string | null;
  payload: any;
  sendtStatus: 'afventer' | 'sender' | 'fejlet';
}

export interface MetaPost {
  noegle: string;
  vaerdi: any;
}

export class BBRidecenterDB extends Dexie {
  brugere!: Table<LokalBruger, string>;
  vikarkoder!: Table<LokalVikarKode, string>;
  lektioner!: Table<LokalLektion, string>;
  pladser!: Table<LokalPlads, string>;
  heste!: Table<LokalHest, string>;
  outbox!: Table<OutboxPost, number>;
  meta!: Table<MetaPost, string>;

  constructor() {
    super('BBRidecenterDB');
    this.version(1).stores({
      brugere: 'id, navn',
      vikarkoder: 'id, status',
      lektioner: 'id, dato, holdId, starttid',
      pladser: 'id, lektionId, rytterId, aktuelHestId',
      heste: 'id, navn, sundhedsstatus',
      outbox: '++id, kommandoId, type, klientTidspunkt, sendtStatus',
      meta: 'noegle',
    });
  }
}

export const db = new BBRidecenterDB();

export async function nulstilLokalDB(): Promise<void> {
  await db.transaction('rw', [db.brugere, db.vikarkoder, db.lektioner, db.pladser, db.heste, db.outbox, db.meta], async () => {
    await db.brugere.clear();
    await db.vikarkoder.clear();
    await db.lektioner.clear();
    await db.pladser.clear();
    await db.heste.clear();
    await db.outbox.clear();
    await db.meta.clear();
  });
}

export async function hentOutbox(): Promise<OutboxPost[]> {
  return db.outbox.orderBy('id').toArray();
}

export async function tilfoejOutbox(kommando: KommandoKuvert): Promise<number> {
  return db.outbox.add({
    kommandoId: kommando.kommando_id,
    type: kommando.type,
    klientTidspunkt: kommando.klient_tidspunkt,
    brugerId: kommando.bruger_id,
    payload: kommando.payload,
    sendtStatus: 'afventer',
  });
}

export async function fjernFraOutbox(kommandoId: string): Promise<void> {
  const match = await db.outbox.where('kommandoId').equals(kommandoId).first();
  if (match && match.id !== undefined) {
    await db.outbox.delete(match.id);
  }
}

