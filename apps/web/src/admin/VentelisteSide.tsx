import React, { useEffect, useState } from 'react';

const NIVEAU_LABELS: Record<string, string> = {
  Traekhold: 'Trækhold',
  Begynder: 'Begynder',
  Letoevet: 'Letøvet',
  Oevet: 'Øvet',
  Parthold: 'Parthold',
};

export const VentelisteSide: React.FC = () => {
  const [data, setData] = useState<{ poster: any[]; afventende_forslag: any[] } | null>(null);
  const [indlaeser, setIndlaeser] = useState(true);
  const [fejl, setFejl] = useState<string | null>(null);
  const [behandlerId, setBehandlerId] = useState<string | null>(null);

  // Opret til venteliste state
  const [visOpretModal, setVisOpretModal] = useState(false);
  const [ryttere, setRyttere] = useState<any[]>([]);
  const [valgtRytterId, setValgtRytterId] = useState('');
  const [valgtNiveau, setValgtNiveau] = useState<string>('Begynder');
  const [opretter, setOpretter] = useState(false);

  const hentData = async () => {
    try {
      const res = await fetch('/api/v1/admin/venteliste');
      if (res.ok) {
        const d = await res.json();
        setData(d);
      } else {
        const err = await res.json().catch(() => ({}));
        setFejl(err.besked ?? 'Kunne ikke hente ventelistedata');
      }
    } catch (err: any) {
      setFejl(err?.message ?? 'Fejl ved indlæsning af venteliste');
    } finally {
      setIndlaeser(false);
    }
  };

  const hentRyttere = async () => {
    try {
      const res = await fetch('/api/v1/stamdata/ryttere');
      if (res.ok) {
        const d = await res.json();
        setRyttere(d);
        if (d.length > 0 && !valgtRytterId) {
          setValgtRytterId(d[0].id);
        }
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    hentData();
    hentRyttere();
  }, []);

  const haandterOpretVenteliste = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valgtRytterId) return;
    setOpretter(true);
    try {
      const res = await fetch('/api/v1/admin/venteliste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rytter_id: valgtRytterId,
          oensket_niveau: valgtNiveau,
        }),
      });
      if (res.ok) {
        setVisOpretModal(false);
        await hentData();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.besked ?? 'Kunne ikke oprette ventelistepost');
      }
    } catch (err: any) {
      alert(err?.message ?? 'Fejl ved oprettelse');
    } finally {
      setOpretter(false);
    }
  };

  const haandterGodkend = async (forslagId: string) => {
    setBehandlerId(forslagId);
    try {
      const res = await fetch(`/api/v1/admin/venteliste/forslag/${forslagId}/godkend`, {
        method: 'POST',
      });
      if (res.ok) {
        await hentData();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.besked ?? 'Kunne ikke godkende genbesættelse');
      }
    } catch (err: any) {
      alert(err?.message ?? 'Fejl ved godkendelse');
    } finally {
      setBehandlerId(null);
    }
  };

  const haandterAfvis = async (forslagId: string) => {
    if (!confirm('Afvis forslag og gå til næste på ventelisten?')) return;
    setBehandlerId(forslagId);
    try {
      const res = await fetch(`/api/v1/admin/venteliste/forslag/${forslagId}/afvis`, {
        method: 'POST',
      });
      if (res.ok) {
        await hentData();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.besked ?? 'Kunne ikke afvise forslag');
      }
    } catch (err: any) {
      alert(err?.message ?? 'Fejl ved afvisning');
    } finally {
      setBehandlerId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">Ventelister &amp; Genbesættelse</h1>
        <p className="text-sm text-stone-500 mt-1">
          Hurtig genbesættelse ved rettidige afbud og administration af ventelistepladser.
        </p>
      </div>

      {fejl && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          {fejl}
        </div>
      )}

      {/* AFVENTENDE FORSLAG TIL GENBESÆTTELSE (SC-006) */}
      <div className="rounded-2xl bg-white border border-stone-200 overflow-hidden shadow-sm">
        <div className="p-5 border-b border-stone-200 bg-sky-50/50 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
              <span>⚡ Afventende genbesættelsesforslag</span>
              {data?.afventende_forslag && data.afventende_forslag.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-sky-200 text-sky-800">
                  {data.afventende_forslag.length}
                </span>
              )}
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Genereret automatisk ved rettidigt afbud inden for 5 sek. Kræver Malenes manuelle opkald.
            </p>
          </div>
        </div>

        {indlaeser ? (
          <div className="p-8 text-center text-stone-400">Henter forslag...</div>
        ) : !data?.afventende_forslag || data.afventende_forslag.length === 0 ? (
          <div className="p-8 text-center text-stone-400 text-sm">
            Ingen afventende forslag lige nu.
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {data.afventende_forslag.map((f: any) => {
              const kontakt = f.kontaktinfo_snapshot ?? {};
              return (
                <div key={f.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        {f.type}
                      </span>
                      <h3 className="text-base font-bold text-stone-900">
                        {kontakt.rytter_navn ?? 'Elev på venteliste'}
                      </h3>
                    </div>
                    <div className="text-xs text-stone-600 flex flex-wrap gap-4 pt-1">
                      <span>
                        📞 <strong>Telefon:</strong>{' '}
                        <a href={`tel:${kontakt.kontakt_telefon}`} className="text-sky-600 underline font-semibold">
                          {kontakt.kontakt_telefon ?? 'Ikke oplyst'}
                        </a>
                      </span>
                      {kontakt.kontakt_navn && (
                        <span>
                          👤 <strong>Kontaktperson:</strong> {kontakt.kontakt_navn}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => haandterAfvis(f.id)}
                      disabled={behandlerId === f.id}
                      className="min-h-[44px] px-4 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold border border-stone-300"
                    >
                      Afvis (ring til næste)
                    </button>
                    <button
                      type="button"
                      onClick={() => haandterGodkend(f.id)}
                      disabled={behandlerId === f.id}
                      className="min-h-[44px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm"
                    >
                      {behandlerId === f.id ? 'Gemmer...' : '✓ Godkend genbesættelse'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* VENTELISTE TABEL */}
      <div className="rounded-2xl bg-white border border-stone-200 overflow-hidden shadow-sm">
        <div className="p-5 border-b border-stone-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-stone-900">Aktive ventelister</h2>
            <p className="text-xs text-stone-500 mt-0.5">Sorteret efter FIFO-anciennitet (ældste tilmelding først).</p>
          </div>
          <button
            type="button"
            onClick={() => setVisOpretModal(true)}
            className="min-h-[40px] px-4 rounded-xl bg-emerald-700 hover:bg-emerald-650 text-white text-xs font-bold shadow-sm transition flex items-center gap-1.5 cursor-pointer"
          >
            ➕ Tilføj til venteliste
          </button>
        </div>

        {indlaeser ? (
          <div className="p-8 text-center text-stone-400">Henter venteliste...</div>
        ) : !data?.poster || data.poster.length === 0 ? (
          <div className="p-8 text-center text-stone-400 text-sm">Ventelisten er tom.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-stone-700">
              <thead className="bg-stone-50 text-xs font-semibold text-stone-500 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Rytter</th>
                  <th className="px-5 py-3.5">Ønsket niveau / hold</th>
                  <th className="px-5 py-3.5">Tilmeldt dato</th>
                  <th className="px-5 py-3.5">Kontakt</th>
                  <th className="px-5 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {data.poster.map((p: any) => (
                  <tr key={p.id} className="hover:bg-stone-50">
                    <td className="px-5 py-3.5 font-medium text-stone-900">
                      {p.rytter?.fornavn} {p.rytter?.efternavn}
                    </td>
                    <td className="px-5 py-3.5 text-xs">
                      {p.oensket_niveau ? (NIVEAU_LABELS[p.oensket_niveau] ?? p.oensket_niveau) : 'Specifikt hold'}
                    </td>
                    <td className="px-5 py-3.5 text-xs font-mono">
                      {new Date(p.tilmeldingsdato).toLocaleDateString('da-DK')}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-stone-600">
                      {p.rytter?.kontakt_telefon ?? '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-stone-100 text-stone-700">
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* POPUP MODAL TIL OPRETTELSE PÅ VENTELISTE */}
      {visOpretModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-stone-200 overflow-hidden">
            <div className="p-5 border-b border-stone-200 flex items-center justify-between bg-stone-50">
              <div>
                <h3 className="text-base font-bold text-stone-900">Tilføj elev til venteliste</h3>
                <p className="text-xs text-stone-500 mt-0.5">Vælg rytter og ønsket holdniveau</p>
              </div>
              <button
                type="button"
                onClick={() => setVisOpretModal(false)}
                className="w-8 h-8 rounded-full bg-stone-200 hover:bg-stone-300 text-stone-700 flex items-center justify-center font-bold text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={haandterOpretVenteliste} className="p-6 space-y-4">
              <div>
                <label htmlFor="rytter-valg" className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
                  Vælg rytter
                </label>
                <select
                  id="rytter-valg"
                  value={valgtRytterId}
                  onChange={(e) => setValgtRytterId(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-stone-300 bg-white text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                >
                  <option value="" disabled>Vælg en rytter...</option>
                  {ryttere.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.fornavn} {r.efternavn} ({r.niveau}) {r.status === 'Opsagt' ? '- Opsagt' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="niveau-valg" className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
                  Ønsket niveau
                </label>
                <select
                  id="niveau-valg"
                  value={valgtNiveau}
                  onChange={(e) => setValgtNiveau(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-stone-300 bg-white text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                >
                  <option value="Traekhold">Trækhold</option>
                  <option value="Begynder">Begynder</option>
                  <option value="Letoevet">Letøvet</option>
                  <option value="Oevet">Øvet</option>
                  <option value="Parthold">Parthold</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setVisOpretModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold border border-stone-300 cursor-pointer"
                >
                  Annuller
                </button>
                <button
                  type="submit"
                  disabled={opretter || !valgtRytterId}
                  className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-650 text-white text-xs font-bold shadow-sm transition cursor-pointer"
                >
                  {opretter ? 'Tilføjer...' : 'Gem på venteliste'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

