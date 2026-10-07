import * as argon2 from 'argon2';

// PIN-sikkerhed (FR-004, FR-005, sync-protocol §7): Argon2id på serveren, spærring efter 5 forkerte
// forsøg inden for 60 sek. pr. enhed. Spærringen holdes i hukommelsen (POC, én serverproces).

export const MAX_FORSOEG = 5;
export const VINDUE_MS = 60_000;

export function hashPin(pin: string): Promise<string> {
  return argon2.hash(pin, { type: argon2.argon2id });
}

export async function validerPin(pin: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, pin);
  } catch {
    return false;
  }
}

export class PinLaas {
  private readonly fejl = new Map<string, number[]>();

  constructor(private readonly ur: () => Date) {}

  private friske(noegle: string): number[] {
    const nu = this.ur().getTime();
    const friske = (this.fejl.get(noegle) ?? []).filter((t) => nu - t < VINDUE_MS);
    if (friske.length > 0) this.fejl.set(noegle, friske);
    else this.fejl.delete(noegle);
    return friske;
  }

  /** Sekunder til spærringen udløber, eller 0 hvis nøglen ikke er spærret. */
  spaerretSekunder(noegle: string): number {
    const friske = this.friske(noegle);
    if (friske.length < MAX_FORSOEG) return 0;
    const udloeb = (friske[0] ?? 0) + VINDUE_MS;
    return Math.max(1, Math.ceil((udloeb - this.ur().getTime()) / 1000));
  }

  registrerFejl(noegle: string): void {
    const friske = this.friske(noegle);
    friske.push(this.ur().getTime());
    this.fejl.set(noegle, friske);
  }

  nulstil(noegle: string): void {
    this.fejl.delete(noegle);
  }
}

