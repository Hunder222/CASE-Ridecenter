import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { nulstilData, prisma } from '../helpers/db';

// Princip III: revisionssporet kan ikke ændres eller slettes, heller ikke med rå SQL.

describe('audit_haendelse er append-only', () => {
  beforeEach(nulstilData);
  afterAll(() => prisma.$disconnect());

  it('tillader INSERT men afviser UPDATE og DELETE', async () => {
    const id = randomUUID();
    await prisma.auditHaendelse.create({
      data: {
        id,
        server_tidspunkt: new Date(),
        bruger_navn: 'Test',
        rolle: 'System',
        handling: 'TEST',
        entitet: 'test',
        entitet_id: '1',
        forrige_hash: '0'.repeat(64),
        hash: 'a'.repeat(64),
      },
    });

    await expect(
      prisma.auditHaendelse.update({ where: { id }, data: { bruger_navn: 'Manipuleret' } }),
    ).rejects.toThrow(/append-only/);
    await expect(prisma.auditHaendelse.delete({ where: { id } })).rejects.toThrow(/append-only/);
    await expect(
      prisma.$executeRaw`UPDATE audit_haendelse SET hash = 'x' WHERE id = ${id}::uuid`,
    ).rejects.toThrow(/append-only/);

    const raekke = await prisma.auditHaendelse.findUniqueOrThrow({ where: { id } });
    expect(raekke.bruger_navn).toBe('Test');
    expect(raekke.hash).toBe('a'.repeat(64));
  });
});
