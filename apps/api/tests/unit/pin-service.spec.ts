import { describe, expect, it } from 'vitest';
import { hashPin, MAX_FORSOEG, PinLaas, validerPin, VINDUE_MS } from '../../src/moduler/auth/pin-service';

describe('pin-service', () => {
  it('hasher med Argon2id og validerer', async () => {
    const hash = await hashPin('2222');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await validerPin('2222', hash)).toBe(true);
    expect(await validerPin('2223', hash)).toBe(false);
    expect(await validerPin('2222', 'ikke-en-hash')).toBe(false);
  });

  it('spærrer efter 5 fejl inden for 60 sek. og åbner igen efter vinduet', () => {
    let nu = new Date('2026-10-09T13:00:00Z');
    const laas = new PinLaas(() => nu);
    for (let i = 0; i < MAX_FORSOEG - 1; i++) laas.registrerFejl('enhed-1');
    expect(laas.spaerretSekunder('enhed-1')).toBe(0);
    laas.registrerFejl('enhed-1');
    expect(laas.spaerretSekunder('enhed-1')).toBeGreaterThan(0);
    expect(laas.spaerretSekunder('enhed-2')).toBe(0);
    nu = new Date(nu.getTime() + VINDUE_MS + 1);
    expect(laas.spaerretSekunder('enhed-1')).toBe(0);
  });

  it('nulstil fjerner fejlene', () => {
    const laas = new PinLaas(() => new Date());
    for (let i = 0; i < MAX_FORSOEG; i++) laas.registrerFejl('x');
    laas.nulstil('x');
    expect(laas.spaerretSekunder('x')).toBe(0);
  });
});

