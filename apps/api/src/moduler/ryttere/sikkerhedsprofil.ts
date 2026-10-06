import type { Sikkerhedsprofil as ProfilRaekke } from '@prisma/client';
import { Sikkerhedsprofil, SikkerhedsprofilInput } from '@ridecenter/contracts';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { IdParams } from '../../faelles';
import { DomaeneFejl } from '../../plugins/fejl';
import type { Krypto } from '../../plugins/krypto';
import { aktuelBruger, kraevRoller } from '../../plugins/rbac';
import { logHaendelse } from '../audit/audit-service';

// Sikkerhedsprofil (FR-003, GDPR art. 9, Princip IV): kun Ledelse. Noterne er krypteret med AES-256-GCM,
// hver læsning auditlogges, og revisionssporet viser kun "ændret" for de krypterede felter.

const KRYPTEREDE_FELTER = ['faldtraume_note', 'angstkategori', 'intern_note'] as const;

function profilDto(rytterId: string, profil: ProfilRaekke | null, krypto: Krypto): Sikkerhedsprofil {
  const dekrypter = (vaerdi: string | null | undefined) => (vaerdi ? krypto.dekrypter(vaerdi) : null);
  return {
    rytter_id: rytterId,
    faldtraume_note: dekrypter(profil?.faldtraume_note),
    angstkategori: dekrypter(profil?.angstkategori),
    intern_note: dekrypter(profil?.intern_note),
    forbudte_heste: profil?.forbudte_heste ?? [],
    paakraevede_heste: profil?.paakraevede_heste ?? [],
    kun_rolige_heste: profil?.kun_rolige_heste ?? false,
  };
}

export const sikkerhedsprofilRuter: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/ryttere/:id/sikkerhedsprofil',
    { onRequest: kraevRoller('Ledelse'), schema: { params: IdParams, response: { 200: Sikkerhedsprofil } } },
    async (request) => {
      const { id } = request.params;
      return app.prisma.$transaction(async (tx) => {
        const rytter = await tx.rytter.findUnique({ where: { id }, include: { sikkerhedsprofil: true } });
        if (!rytter) throw new DomaeneFejl('IKKE_FUNDET', 'Rytteren findes ikke', 404);
        await logHaendelse(tx, {
          handling: 'SIKKERHEDSPROFIL_LAEST',
          entitet: 'sikkerhedsprofil',
          entitet_id: id,
          bruger: aktuelBruger(request),
          tidspunkt: app.ur(),
        });
        return profilDto(id, rytter.sikkerhedsprofil, app.krypto);
      });
    },
  );

  app.put(
    '/ryttere/:id/sikkerhedsprofil',
    {
      onRequest: kraevRoller('Ledelse'),
      schema: { params: IdParams, body: SikkerhedsprofilInput, response: { 200: Sikkerhedsprofil } },
    },
    async (request) => {
      const { id } = request.params;
      const input = request.body;
      const bruger = aktuelBruger(request);
      if (input.forbudte_heste.some((hestId) => input.paakraevede_heste.includes(hestId))) {
        throw new DomaeneFejl(
          'MODSTRIDENDE_SPAERRINGER',
          'En hest kan ikke både være forbudt og påkrævet for samme rytter',
          422,
        );
      }
      return app.prisma.$transaction(async (tx) => {
        const rytter = await tx.rytter.findUnique({ where: { id }, include: { sikkerhedsprofil: true } });
        if (!rytter) throw new DomaeneFejl('IKKE_FUNDET', 'Rytteren findes ikke', 404);
        const hesteIder = [...new Set([...input.forbudte_heste, ...input.paakraevede_heste])];
        if ((await tx.hest.count({ where: { id: { in: hesteIder } } })) !== hesteIder.length) {
          throw new DomaeneFejl('UKENDT_HEST', 'En af hestene findes ikke', 422);
        }
        const krypter = (vaerdi: string | null) => (vaerdi ? app.krypto.krypter(vaerdi) : null);
        const data = {
          faldtraume_note: krypter(input.faldtraume_note),
          angstkategori: krypter(input.angstkategori),
          intern_note: krypter(input.intern_note),
          forbudte_heste: input.forbudte_heste,
          paakraevede_heste: input.paakraevede_heste,
          kun_rolige_heste: input.kun_rolige_heste,
          opdateret_af: bruger.id,
          opdateret: app.ur(),
        };
        await tx.sikkerhedsprofil.upsert({
          where: { rytter_id: id },
          create: { rytter_id: id, ...data },
          update: data,
        });
        const foer = rytter.sikkerhedsprofil;
        await logHaendelse(tx, {
          handling: 'SIKKERHEDSPROFIL_AENDRET',
          entitet: 'sikkerhedsprofil',
          entitet_id: id,
          bruger,
          tidspunkt: app.ur(),
          foer: foer && {
            faldtraume_note: foer.faldtraume_note,
            angstkategori: foer.angstkategori,
            intern_note: foer.intern_note,
            forbudte_heste: foer.forbudte_heste,
            paakraevede_heste: foer.paakraevede_heste,
            kun_rolige_heste: foer.kun_rolige_heste,
          },
          efter: {
            faldtraume_note: data.faldtraume_note,
            angstkategori: data.angstkategori,
            intern_note: data.intern_note,
            forbudte_heste: data.forbudte_heste,
            paakraevede_heste: data.paakraevede_heste,
            kun_rolige_heste: data.kun_rolige_heste,
          },
          krypteredeFelter: KRYPTEREDE_FELTER,
        });
        return {
          rytter_id: id,
          faldtraume_note: input.faldtraume_note,
          angstkategori: input.angstkategori,
          intern_note: input.intern_note,
          forbudte_heste: input.forbudte_heste,
          paakraevede_heste: input.paakraevede_heste,
          kun_rolige_heste: input.kun_rolige_heste,
        };
      });
    },
  );
};
