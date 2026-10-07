import type { CheatSheetKort } from '@ridecenter/contracts';
import type { PrismaClient } from '@prisma/client';
import type { Krypto } from '../../plugins/krypto';
import { DomaeneFejl } from '../../plugins/fejl';

function formaterKortNavn(fornavn: string, efternavn: string): string {
  const efternavnInitial = efternavn.trim().charAt(0)?.toUpperCase();
  return efternavnInitial ? `${fornavn} ${efternavnInitial}.` : fornavn;
}

export class CheatSheetService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly krypto: Krypto,
  ) {}

  /**
   * Returnerer et GDPR-sikkert Cheat Sheet for en lektion.
   * Indeholder KUN standardiserede koder og handlingsorienteret anonymiseret adfærdsinstruks.
   * Indeholder ALDRIG: CPR, højde, vægt, fødselsdato, diagnosebetegnelser eller kontaktinfo.
   */
  async hentLektionCheatSheet(lektionId: string): Promise<CheatSheetKort[]> {
    const lektion = await this.prisma.lektion.findUnique({
      where: { id: lektionId },
      include: {
        pladser: {
          include: {
            rytter: {
              include: {
                sikkerhedsprofil: true,
              },
            },
            aktuel_hest: true,
            planlagt_hest: true,
          },
        },
      },
    });

    if (!lektion) {
      throw new DomaeneFejl('LEKTION_IKKE_FUNDET', 'Lektionen findes ikke', 404);
    }

    const kortListe: CheatSheetKort[] = [];

    for (const plads of lektion.pladser) {
      const rytter = plads.rytter;
      const profil = rytter.sikkerhedsprofil;
      const hest = plads.aktuel_hest ?? plads.planlagt_hest;

      let adfaerdsinstruks: string | null = null;
      if (profil?.adfaerdsinstruks) {
        try {
          adfaerdsinstruks = this.krypto.dekrypter(profil.adfaerdsinstruks);
        } catch {
          adfaerdsinstruks = null;
        }
      }

      kortListe.push({
        plads_id: plads.id,
        rytter_navn_kort: formaterKortNavn(rytter.fornavn, rytter.efternavn),
        hest_navn: hest ? hest.navn : null,
        cheat_sheet_koder: profil?.cheat_sheet_koder ?? [],
        adfaerdsinstruks,
      });
    }

    return kortListe;
  }
}

