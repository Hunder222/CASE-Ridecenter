import React from 'react';
import type { SynkTilstand } from '@ridecenter/contracts';

interface SynkIndikatorProps {
  tilstand: SynkTilstand;
  ventendeAntal: number;
  advarsler: string[];
  onClick?: () => void;
}

export const SynkIndikator: React.FC<SynkIndikatorProps> = ({
  tilstand,
  ventendeAntal,
  advarsler,
  onClick,
}) => {
  let badgeTekst = '';
  let badgeKlasse = '';
  let ikon = '';

  switch (tilstand) {
    case 'online':
      ikon = '🟢';
      badgeTekst = 'Online – alt synkroniseret';
      badgeKlasse = 'bg-emerald-900/40 text-emerald-300 border-emerald-600/50';
      break;
    case 'offline':
      ikon = '🟡';
      badgeTekst = ventendeAntal > 0
        ? `Offline – ${ventendeAntal} ændringer gemt lokalt`
        : 'Offline';
      badgeKlasse = 'bg-amber-900/40 text-amber-300 border-amber-600/50';
      break;
    case 'synkroniserer':
      ikon = '🔵';
      badgeTekst = 'Synkroniserer…';
      badgeKlasse = 'bg-blue-900/40 text-blue-300 border-blue-600/50 animate-pulse';
      break;
    case 'advarsel':
      ikon = '🟠';
      badgeTekst = `${advarsler.length} advarsler fra sync`;
      badgeKlasse = 'bg-orange-900/40 text-orange-300 border-orange-600/50';
      break;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium transition cursor-pointer select-none ${badgeKlasse}`}
      title={advarsler.length > 0 ? advarsler.join('\n') : badgeTekst}
    >
      <span className="text-base">{ikon}</span>
      <span>{badgeTekst}</span>
    </button>
  );
};

