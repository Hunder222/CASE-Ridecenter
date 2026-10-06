import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// AES-256-GCM på applikationsniveau for GDPR art. 9-felter (research R8).
// Format: v1:<iv base64>:<auth-tag base64>:<chiffertekst base64>

const VERSION = 'v1';
const IV_BYTES = 12;
const TAG_BYTES = 16;

export function krypter(noegle: Buffer, klartekst: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', noegle, iv, { authTagLength: TAG_BYTES });
  const data = Buffer.concat([cipher.update(klartekst, 'utf8'), cipher.final()]);
  return [
    VERSION,
    iv.toString('base64'),
    cipher.getAuthTag().toString('base64'),
    data.toString('base64'),
  ].join(':');
}

/** Kaster ved ukendt format, forkert nøgle eller manipuleret chiffertekst. */
export function dekrypter(noegle: Buffer, chiffer: string): string {
  const dele = chiffer.split(':');
  if (dele.length !== 4 || dele[0] !== VERSION) throw new Error('Ukendt chifferformat');
  const [, iv, tag, data] = dele as [string, string, string, string];
  const decipher = createDecipheriv('aes-256-gcm', noegle, Buffer.from(iv, 'base64'), {
    authTagLength: TAG_BYTES,
  });
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
}

export function erKrypteret(vaerdi: unknown): boolean {
  return typeof vaerdi === 'string' && vaerdi.startsWith(`${VERSION}:`) && vaerdi.split(':').length === 4;
}
