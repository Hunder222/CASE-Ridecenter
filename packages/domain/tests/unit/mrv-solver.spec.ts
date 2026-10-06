import { describe, expect, it } from 'vitest';
import {
  mrvGreedySolver,
  validerPlan,
  type AllokeringsInput,
  type AllokeringsResultat,
} from '../../src/index';
import {
  basis,
  blandRaekkefoelge,
  lavHest,
  lavHold,
  lavInput,
  lavOensker,
  lavRytter,
  lavTilmelding,
  tildelingFor,
  tilPlan,
} from '../fixtures/byggere';

// mrv-greedy@1 (R5, domain-engine.md §6 e–h) på små, håndbyggede fixtures.

function koer(input: AllokeringsInput): AllokeringsResultat {
  return mrvGreedySolver.allokér(input);
}

/** n heste med id h01…, så id-rækkefølgen er entydig. */
function nummereredeHeste(n: number, overskriv: (nr: number) => Parameters<typeof lavHest>[0] = () => ({})) {
  return Array.from({ length: n }, (_, i) => {
    const nr = String(i + 1).padStart(2, '0');
    return lavHest({ id: `h${nr}`, navn: `Hest ${nr}`, ...overskriv(i + 1) });
  });
}

function forventForklaret(resultat: AllokeringsResultat): void {
  for (const tildeling of resultat.tildelinger) {
    expect(tildeling.koder.length, tildeling.holdtilmeldingId).toBeGreaterThan(0);
    expect(tildeling.tekst.trim(), tildeling.holdtilmeldingId).not.toBe('');
  }
}

/** Fixture (5): tre ryttere med højere turnus tager hver sit 1. ønske, den fjerde ønskede alle tre. */
function alleOenskerOptaget() {
  const [h1, h2, h3, h4] = nummereredeHeste(4);
  if (!h1 || !h2 || !h3 || !h4) throw new Error('Mangler heste');
  const ryttere = ['r1', 'r2', 'r3', 'r4'].map((id) => lavRytter({ id }));
  const input = lavInput({
    heste: [h1, h2, h3, h4],
    ryttere,
    oensker: [
      ...lavOensker('r1', h1.id),
      ...lavOensker('r2', h2.id),
      ...lavOensker('r3', h3.id),
      ...lavOensker('r4', h1.id, h2.id, h3.id),
    ],
    turnus: { r1: 2, r2: 2, r3: 2, r4: 0 },
  });
  return { input, heste: { h1, h2, h3, h4 } };
}

describe('mrvGreedySolver', () => {
  it('har versionen mrv-greedy@1', () => {
    expect(mrvGreedySolver.version).toBe('mrv-greedy@1');
  });

  describe('(1) påkrævet hest', () => {
    const donny = lavHest({ navn: 'Donny' });
    const toobi = lavHest({ navn: 'Toobi' });
    const anna = lavRytter({ id: 'r1-anna', paakraevedeHeste: [donny.id] });
    const bo = lavRytter({ id: 'r2-bo' });
    const oensker = [...lavOensker(anna.id, toobi.id), ...lavOensker(bo.id, donny.id)];

    it('placeres først, også før en rytter med højere turnus, der ønsker hesten', () => {
      const input = lavInput({ heste: [donny, toobi], ryttere: [anna, bo], oensker, turnus: { [bo.id]: 3 } });
      const resultat = koer(input);

      const annas = tildelingFor(input, resultat, anna.id);
      expect(annas.hestId).toBe(donny.id);
      expect(basis(annas.koder)).toContain('PAAKRAEVET_HEST');
      expect(tildelingFor(input, resultat, bo.id).hestId).toBe(toobi.id);
    });

    it('giver null + IKKE_TILDELT_KAPACITET, når den påkrævede hest er syg, aldrig en anden hest', () => {
      const sygDonny = { ...donny, sundhedsstatus: 'Sygemeldt' as const };
      const input = lavInput({ heste: [sygDonny, toobi], ryttere: [anna, bo], oensker });
      const resultat = koer(input);

      const annas = tildelingFor(input, resultat, anna.id);
      expect(annas.hestId).toBeNull();
      expect(basis(annas.koder)).toEqual(
        expect.arrayContaining(['IKKE_TILDELT_KAPACITET', 'PAAKRAEVET_HEST']),
      );
      expect(resultat.tildelinger.map((t) => t.hestId)).not.toContain(sygDonny.id);
    });
  });

  it('(2) giver partrytteren sin parthest med PARTAFTALE og reserverer den for andre', () => {
    const belle = lavHest({ navn: 'Belle' });
    const toobi = lavHest({ navn: 'Toobi' });
    const freja = lavRytter({ id: 'r1-freja', partaftaleHestId: belle.id });
    const agnes = lavRytter({ id: 'r2-agnes' });
    const input = lavInput({
      heste: [belle, toobi],
      ryttere: [freja, agnes],
      oensker: lavOensker(agnes.id, belle.id, toobi.id),
      turnus: { [agnes.id]: 3 },
    });
    const resultat = koer(input);

    const frejas = tildelingFor(input, resultat, freja.id);
    expect(frejas.hestId).toBe(belle.id);
    expect(basis(frejas.koder)).toContain('PARTAFTALE');
    expect(frejas.turnusNaesteMaaned).toBe(0);

    const agnesTildeling = tildelingFor(input, resultat, agnes.id);
    expect(agnesTildeling.hestId).toBe(toobi.id);
    expect(agnesTildeling.oenskeOpfyldt).toBe(2);
    expect(agnesTildeling.koder).toContain(`HC08_PARTHEST_RESERVERET:${belle.id}`);
  });

  it('(3) placerer en rytter med 2 egnede heste før en med 10 (MRV), selv om den anden har højere turnus', () => {
    const heste = nummereredeHeste(10, (nr) => ({ maxRytterHoejdeCm: nr >= 9 ? null : 150 }));
    const lille = lavRytter({ id: 'r1-lille', hoejdeCm: 140 });
    const hoej = lavRytter({ id: 'r2-hoej', hoejdeCm: 170 });
    const input = lavInput({
      heste,
      ryttere: [lille, hoej],
      tilmeldinger: [
        lavTilmelding(lille.id, 'hold-test', { ancienitetDato: '2020-01-01' }),
        lavTilmelding(hoej.id, 'hold-test', { ancienitetDato: '2026-01-01' }),
      ],
      oensker: [...lavOensker(lille.id, 'h09'), ...lavOensker(hoej.id, 'h09')],
      turnus: { [lille.id]: 3 },
    });
    const resultat = koer(input);

    const hoejs = tildelingFor(input, resultat, hoej.id);
    expect(hoejs.hestId).toBe('h09');
    expect(hoejs.oenskeOpfyldt).toBe(1);
    const lilles = tildelingFor(input, resultat, lille.id);
    expect(lilles.hestId).not.toBe('h09');
    expect(lilles.koder).toContain('LEKTION_HEST_OPTAGET:h09');
  });

  it('(4) lader højeste turnus vinde en omstridt hest inden for samme MRV-gruppe', () => {
    const heste = nummereredeHeste(10);
    const x = lavRytter({ id: 'r2-x' });
    const y = lavRytter({ id: 'r1-y' });
    const input = lavInput({
      heste,
      ryttere: [x, y],
      tilmeldinger: [
        lavTilmelding(x.id, 'hold-test', { ancienitetDato: '2026-03-01' }),
        lavTilmelding(y.id, 'hold-test', { ancienitetDato: '2020-01-01' }),
      ],
      oensker: [...lavOensker(x.id, 'h01', 'h03'), ...lavOensker(y.id, 'h01', 'h02')],
      turnus: { [x.id]: 1, [y.id]: 0 },
    });
    const resultat = koer(input);

    const xs = tildelingFor(input, resultat, x.id);
    expect(xs.hestId).toBe('h01');
    expect(basis(xs.koder)).toEqual(expect.arrayContaining(['SC01_OENSKE_1', 'SC02_TURNUS_PRIORITET']));
    expect(xs.turnusNaesteMaaned).toBe(0);

    const ys = tildelingFor(input, resultat, y.id);
    expect(ys.hestId).toBe('h02');
    expect(ys.oenskeOpfyldt).toBe(2);
    expect(ys.koder).toEqual(expect.arrayContaining(['SC01_OENSKE_2', 'SC02_TABT_TIL_TURNUS:h01']));
    expect(ys.turnusNaesteMaaned).toBe(1);
  });

  it('(5) giver en alternativ hest med ALT_TILDELING og turnus +3, når alle ønsker er optaget (US2 AS4)', () => {
    const { input, heste } = alleOenskerOptaget();
    const resultat = koer(input);

    const r4 = tildelingFor(input, resultat, 'r4');
    expect(r4.hestId).toBe(heste.h4.id);
    expect(r4.erAlternativ).toBe(true);
    expect(r4.oenskeOpfyldt).toBeNull();
    expect(r4.turnusNaesteMaaned).toBe(3);
    expect(basis(r4.koder)).toContain('ALT_TILDELING');
    expect(r4.koder).toEqual(
      expect.arrayContaining([
        `SC02_TABT_TIL_TURNUS:${heste.h1.id}`,
        `SC02_TABT_TIL_TURNUS:${heste.h2.id}`,
        `SC02_TABT_TIL_TURNUS:${heste.h3.id}`,
      ]),
    );
    expect(r4.tekst).toContain('Alternativ tildeling (ønsker optaget)');
  });

  it('(6) giver null, IKKE_TILDELT_KAPACITET og turnus +3, når ingen lovlig hest er ledig', () => {
    const godkendt = lavHest({ id: 'h1', navn: 'Toobi', godkendtTilBegyndere: true });
    const ikkeGodkendt = lavHest({ id: 'h2', navn: 'Zigge', godkendtTilBegyndere: false });
    const begynderhold = lavHold({ id: 'hold-begynder', niveau: 'Begynder' });
    const r1 = lavRytter({ id: 'r1', erfaringsniveau: 'Begynder' });
    const r2 = lavRytter({ id: 'r2', erfaringsniveau: 'Begynder' });
    const input = lavInput({
      heste: [godkendt, ikkeGodkendt],
      hold: [begynderhold],
      ryttere: [r1, r2],
      tilmeldinger: [
        lavTilmelding(r1.id, begynderhold.id, { ancienitetDato: '2020-01-01' }),
        lavTilmelding(r2.id, begynderhold.id, { ancienitetDato: '2026-01-01' }),
      ],
      oensker: [...lavOensker(r1.id, godkendt.id), ...lavOensker(r2.id, ikkeGodkendt.id)],
    });
    const resultat = koer(input);

    expect(tildelingFor(input, resultat, r1.id).hestId).toBe(godkendt.id);
    const r2s = tildelingFor(input, resultat, r2.id);
    expect(r2s.hestId).toBeNull();
    expect(r2s.erAlternativ).toBe(false);
    expect(r2s.turnusNaesteMaaned).toBe(3);
    expect(basis(r2s.koder)).toContain('IKKE_TILDELT_KAPACITET');
    expect(r2s.koder).toContain(`HC08_NIVEAU_BEGYNDER:${ikkeGodkendt.id}`);
    expect(resultat.kapacitetsmangel).toEqual([
      expect.objectContaining({ holdId: begynderhold.id, antal: 1 }),
    ]);
    expect(resultat.statistik.ikkeTildelt).toBe(1);
  });

  it('(7) reparerer: flytter én anden rytter til en anden lovlig hest, så alle får en (dybde 1)', () => {
    const aslan = lavHest({ id: 'h1', navn: 'Aslan', maxRytterVaegtKg: 65 });
    const karla = lavHest({ id: 'h2', navn: 'Karla', maxRytterVaegtKg: 40 });
    const letRytter = lavRytter({ id: 'r1-let', vaegtKg: 35 });
    const tungRytter = lavRytter({ id: 'r2-tung', vaegtKg: 50 });
    const input = lavInput({
      heste: [aslan, karla],
      ryttere: [letRytter, tungRytter],
      oensker: [...lavOensker(letRytter.id, aslan.id), ...lavOensker(tungRytter.id, aslan.id)],
      turnus: { [letRytter.id]: 2 },
    });
    const resultat = koer(input);

    // Den lette rytter placeres først (højere turnus) og tager Aslan, men flyttes til Karla,
    // fordi Aslan er den eneste hest, der kan bære den tunge rytter.
    expect(tildelingFor(input, resultat, tungRytter.id).hestId).toBe(aslan.id);
    expect(tildelingFor(input, resultat, letRytter.id).hestId).toBe(karla.id);
    expect(resultat.statistik.ikkeTildelt).toBe(0);
    expect(validerPlan(tilPlan(input, resultat), input)).toEqual([]);
    forventForklaret(resultat);
  });

  it('(8) placerer hjælpere efter alle andre (SC-05)', () => {
    const heste = nummereredeHeste(8, (nr) => ({ maxRytterHoejdeCm: nr <= 2 ? null : 150 }));
    const hjaelper = lavRytter({ id: 'r1-hjaelper', erHjaelper: true, hoejdeCm: 170 });
    const elev = lavRytter({ id: 'r2-elev' });
    const input = lavInput({
      heste,
      ryttere: [hjaelper, elev],
      tilmeldinger: [
        lavTilmelding(hjaelper.id, 'hold-test', { ancienitetDato: '2020-01-01' }),
        lavTilmelding(elev.id, 'hold-test', { ancienitetDato: '2026-01-01' }),
      ],
      oensker: [...lavOensker(hjaelper.id, 'h01'), ...lavOensker(elev.id, 'h01')],
      turnus: { [hjaelper.id]: 3 },
    });
    const resultat = koer(input);

    expect(tildelingFor(input, resultat, elev.id).hestId).toBe('h01');
    const hjaelpers = tildelingFor(input, resultat, hjaelper.id);
    expect(hjaelpers.hestId).toBe('h02');
    expect(basis(hjaelpers.koder)).toContain('SC05_HJAELPER');
  });

  it('(9) tæller 1./2./3. ønske, alternativ og ikke-tildelt i statistik', () => {
    const { input } = alleOenskerOptaget();
    const resultat = koer(input);
    expect(resultat.statistik).toEqual({ oenske1: 3, oenske2: 0, oenske3: 0, alternativ: 1, ikkeTildelt: 0 });
    expect(resultat.kapacitetsmangel).toEqual([]);
  });

  it('(10) giver hver tildeling ikke-tomme koder og tekst og én tildeling pr. tilmelding', () => {
    const { input } = alleOenskerOptaget();
    const resultat = koer(input);
    forventForklaret(resultat);
    expect(resultat.tildelinger.map((t) => t.holdtilmeldingId).sort()).toEqual(
      input.tilmeldinger.map((t) => t.id).sort(),
    );
  });

  describe('(11) determinisme', () => {
    const heste = ['Aslan', 'Belle', 'Donny', 'Toobi', 'Zigge', 'Pixie'].map((navn) => lavHest({ navn }));
    const hold = ['15:00', '15:45', '16:30'].map((starttid, i) =>
      lavHold({ id: `hold-${i + 1}`, holdnavn: `Fredag ${starttid}`, starttid }),
    );
    const ryttere = Array.from({ length: 12 }, (_, i) =>
      lavRytter({ id: `r${String(i + 1).padStart(2, '0')}` }),
    );
    const input = lavInput({
      heste,
      hold,
      ryttere,
      tilmeldinger: ryttere.map((r, i) =>
        lavTilmelding(r.id, `hold-${(i % 3) + 1}`, { ancienitetDato: `202${i % 6}-01-01` }),
      ),
      oensker: ryttere.flatMap((r, i) =>
        lavOensker(r.id, ...[0, 1, 2].map((j) => heste[(i + j) % heste.length]?.id ?? '')),
      ),
      turnus: Object.fromEntries(ryttere.map((r, i) => [r.id, i % 4])),
    });

    it('giver identisk resultat for samme input', () => {
      expect(koer(input)).toStrictEqual(koer(input));
    });

    it('giver identisk resultat for samme input i blandet rækkefølge', () => {
      expect(koer(blandRaekkefoelge(input))).toStrictEqual(koer(input));
    });

    it('placerer alle 12 ryttere lovligt og forklaret', () => {
      const resultat = koer(input);
      expect(resultat.tildelinger).toHaveLength(12);
      expect(resultat.statistik.ikkeTildelt).toBe(0);
      expect(validerPlan(tilPlan(input, resultat), input)).toEqual([]);
      forventForklaret(resultat);
    });
  });
});
