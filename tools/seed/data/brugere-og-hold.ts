import type { Niveau } from '@ridecenter/domain';
import { stabilId } from './id';
import type { SeedBruger, SeedHold } from './typer';

// Demobrugere fra quickstart.md §2 og fredagsholdene fra _case-01-Holdoversigt, uge.md.

export function brugerId(navn: string): string {
  return stabilId('bruger', navn);
}

export function holdId(holdnavn: string): string {
  return stabilId('hold', holdnavn);
}

export function byggBrugere(): SeedBruger[] {
  return [
    {
      id: brugerId('Malene'),
      navn: 'Malene',
      roller: ['Ledelse', 'Ridelaerer'],
      email: 'malene@demo.dk',
      pin: '111111',
    },
    {
      id: brugerId('Marie'),
      navn: 'Marie',
      roller: ['Ridelaerer'],
      email: 'marie@demo.dk',
      pin: '222222',
    },
    {
      id: brugerId('Camilla'),
      navn: 'Camilla',
      roller: ['Ridelaerer'],
      email: null,
      pin: '222333',
    },
    {
      id: brugerId('Birgit'),
      navn: 'Birgit',
      roller: ['Ridelaerer'],
      email: null,
      pin: '222444',
    },
    {
      id: brugerId('Ella J.'),
      navn: 'Ella J.',
      roller: ['Staldelev'],
      email: null,
      pin: '333333',
    },
  ];
}

export const FREDAGSHOLD = {
  begynder: 'Fredag 15:00 Begynder',
  letoevet1: 'Fredag 15:45 Letøvet',
  oevet: 'Fredag 16:30 Øvet',
  letoevet2: 'Fredag 17:15 Letøvet',
} as const;

export function byggFredagshold(): SeedHold[] {
  const marie = brugerId('Marie');
  const hold = (holdnavn: string, niveau: Niveau, starttid: string): SeedHold => ({
    id: holdId(holdnavn),
    holdnavn,
    niveau,
    erSpringhold: false,
    ugedag: 5,
    starttid,
    varighedMin: 45,
    maxKapacitet: 10,
    fastUnderviserId: marie,
  });
  return [
    hold(FREDAGSHOLD.begynder, 'Begynder', '15:00'),
    hold(FREDAGSHOLD.letoevet1, 'Letoevet', '15:45'),
    hold(FREDAGSHOLD.oevet, 'Oevet', '16:30'),
    hold(FREDAGSHOLD.letoevet2, 'Letoevet', '17:15'),
  ];
}
