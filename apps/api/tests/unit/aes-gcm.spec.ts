import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { dekrypter, erKrypteret, krypter } from '../../src/krypto/aes-gcm';

const noegle = randomBytes(32);
const klartekst = 'Faldet af Pixie og brækket armen (fiktiv) – æøå';

describe('AES-256-GCM til art. 9-felter', () => {
  it('krypterer og dekrypterer tekst med æøå', () => {
    const chiffer = krypter(noegle, klartekst);

    expect(erKrypteret(chiffer)).toBe(true);
    expect(chiffer).not.toContain('Pixie');
    expect(dekrypter(noegle, chiffer)).toBe(klartekst);
  });

  it('giver forskellig chiffer for samme tekst (tilfældig IV)', () => {
    expect(krypter(noegle, klartekst)).not.toBe(krypter(noegle, klartekst));
  });

  it('afviser manipuleret auth-tag', () => {
    const [version, iv, tag, data] = krypter(noegle, klartekst).split(':') as [
      string,
      string,
      string,
      string,
    ];
    const tagBytes = Buffer.from(tag, 'base64');
    tagBytes[0] = (tagBytes[0] ?? 0) ^ 0xff;
    const manipuleret = [version, iv, tagBytes.toString('base64'), data].join(':');

    expect(() => dekrypter(noegle, manipuleret)).toThrow();
  });

  it('afviser forkert nøgle', () => {
    expect(() => dekrypter(randomBytes(32), krypter(noegle, klartekst))).toThrow();
  });

  it('afviser ukendt format', () => {
    expect(() => dekrypter(noegle, 'klartekst')).toThrow('Ukendt chifferformat');
    expect(erKrypteret('klartekst')).toBe(false);
  });
});
