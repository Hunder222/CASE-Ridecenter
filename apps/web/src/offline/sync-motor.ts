import type { KommandoKuvert, PushAnmodning, PushSvar, SynkTilstand } from '@ridecenter/contracts';
import { db, fjernFraOutbox, hentOutbox } from './dexie-db';

type SynkLytter = (tilstand: SynkTilstand, outboxAntal: number, advarsler: string[]) => void;

class SyncMotor {
  private tilstand: SynkTilstand = 'online';
  private lyttere = new Set<SynkLytter>();
  private advarsler: string[] = [];
  private debounceTimer: any = null;
  private intervalTimer: any = null;
  private igangvaerendeSync = false;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.syncNu());
      window.addEventListener('offline', () => this.opdaterTilstand('offline'));
      window.addEventListener('focus', () => this.syncNu());

      // Periodisk sync hvert 30. sekund
      this.intervalTimer = setInterval(() => {
        if (navigator.onLine) {
          this.syncNu();
        }
      }, 30000);

      // SSE-lytter for realtids-opdateringer (T136)
      try {
        const eventSource = new EventSource('/api/v1/events');
        eventSource.addEventListener('lektioner.publiceret', () => {
          this.syncNu();
        });
        eventSource.addEventListener('oensker.opdateret', () => {
          this.syncNu();
        });
        eventSource.addEventListener('plads.opdateret', () => {
          this.syncNu();
        });
      } catch (err) {
        console.warn('Kunne ikke oprette EventSource for realtids-sync:', err);
      }
    }
  }

  tilfoejLytter(lytter: SynkLytter): () => void {
    this.lyttere.add(lytter);
    this.notificer();
    return () => this.lyttere.delete(lytter);
  }

  private async notificer() {
    const poster = await hentOutbox();
    for (const l of this.lyttere) {
      l(this.tilstand, poster.length, this.advarsler);
    }
  }

  private opdaterTilstand(nyTilstand: SynkTilstand) {
    this.tilstand = nyTilstand;
    this.notificer();
  }

  /**
   * Planlægger en sync med 2 sekunders debounce efter ny handling i outbox.
   */
  planlaegSync() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.syncNu();
    }, 2000);
  }

  /**
   * Kører sync-loopet:
   * 1. Sender outbox-poster via POST /api/v1/sync/push
   * 2. Henter nyeste data via GET /api/v1/sync/pull og opdaterer Dexie
   */
  async syncNu(): Promise<void> {
    if (this.igangvaerendeSync) return;
    if (!navigator.onLine) {
      this.opdaterTilstand('offline');
      return;
    }

    this.igangvaerendeSync = true;
    this.opdaterTilstand('synkroniserer');

    try {
      // Hent op til 500 poster fra outbox
      const poster = await hentOutbox();

      if (poster.length > 0) {
        const kommandoer: KommandoKuvert[] = poster.slice(0, 500).map((p) => ({
          kommando_id: p.kommandoId,
          type: p.type as any,
          klient_tidspunkt: p.klientTidspunkt,
          bruger_id: p.brugerId,
          payload: p.payload,
        }));

        // Send til API
        const enhedNoegle = localStorage.getItem('ridecenter_enhedsnoegle') ?? '';
        const pushRes = await fetch('/api/v1/sync/push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Enhed-Noegle': enhedNoegle,
          },
          body: JSON.stringify({ kommandoer } satisfies PushAnmodning),
        });

        if (!pushRes.ok) {
          throw new Error(`Push fejlede med status ${pushRes.status}`);
        }

        const pushData: PushSvar = await pushRes.json();

        // Behandl resultater
        for (const resultat of pushData.resultater) {
          if (resultat.status === 'Anvendt' || resultat.status === 'AlleredeAnvendt') {
            await fjernFraOutbox(resultat.kommando_id);
          } else if (resultat.status === 'Konflikt' || resultat.status === 'Afvist') {
            await fjernFraOutbox(resultat.kommando_id);
            if (resultat.besked) {
              this.advarsler.push(resultat.besked);
            }
          }
        }
      }

      // Kør Pull
      await this.pull();

      if (this.advarsler.length > 0) {
        this.opdaterTilstand('advarsel');
      } else {
        this.opdaterTilstand('online');
      }
    } catch (err) {
      console.error('Fejl i sync:', err);
      this.opdaterTilstand(navigator.onLine ? 'advarsel' : 'offline');
    } finally {
      this.igangvaerendeSync = false;
      this.notificer();
    }
  }

  /**
   * Henter nyeste snapshot fra /api/v1/sync/pull og gemmer i Dexie.
   */
  private async pull(): Promise<void> {
    const enhedNoegle = localStorage.getItem('ridecenter_enhedsnoegle') ?? '';
    const res = await fetch('/api/v1/sync/pull', {
      headers: {
        'X-Enhed-Noegle': enhedNoegle,
      },
    });

    if (!res.ok) return;

    const data = await res.json();
    const { aendringer } = data;

    if (!aendringer) return;

    await db.transaction('rw', [db.lektioner, db.pladser, db.heste, db.brugere, db.vikarkoder], async () => {
      if (aendringer.lektioner) {
        await db.lektioner.clear();
        await db.lektioner.bulkPut(aendringer.lektioner);
      }
      if (aendringer.pladser) {
        await db.pladser.clear();
        await db.pladser.bulkPut(aendringer.pladser);
      }
      if (aendringer.heste) {
        await db.heste.clear();
        await db.heste.bulkPut(aendringer.heste);
      }
      if (aendringer.brugere) {
        await db.brugere.clear();
        await db.brugere.bulkPut(aendringer.brugere);
      }
      if (aendringer.vikarkoder) {
        await db.vikarkoder.clear();
        await db.vikarkoder.bulkPut(aendringer.vikarkoder);
      }
    });
  }

  nulstilAdvarsler() {
    this.advarsler = [];
    this.notificer();
  }
}

export const syncMotor = new SyncMotor();

