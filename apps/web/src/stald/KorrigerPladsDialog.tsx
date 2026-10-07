import React, { useState } from 'react';
import type { FremmoedeStatus } from '@ridecenter/contracts';

interface KorrigerPladsDialogProps {
  aaben: boolean;
  rytterNavn: string;
  nuvaerendeStatus: FremmoedeStatus | null;
  onLuk: () => void;
  onBekraeft: (nyStatus: FremmoedeStatus, begrundelse: string) => void;
}

const HURTIGVALG = [
  'Fejlafkrydsning',
  'Kom for sent',
  'Gik før tid',
  'Sygdom meldt efter start',
];

export function KorrigerPladsDialog({
  aaben,
  rytterNavn,
  nuvaerendeStatus,
  onLuk,
  onBekraeft,
}: KorrigerPladsDialogProps) {
  const [valgtStatus, setValgtStatus] = useState<FremmoedeStatus>(
    nuvaerendeStatus === 'Fremmoedt' ? 'Udeblevet' : 'Fremmoedt'
  );
  const [begrundelse, setBegrundelse] = useState('');
  const [fejl, setFejl] = useState<string | null>(null);

  if (!aaben) return null;

  const haandterIndsend = (e: React.FormEvent) => {
    e.preventDefault();
    const renBegrundelse = begrundelse.trim();
    if (renBegrundelse.length < 5) {
      setFejl('Begrundelsen skal være mindst 5 tegn.');
      return;
    }
    setFejl(null);
    onBekraeft(valgtStatus, renBegrundelse);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="korriger-titel"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl text-slate-100 animate-in fade-in zoom-in-95 duration-150">
        <h2 id="korriger-titel" className="text-xl font-bold text-white mb-2">
          Korriger fremmøde – {rytterNavn}
        </h2>
        <p className="text-sm text-slate-400 mb-6">
          Holdet er afsluttet. Ændringer efter lukning kræver en obligatorisk begrundelse (mindst 5 tegn) jf. FR-017 og revisionssporet.
        </p>

        <form onSubmit={haandterIndsend} className="space-y-5">
          {/* Ny status */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Ny status
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setValgtStatus('Fremmoedt')}
                className={`min-h-[56px] rounded-xl font-semibold border-2 text-base transition-all ${
                  valgtStatus === 'Fremmoedt'
                    ? 'border-emerald-500 bg-emerald-950/60 text-emerald-300'
                    : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
                }`}
              >
                Fremmødt
              </button>
              <button
                type="button"
                onClick={() => setValgtStatus('Udeblevet')}
                className={`min-h-[56px] rounded-xl font-semibold border-2 text-base transition-all ${
                  valgtStatus === 'Udeblevet'
                    ? 'border-rose-500 bg-rose-950/60 text-rose-300'
                    : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
                }`}
              >
                Udeblevet
              </button>
            </div>
          </div>

          {/* Hurtigvalg */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Hurtigvalg af begrundelse
            </label>
            <div className="flex flex-wrap gap-2">
              {HURTIGVALG.map((tekst) => (
                <button
                  key={tekst}
                  type="button"
                  onClick={() => {
                    setBegrundelse(tekst);
                    setFejl(null);
                  }}
                  className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                    begrundelse === tekst
                      ? 'border-sky-500 bg-sky-950/60 text-sky-200'
                      : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  {tekst}
                </button>
              ))}
            </div>
          </div>

          {/* Begrundelsestekst */}
          <div>
            <label htmlFor="begrundelse-input" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Begrundelse (mindst 5 tegn)
            </label>
            <textarea
              id="begrundelse-input"
              value={begrundelse}
              onChange={(e) => {
                setBegrundelse(e.target.value);
                if (e.target.value.trim().length >= 5) setFejl(null);
              }}
              rows={3}
              placeholder="Skriv forklaring på ændringen..."
              className="w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
            {fejl && <p className="mt-1 text-sm text-rose-400">{fejl}</p>}
          </div>

          {/* Knapper */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onLuk}
              className="flex-1 min-h-[56px] rounded-xl border border-slate-700 bg-slate-800 font-medium text-slate-300 hover:bg-slate-700"
            >
              Annuller
            </button>
            <button
              type="submit"
              className="flex-1 min-h-[56px] rounded-xl bg-sky-600 font-semibold text-white hover:bg-sky-500 shadow-lg shadow-sky-900/30"
            >
              Gem korrektion
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

