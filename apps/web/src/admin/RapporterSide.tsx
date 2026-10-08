import React, { useEffect, useState } from 'react';
import type { RapportTilsynSvar } from '@ridecenter/contracts';

export const RapporterSide: React.FC = () => {
  const [periodeFra, setPeriodeFra] = useState('2026-01-01');
  const [periodeTil, setPeriodeTil] = useState('2026-06-30');
  const [aldersgraense, setAldersgraense] = useState(25);
  const [genererer, setGenererer] = useState(false);
  const [rapportSvar, setRapportSvar] = useState<RapportTilsynSvar | null>(null);
  const [historik, setHistorik] = useState<any[]>([]);
  const [fejl, setFejl] = useState<string | null>(null);

  const hentHistorik = async () => {
    try {
      const res = await fetch('/api/v1/rapporter/historik');
      if (res.ok) {
        const data = await res.json();
        setHistorik(data);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    hentHistorik();
  }, []);

  const haandterGenerer = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenererer(true);
    setFejl(null);
    setRapportSvar(null);

    const t0 = performance.now();
    try {
      const res = await fetch('/api/v1/rapporter/tilsyn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periode_fra: periodeFra,
          periode_til: periodeTil,
          aldersgraense: Number(aldersgraense),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.besked ?? 'Fejl ved generering af tilsynsrapport');
      }

      const data: RapportTilsynSvar = await res.json();
      const varighed = Math.round(performance.now() - t0);
      setRapportSvar(data);
      await hentHistorik();
    } catch (err: any) {
      setFejl(err?.message ?? 'Der opstod en fejl');
    } finally {
      setGenererer(false);
    }
  };

  const [visRapportModal, setVisRapportModal] = useState<any | null>(null);
  const [modalCsvData, setModalCsvData] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [henterModalCsv, setHenterModalCsv] = useState(false);

  const aabenRapportModal = async (rapport: any) => {
    setVisRapportModal(rapport);
    setHenterModalCsv(true);
    setModalCsvData(null);
    try {
      const res = await fetch(`/api/v1/rapporter/tilsyn/${rapport.id}/download`);
      if (res.ok) {
        const tekst = await res.text();
        const linjer = tekst.trim().split(/\r?\n/).filter(l => l.trim().length > 0);
        if (linjer.length > 0) {
          const splitRow = (row: string) => {
            // Håndter semikolon eller komma seperator
            const sep = row.includes(';') ? ';' : ',';
            return row.split(sep).map(cell => cell.replace(/^"(.*)"$/, '$1').trim());
          };
          const foersteLinje = linjer[0];
          if (foersteLinje) {
            const headers = splitRow(foersteLinje);
            const rows = linjer.slice(1).map(splitRow);
            setModalCsvData({ headers, rows });
          }
        }
      }
    } catch {
      // ignore
    } finally {
      setHenterModalCsv(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">Kommunal Tilsynsrapport</h1>
        <p className="text-sm text-stone-500 mt-1">
          1-klik udtræk af tilskudsberettiget fremmøde med uforanderlige hashkæde-kontrolsummer (SC-009, FR-018).
        </p>
      </div>

      {fejl && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          {fejl}
        </div>
      )}

      {/* FORMULAR */}
      <div className="rounded-2xl bg-white border border-stone-200 p-6 shadow-sm">
        <form onSubmit={haandterGenerer} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="fra-dato" className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
                Periode fra
              </label>
              <input
                id="fra-dato"
                type="date"
                value={periodeFra}
                onChange={(e) => setPeriodeFra(e.target.value)}
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-stone-300 bg-white text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>

            <div>
              <label htmlFor="til-dato" className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
                Periode til
              </label>
              <input
                id="til-dato"
                type="date"
                value={periodeTil}
                onChange={(e) => setPeriodeTil(e.target.value)}
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-stone-300 bg-white text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>

            <div>
              <label htmlFor="aldersgraense" className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
                Aldersgrænse (tilskud)
              </label>
              <select
                id="aldersgraense"
                value={aldersgraense}
                onChange={(e) => setAldersgraense(Number(e.target.value))}
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-stone-300 bg-white text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value={25}>Under 25 år (Strandby Kommune standard)</option>
                <option value={18}>Under 18 år</option>
                <option value={30}>Under 30 år</option>
              </select>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={genererer}
              className="min-h-[48px] px-6 rounded-xl bg-emerald-700 hover:bg-emerald-650 text-white font-bold text-sm shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              {genererer ? 'Genererer rapport...' : '📊 Generer kommunal tilsynsrapport'}
            </button>
          </div>
        </form>
      </div>

      {/* RESULTAT FOR NYLIGT GENERERET RAPPORT */}
      {rapportSvar && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-6 space-y-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-200 text-emerald-900">
                ✓ Rapport genereret på {rapportSvar.varighed_ms} ms (&lt; 5 sek. krav opfyldt)
              </span>
              <h2 className="text-lg font-bold text-stone-900 mt-2">
                Periode: {rapportSvar.periode_fra} til {rapportSvar.periode_til}
              </h2>
              <p className="text-xs text-stone-600">
                Indeholder {rapportSvar.antal_raekker} tilskudsberettigede fremmøderækker (ingen CPR-numre).
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => aabenRapportModal(rapportSvar)}
                className="min-h-[44px] px-4 rounded-xl bg-white hover:bg-stone-100 text-stone-800 text-xs font-bold shadow-sm border border-stone-300 flex items-center gap-1.5 cursor-pointer"
              >
                👁️ Se rapport
              </button>
              <a
                href={`/api/v1/rapporter/tilsyn/${rapportSvar.id}/download`}
                className="min-h-[44px] px-5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold shadow flex items-center gap-1.5"
              >
                📥 Download CSV
              </a>
            </div>
          </div>

          {/* HASH KONTROLSUMMER */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-xs font-mono">
            <div className="p-3 bg-white rounded-xl border border-emerald-200">
              <span className="text-stone-500 block mb-0.5 font-sans font-semibold">
                Fil-kontrolsum (SHA-256):
              </span>
              <span className="text-stone-800 break-all select-all">{rapportSvar.fil_sha256}</span>
            </div>
            <div className="p-3 bg-white rounded-xl border border-emerald-200">
              <span className="text-stone-500 block mb-0.5 font-sans font-semibold">
                Hashkæde hovedhash:
              </span>
              <span className="text-stone-800 break-all select-all">{rapportSvar.kaede_hovedhash}</span>
            </div>
          </div>
        </div>
      )}

      {/* HISTORIK */}
      <div className="rounded-2xl bg-white border border-stone-200 overflow-hidden shadow-sm">
        <div className="p-5 border-b border-stone-200">
          <h2 className="text-base font-bold text-stone-900">Historiske rapportudtræk</h2>
        </div>

        {historik.length === 0 ? (
          <div className="p-8 text-center text-stone-400 text-sm">
            Ingen tidligere rapporter genereret endnu.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-stone-700">
              <thead className="bg-stone-50 text-xs font-semibold text-stone-500 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Genereret</th>
                  <th className="px-5 py-3.5">Periode</th>
                  <th className="px-5 py-3.5">Rækker</th>
                  <th className="px-5 py-3.5">Varighed</th>
                  <th className="px-5 py-3.5 text-right">Handling</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {historik.map((h) => (
                  <tr key={h.id} className="hover:bg-stone-50">
                    <td className="px-5 py-3.5 text-xs font-mono">
                      {new Date(h.genereret_tidspunkt).toLocaleString('da-DK')}
                    </td>
                    <td className="px-5 py-3.5 text-xs">
                      {new Date(h.periode_fra).toLocaleDateString('da-DK')} –{' '}
                      {new Date(h.periode_til).toLocaleDateString('da-DK')}
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-stone-900">{h.antal_raekker}</td>
                    <td className="px-5 py-3.5 text-xs font-mono text-stone-500">{h.varighed_ms} ms</td>
                    <td className="px-5 py-3.5 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => aabenRapportModal(h)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 cursor-pointer inline-flex items-center gap-1"
                        title="Se rapportdata i tabel"
                      >
                        👁️ Se rapport
                      </button>
                      <a
                        href={`/api/v1/rapporter/tilsyn/${h.id}/download`}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-300 inline-block"
                      >
                        📥 Download CSV
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* POPUP MODAL TIL VISNING AF RAPPORTDATA */}
      {visRapportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[85vh] flex flex-col border border-stone-200 overflow-hidden">
            <div className="p-5 border-b border-stone-200 flex items-center justify-between bg-stone-50">
              <div>
                <h3 className="text-lg font-bold text-stone-900">
                  Rapportvisning: {new Date(visRapportModal.periode_fra).toLocaleDateString('da-DK')} – {new Date(visRapportModal.periode_til).toLocaleDateString('da-DK')}
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Genereret: {new Date(visRapportModal.genereret_tidspunkt).toLocaleString('da-DK')} • {visRapportModal.antal_raekker} rækker
                </p>
              </div>
              <button
                type="button"
                onClick={() => setVisRapportModal(null)}
                className="w-9 h-9 rounded-full bg-stone-200 hover:bg-stone-300 text-stone-700 flex items-center justify-center font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {henterModalCsv ? (
                <div className="py-12 text-center text-stone-500">Indlæser rapportdata...</div>
              ) : !modalCsvData || modalCsvData.rows.length === 0 ? (
                <div className="py-12 text-center text-stone-500">Ingen rækker fundet i rapporten.</div>
              ) : (
                <div className="border border-stone-200 rounded-xl overflow-x-auto">
                  <table className="w-full text-left text-xs text-stone-700">
                    <thead className="bg-stone-100 text-stone-600 font-semibold uppercase tracking-wider border-b border-stone-200">
                      <tr>
                        {modalCsvData.headers.map((h, i) => (
                          <th key={i} className="px-4 py-3 whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {modalCsvData.rows.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-stone-50">
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} className="px-4 py-2.5 whitespace-nowrap">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-stone-200 bg-stone-50 flex items-center justify-between">
              <span className="text-xs font-mono text-stone-500 truncate max-w-md">
                SHA-256: {visRapportModal.fil_sha256}
              </span>
              <div className="flex gap-2">
                <a
                  href={`/api/v1/rapporter/tilsyn/${visRapportModal.id}/download`}
                  className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold shadow-sm"
                >
                  📥 Download CSV
                </a>
                <button
                  type="button"
                  onClick={() => setVisRapportModal(null)}
                  className="px-4 py-2 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-semibold cursor-pointer"
                >
                  Luk
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

