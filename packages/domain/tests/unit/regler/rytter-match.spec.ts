import { describe, expect, it } from 'vitest';
import {
  beregnEgnethed,
  hc07Sikkerhed,
  type HestData,
  type HoldData,
  type Niveau,
  type RytterRegelData,
} from '../../../src/index';
import { basis, lavHest, lavHold, lavRytter } from '../../fixtures/byggere';

// HC-06 – HC-08: rytter × hest × hold. De statiske regler testes gennem beregnEgnethed
// (domain-engine.md §1). hc07Sikkerhed testes også direkte, fordi ønsker bruger den til kan_opfyldes.

/** Årsagskoderne for én hest ([] = godkendt). */
function udelukkelse(rytter: RytterRegelData, hold: HoldData, hest: HestData): string[] {
  const { godkendte, udelukkede } = beregnEgnethed(rytter, hold, [hest]);
  expect(godkendte.length + udelukkede.length).toBe(1);
  if (godkendte.includes(hest.id)) return [];
  const fundet = udelukkede.find((u) => u.hestId === hest.id);
  expect(fundet?.koder.length).toBeGreaterThan(0);
  return basis(fundet?.koder ?? []);
}

const letoevet = lavHold();
const begynderhold = lavHold({ id: 'hold-begynder', holdnavn: 'Fredag 15:00 Begynder', niveau: 'Begynder' });
const oevethold = lavHold({ id: 'hold-oevet', holdnavn: 'Fredag 16:30 Øvet', niveau: 'Oevet' });

describe('HC-06: rytterens vægt og højde skal passe til hesten', () => {
  const hest = lavHest({ maxRytterVaegtKg: 65, maxRytterHoejdeCm: 150 });

  it('giver HC06_VAEGT, når rytteren vejer mere end hestens grænse', () => {
    expect(udelukkelse(lavRytter({ vaegtKg: 66 }), letoevet, hest)).toEqual(['HC06_VAEGT']);
  });

  it('giver HC06_HOEJDE, når rytteren er højere end hestens grænse', () => {
    expect(udelukkelse(lavRytter({ hoejdeCm: 151 }), letoevet, hest)).toEqual(['HC06_HOEJDE']);
  });

  it('er lovlig, når vægt og højde er lig grænserne', () => {
    expect(udelukkelse(lavRytter({ vaegtKg: 65, hoejdeCm: 150 }), letoevet, hest)).toEqual([]);
  });

  it('giver begge koder, når rytteren er for tung og for høj', () => {
    expect(udelukkelse(lavRytter({ vaegtKg: 70, hoejdeCm: 160 }), letoevet, hest)).toEqual(
      expect.arrayContaining(['HC06_VAEGT', 'HC06_HOEJDE']),
    );
  });

  it('tillader alle højder, når hesten ikke har en højdegrænse (null)', () => {
    const storHest = lavHest({
      navn: 'Aslan',
      stangmaalCm: 160,
      maxRytterVaegtKg: 80,
      maxRytterHoejdeCm: null,
    });
    expect(udelukkelse(lavRytter({ hoejdeCm: 200, vaegtKg: 60 }), letoevet, storHest)).toEqual([]);
  });
});

describe('HC-07: rytterens sikkerhedsspærringer', () => {
  const pixie = lavHest({ navn: 'Pixie', temperament: 'Frisk' });
  const donny = lavHest({ navn: 'Donny' });
  const toobi = lavHest({ navn: 'Toobi', temperament: 'Rolig' });

  it('giver HC07_FORBUDT_HEST for en forbudt hest', () => {
    const emma = lavRytter({ forbudteHeste: [pixie.id] });
    expect(udelukkelse(emma, letoevet, pixie)).toEqual(['HC07_FORBUDT_HEST']);
    expect(udelukkelse(emma, letoevet, donny)).toEqual([]);
  });

  it('giver HC07_KUN_PAAKRAEVET for alle andre heste end de påkrævede', () => {
    const anna = lavRytter({ paakraevedeHeste: [donny.id] });
    expect(udelukkelse(anna, letoevet, toobi)).toEqual(['HC07_KUN_PAAKRAEVET']);
    expect(udelukkelse(anna, letoevet, donny)).toEqual([]);
  });

  it('giver HC07_KUN_ROLIG for en frisk hest til en nervøs rytter, men tillader Normal og Rolig', () => {
    const nervoes = lavRytter({ kunRoligeHeste: true });
    expect(udelukkelse(nervoes, letoevet, pixie)).toEqual(['HC07_KUN_ROLIG']);
    expect(udelukkelse(nervoes, letoevet, donny)).toEqual([]);
    expect(udelukkelse(nervoes, letoevet, toobi)).toEqual([]);
  });

  it('hc07Sikkerhed giver de samme koder og ser kun på HC-07 (bruges til kan_opfyldes)', () => {
    expect(basis(hc07Sikkerhed(lavRytter({ forbudteHeste: [pixie.id] }), pixie))).toEqual([
      'HC07_FORBUDT_HEST',
    ]);
    expect(basis(hc07Sikkerhed(lavRytter({ paakraevedeHeste: [donny.id] }), toobi))).toEqual([
      'HC07_KUN_PAAKRAEVET',
    ]);
    expect(basis(hc07Sikkerhed(lavRytter({ kunRoligeHeste: true }), pixie))).toEqual(['HC07_KUN_ROLIG']);
    // For tung rytter er HC-06, ikke HC-07.
    expect(hc07Sikkerhed(lavRytter({ vaegtKg: 99 }), donny)).toEqual([]);
  });
});

describe('HC-08: holdets niveau', () => {
  const ikkeBegynderhest = lavHest({ navn: 'Zigge', godkendtTilBegyndere: false });
  const ikkeOevethest = lavHest({ navn: 'Arthur', stangmaalCm: 127, egnetOevet: false });

  it('giver HC08_NIVEAU_BEGYNDER for en hest, der ikke er godkendt til begyndere', () => {
    expect(udelukkelse(lavRytter(), begynderhold, ikkeBegynderhest)).toEqual(['HC08_NIVEAU_BEGYNDER']);
    expect(udelukkelse(lavRytter(), begynderhold, lavHest({ godkendtTilBegyndere: true }))).toEqual([]);
  });

  it('giver HC08_NIVEAU_OEVET for en hest, der ikke er egnet til øvede hold', () => {
    expect(udelukkelse(lavRytter(), oevethold, ikkeOevethest)).toEqual(['HC08_NIVEAU_OEVET']);
  });

  it('kræver ikke egnetOevet på et begynderhold', () => {
    const begyndervenlig = lavHest({ godkendtTilBegyndere: true, egnetOevet: false });
    expect(udelukkelse(lavRytter(), begynderhold, begyndervenlig)).toEqual([]);
  });

  it.each<Niveau>(['Traekhold', 'Letoevet', 'Parthold'])('%s har intet niveaukrav', (niveau) => {
    const hold = lavHold({ id: `hold-${niveau}`, niveau });
    const hest = lavHest({ godkendtTilBegyndere: false, egnetOevet: false });
    expect(udelukkelse(lavRytter(), hold, hest)).toEqual([]);
  });
});

describe('HC-08: partaftaler', () => {
  const aida = lavHest({ navn: 'Aida', stangmaalCm: 128, maxRytterVaegtKg: 48, godkendtTilBegyndere: false });
  const laerke = lavRytter({ id: 'rytter-laerke', partaftaleHestId: aida.id });
  const medPart = (hold: HoldData, partrytter: string): HoldData => ({
    ...hold,
    partheste: { [aida.id]: partrytter },
  });

  it('giver HC08_PARTHEST_RESERVERET for en anden rytters parthest på samme hold', () => {
    const sofia = lavRytter({ id: 'rytter-sofia' });
    expect(udelukkelse(sofia, medPart(letoevet, laerke.id), aida)).toEqual(['HC08_PARTHEST_RESERVERET']);
  });

  it('lader partrytteren bruge sin egen parthest på et hold uden niveaukrav', () => {
    expect(udelukkelse(laerke, medPart(letoevet, laerke.id), aida)).toEqual([]);
  });

  it('giver HC08_PART_UDEN_NIVEAUGODKENDELSE for egen parthest på et begynderhold uden markering', () => {
    expect(udelukkelse(laerke, medPart(begynderhold, laerke.id), aida)).toEqual([
      'HC08_PART_UDEN_NIVEAUGODKENDELSE',
    ]);
  });

  it('giver HC08_PART_UDEN_NIVEAUGODKENDELSE for egen parthest på et øvet hold, hesten ikke er egnet til', () => {
    const parthest = lavHest({ navn: 'Arthur', stangmaalCm: 127, egnetOevet: false });
    const partrytter = lavRytter({ id: 'rytter-part', partaftaleHestId: parthest.id });
    const hold = { ...oevethold, partheste: { [parthest.id]: partrytter.id } };
    expect(udelukkelse(partrytter, hold, parthest)).toEqual(['HC08_PART_UDEN_NIVEAUGODKENDELSE']);
  });

  it('er lovlig med markeringen "godkendt trods niveau"', () => {
    const godkendt = { ...laerke, partaftaleGodkendtTrodsNiveau: true };
    expect(udelukkelse(godkendt, medPart(begynderhold, laerke.id), aida)).toEqual([]);
  });

  it('markeringen ophæver kun niveaukravet: HC-06 gælder stadig', () => {
    const tungOgGodkendt = { ...laerke, vaegtKg: 60, partaftaleGodkendtTrodsNiveau: true };
    expect(udelukkelse(tungOgGodkendt, medPart(begynderhold, laerke.id), aida)).toEqual(['HC06_VAEGT']);
  });

  it('markeringen gælder kun egen parthest, ikke andre heste på begynderholdet', () => {
    const godkendt = { ...laerke, partaftaleGodkendtTrodsNiveau: true };
    const zigge = lavHest({ navn: 'Zigge', godkendtTilBegyndere: false });
    expect(udelukkelse(godkendt, medPart(begynderhold, laerke.id), zigge)).toEqual(['HC08_NIVEAU_BEGYNDER']);
  });
});
