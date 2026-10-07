import React, { useEffect, useState } from 'react';
import type { VikarKodeOpretSvar, VikarKodePost } from '@ridecenter/contracts';

export const VikarKoderSide: React.FC = () => {
  const [koder, setKoder] = useState<VikarKodePost[]>([]);
  const [indlaeser, setIndlaeser] = useState(true);
  const [fejl, setFejl] = useState<string | null>(null);
  const [oprettetKode, setOprettetKode] = useState<VikarKodeOpretSvar | null>(null);
  const [opretter, setOpretter] = useState(false);
  const [kopieret, setKopieret] = useState(false);

  const hentKoder = async () => {
    setIndlaeser(true);
    try {
      const res = await fetch('/api/v1/auth/vikarkoder');
      if (res.ok) {
        const data = await res.json();
        setKoder(data);
      } else {
        const err = await res.json().catch(() => ({}));
        setFejl(err.besked ?? 'Kunne ikke hente vikarkoder');
      }
    } catch (err: any) {
      setFejl(err?.message ?? 'Fejl ved hentning af vikarkoder');
    } finally {
      setIndlaeser(false);
    }
  };

  useEffect(() => {
    hentKoder();
  }, []);

  const haandterUdstedNyKode = async () => {
    setOpretter(true);
    setFejl(null);
    setKopieret(false);
    try {
      const res = await fetch('/api/v1/auth/vikarkoder', {
        method: 'POST',
      });
      if (res.ok) {
        const nyKode: VikarKodeOpretSvar = await res.json();
        setOprettetKode(nyKode);
        await hentKoder();
      } else {
        const err = await res.json().catch(() => ({}));
        setFejl(err.besked ?? 'Kunne ikke udstede vikarkode');
      }
    } catch (err: any) {
      setFejl(err?.message ?? 'Fejl ved udstedelse af kode');
    } finally {
      setOpretter(false);
    }
  };

  const haandterSpaerKode = async (id: string) => {
    if (!confirm('Er du sikker på, at du vil spærre denne vikarkode?')) return;
    try {
      const res = await fetch(`/api/v1/auth/vikarkoder/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await hentKoder();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.besked ?? 'Kunne ikke spærre kode');
      }
    } catch (err: any) {
      alert(err?.message ?? 'Fejl ved spærring af kode');
    }
  };

  const kopierKodeTilUdklipsholder = async (kode: string) => {
    try {
      await navigator.clipboard.writeText(kode);
      setKopieret(true);
      setTimeout(() => setKopieret(false), 2000);
    } catch {
      // fallback
    }
  };

  const getStatusBadge = (status: VikarKodePost['status']) => {
    switch (status) {
      case 'Aktiv':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-700/80">
            Aktiv
          </span>
        );
      case 'Anvendt':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-950/80 text-sky-300 border border-sky-700/80">
            Anvendt
          </span>
        );
      case 'Spaerret':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-950/80 text-rose-300 border border-rose-700/80">
            Spærret
          </span>
        );
      case 'Udloebet':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
            Udløbet
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header og handling */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Vikar-engangskoder</h1>
          <p className="text-sm text-slate-400 mt-1">
            Udsted 6-cifrede engangskoder til uvarslede vikarer. Koden udløber efter brug eller kl. 23:59.
          </p>
        </div>
        <button
          type="button"
          onClick={haandterUdstedNyKode}
          disabled={opretter}
          className="min-h-[48px] px-5 rounded-xl bg-sky-600 hover:bg-sky-500 active:bg-sky-650 text-white font-bold text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
        >
          {opretter ? 'Udsteder...' : '+ Udsted ny vikarkode'}
        </button>
      </div>

      {fejl && (
        <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-800 text-sm text-rose-300">
          {fejl}
        </div>
      )}

      {/* Nyoprettet kode-dialog / fremhævelse */}
      {oprettetKode && (
        <div className="rounded-2xl bg-sky-950/40 border border-sky-800/80 p-6 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold text-sky-400 uppercase tracking-wider">
                Ny vikarkode udstedt
              </span>
              <h2 className="text-sm text-slate-300 mt-0.5">
                Koden vises <strong>kun denne ene gang</strong>. Notér den eller giv den direkte til vikaren.
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setOprettetKode(null)}
              className="text-slate-400 hover:text-white text-sm"
            >
              Luk ✕
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
            <div className="text-4xl font-mono font-bold tracking-[0.25em] text-white bg-slate-950 px-6 py-3 rounded-xl border border-sky-700/80">
              {oprettetKode.kode}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => kopierKodeTilUdklipsholder(oprettetKode.kode)}
                className="min-h-[44px] px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-white text-xs font-semibold border border-slate-700 flex items-center gap-2"
              >
                {kopieret ? '✓ Kopieret!' : '📋 Kopiér kode'}
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="min-h-[44px] px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold border border-slate-700"
              >
                🖨️ Udskriv
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabel over vikarkoder */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800">
          <h2 className="text-base font-semibold text-white">Oversigt over koder</h2>
        </div>

        {indlaeser ? (
          <div className="p-8 text-center text-slate-400 font-medium">Henter koder...</div>
        ) : koder.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            Ingen vikarkoder udstedt endnu. Klik på knappen ovenfor for at oprette en kode.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/60 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Udstedt</th>
                  <th className="px-5 py-3.5">Udløb</th>
                  <th className="px-5 py-3.5">Anvendt af</th>
                  <th className="px-5 py-3.5">Anvendt dato</th>
                  <th className="px-5 py-3.5 text-right">Handling</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {koder.map((k) => (
                  <tr key={k.id} className="hover:bg-slate-850/50 transition">
                    <td className="px-5 py-4">{getStatusBadge(k.status)}</td>
                    <td className="px-5 py-4 text-xs font-mono">
                      {new Date(k.udstedt_dato).toLocaleString('da-DK', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td className="px-5 py-4 text-xs font-mono">
                      {new Date(k.udloebsdato).toLocaleString('da-DK', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td className="px-5 py-4 font-medium text-white">
                      {k.anvendt_af_vikarnavn ?? '—'}
                    </td>
                    <td className="px-5 py-4 text-xs font-mono text-slate-400">
                      {k.anvendt_dato
                        ? new Date(k.anvendt_dato).toLocaleString('da-DK', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })
                        : '—'}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {k.status === 'Aktiv' && (
                        <button
                          type="button"
                          onClick={() => haandterSpaerKode(k.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium text-rose-300 hover:text-white bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60"
                        >
                          Spær kode
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

