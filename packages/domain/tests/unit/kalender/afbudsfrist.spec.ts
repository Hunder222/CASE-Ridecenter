import { describe, expect, it } from 'vitest';
import { klassificerAfbud } from '../../../src/kalender/afbud';

describe('Afbudsfrist klassificering (US4, FR-015, T152)', () => {
  it('klassificerer afbud modtaget før kl. 12:00:00 på lektionsdagen som Afbud_rettidigt', () => {
    // 2026-10-10 kl. 11:59:59 dansk tid
    const lektionDato = '2026-10-10';
    const modtaget = new Date('2026-10-10T11:59:59+02:00');

    const status = klassificerAfbud({
      lektionDato,
      modtagetTidspunkt: modtaget,
    });

    expect(status).toBe('Afbud_rettidigt');
  });

  it('klassificerer afbud modtaget præcis kl. 12:00:00 som Afbud_for_sent', () => {
    const lektionDato = '2026-10-10';
    const modtaget = new Date('2026-10-10T12:00:00+02:00');

    const status = klassificerAfbud({
      lektionDato,
      modtagetTidspunkt: modtaget,
    });

    expect(status).toBe('Afbud_for_sent');
  });

  it('klassificerer afbud modtaget efter kl. 12:00 som Afbud_for_sent', () => {
    const lektionDato = '2026-10-10';
    const modtaget = new Date('2026-10-10T14:30:00+02:00');

    const status = klassificerAfbud({
      lektionDato,
      modtagetTidspunkt: modtaget,
    });

    expect(status).toBe('Afbud_for_sent');
  });

  it('klassificerer afbud modtaget dagen før som Afbud_rettidigt', () => {
    const lektionDato = '2026-10-10';
    const modtaget = new Date('2026-10-09T20:00:00+02:00');

    const status = klassificerAfbud({
      lektionDato,
      modtagetTidspunkt: modtaget,
    });

    expect(status).toBe('Afbud_rettidigt');
  });
});

