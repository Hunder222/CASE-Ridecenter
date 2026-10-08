import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { db, type LokalHest } from '../offline/dexie-db';
import { gemHestStatusMelding } from '../offline/omplacering-sync';

export const HesteOversigtSide: React.FC = () => {
  const navigate = useNavigate();
  const [heste, setHeste] = useState<LokalHest[]>([]);
  const [valgtHest, setValgtHest] = useState<LokalHest | null>(null);
  const [type, setType] = useState<'Helbred' | 'Adfaerd'>('Helbred');
  const [alvorlighed, setAlvorlighed] = useState<'Info' | 'Obs' | 'KanIkkeBruges'>('Obs');
  const [beskrivelse, setBeskrivelse] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'Alle' | 'Aktiv' | 'Sygemeldt' | 'Skadet'>('Alle');
  const [fejl, setFejl] = useState<string | null>(null);
  const [gemmer, setGemmer] = useState(false);
  const [kanRedigereNoter, setKanRedigereNoter] = useState(false);
  const [redigererNoteHest, setRedigererNoteHest] = useState<LokalHest | null>(null);
  const [noteTekst, setNoteTekst] = useState('');
  const [valgtTemperament, setValgtTemperament] = useState<'Rolig' | 'Normal' | 'Frisk'>('Normal');
  const [valgtSkaane, setValgtSkaane] = useState(false);

  const indlaesHeste = async () => {
    let alle = await db.heste.toArray();
    if (alle.length === 0 || alle.some((h) => h.skaane === undefined)) {
      // Hent fra API hvis tomt lokalt eller mangler skaane
      try {
        const res = await fetch('/api/v1/heste');
        if (res.ok) {
          const data = await res.json();
          alle = data.map((h: any) => ({
            id: h.id,
            navn: h.navn,
            stangmaal_cm: h.stangmaal_cm,
            sundhedsstatus: h.sundhedsstatus,
            temperament: h.temperament,
            skaane: h.skaane ?? false,
            springforbud: h.springforbud ?? false,
            max_spring_uge: h.max_spring_uge ?? 0,
            godkendt_til_begyndere: h.godkendt_til_begyndere ?? false,
            staldnoter: h.staldnoter ?? '',
            hviledag: h.hviledag,
            max_lektioner_dag: h.max_lektioner_dag,
          }));
          await db.heste.bulkPut(alle);
        }
      } catch {
        // offline fallback
      }
    }
    setHeste(alle);
  };

  useEffect(() => {
    indlaesHeste();

    const tjekRolle = async () => {
      const meta = await db.meta.get('aktiv_session');
      const roller: string[] = meta?.vaerdi?.roller ?? [];
      const tilladt = roller.includes('Ledelse') || roller.includes('Ridelaerer') || roller.includes('Staldelev');
      setKanRedigereNoter(tilladt);
    };
    tjekRolle();
  }, []);

  const aabnNoteModal = (hest: LokalHest) => {
    setRedigererNoteHest(hest);
    setNoteTekst(hest.staldnoter ?? '');
    setValgtTemperament((hest.temperament as any) ?? 'Normal');
    setValgtSkaane(!!hest.skaane);
    setFejl(null);
  };

  const lukNoteModal = () => {
    setRedigererNoteHest(null);
    setNoteTekst('');
    setFejl(null);
  };

  const haandterGemNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!redigererNoteHest) return;
    setGemmer(true);
    setFejl(null);
    try {
      const payload = {
        staldnoter: noteTekst.trim(),
        temperament: valgtTemperament,
        skaane: valgtSkaane,
      };

      const res = await fetch(`/api/v1/heste/${redigererNoteHest.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      // Opdatér lokalt i Dexie uanset om online patch lykkes straks
      await db.heste.update(redigererNoteHest.id, payload);
      await indlaesHeste();
      lukNoteModal();
    } catch (err: any) {
      setFejl(err?.message ?? 'Fejl ved gemning af oplysninger');
    } finally {
      setGemmer(false);
    }
  };

  const aabnStatusModal = (hest: LokalHest) => {
    setValgtHest(hest);
    setType('Helbred');
    setAlvorlighed('Obs');
    setBeskrivelse('');
    setFejl(null);
  };

  const lukModal = () => {
    setValgtHest(null);
    setBeskrivelse('');
    setFejl(null);
  };

  const haandterIndsendStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valgtHest) return;

    if (!beskrivelse.trim()) {
      setFejl('Angiv venligst en beskrivelse');
      return;
    }
    if (beskrivelse.length > 500) {
      setFejl('Beskrivelsen må højst være 500 tegn');
      return;
    }

    setGemmer(true);
    try {
      await gemHestStatusMelding({
        hestId: valgtHest.id,
        type,
        alvorlighed,
        beskrivelse: beskrivelse.trim(),
      });

      // Opdatér lokal visning
      await indlaesHeste();
      lukModal();
    } catch (err: any) {
      setFejl(err?.message ?? 'Fejl ved gemning af statusmelding');
    } finally {
      setGemmer(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Aktiv':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-700/80">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            Aktiv
          </span>
        );
      case 'Sygemeldt':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-950/80 text-rose-300 border border-rose-700/80">
            <span className="w-2 h-2 rounded-full bg-rose-400"></span>
            Sygemeldt
          </span>
        );
      case 'Skadet':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-950/80 text-amber-300 border border-amber-700/80">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            Skadet
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
            {status}
          </span>
        );
    }
  };

  const antalAktive = heste.filter((h) => h.sundhedsstatus === 'Aktiv').length;
  const antalSyge = heste.filter((h) => h.sundhedsstatus === 'Sygemeldt').length;
  const antalSkadede = heste.filter((h) => h.sundhedsstatus === 'Skadet').length;

  const filtreredeHeste = heste.filter((h) => {
    if (filterStatus === 'Alle') return true;
    return h.sundhedsstatus === filterStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/stald/i-dag')}
            className="min-h-[48px] px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-650 text-slate-200 font-semibold border border-slate-700 flex items-center gap-2 cursor-pointer transition shadow-sm"
          >
            <span>←</span>
            <span>Dagens hold</span>
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Staldens Heste</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Overblik over hestenes sundhedstilstand og hurtig registrering af helbred/adfærd (fail-safe).
            </p>
          </div>
        </div>
      </div>

      {/* KPI Overbliksbjælke */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => setFilterStatus('Alle')}
          className={`p-4 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
            filterStatus === 'Alle'
              ? 'bg-slate-800 border-sky-500 ring-2 ring-sky-500/40 shadow-lg'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <span className="text-xs font-semibold text-slate-400">Alle heste</span>
          <div className="text-2xl font-bold text-white mt-1">{heste.length}</div>
          <span className="text-[11px] text-slate-500 mt-0.5">I alt i stalden</span>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus(filterStatus === 'Aktiv' ? 'Alle' : 'Aktiv')}
          className={`p-4 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
            filterStatus === 'Aktiv'
              ? 'bg-emerald-950/80 border-emerald-500 ring-2 ring-emerald-400/50 shadow-lg'
              : 'bg-emerald-950/30 border-emerald-900/60 hover:border-emerald-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-400">🟢 Raske & Aktive</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          </div>
          <div className="text-2xl font-bold text-emerald-300 mt-1">{antalAktive}</div>
          <span className="text-[11px] text-emerald-500/80 mt-0.5">Klar til undervisning</span>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus(filterStatus === 'Sygemeldt' ? 'Alle' : 'Sygemeldt')}
          className={`p-4 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
            filterStatus === 'Sygemeldt'
              ? 'bg-rose-950/80 border-rose-500 ring-2 ring-rose-400/50 shadow-lg'
              : 'bg-rose-950/30 border-rose-900/60 hover:border-rose-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-400">🔴 Sygemeldte</span>
            <span className="w-2 h-2 rounded-full bg-rose-400"></span>
          </div>
          <div className="text-2xl font-bold text-rose-300 mt-1">{antalSyge}</div>
          <span className="text-[11px] text-rose-400/80 mt-0.5">Må ikke rides</span>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus(filterStatus === 'Skadet' ? 'Alle' : 'Skadet')}
          className={`p-4 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
            filterStatus === 'Skadet'
              ? 'bg-amber-950/80 border-amber-500 ring-2 ring-amber-400/50 shadow-lg'
              : 'bg-amber-950/30 border-amber-900/60 hover:border-amber-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-400">🟠 Skadede / Obs</span>
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
          </div>
          <div className="text-2xl font-bold text-amber-300 mt-1">{antalSkadede}</div>
          <span className="text-[11px] text-amber-400/80 mt-0.5">Kræver opmærksomhed</span>
        </button>
      </div>

      {/* Grid med touch-kort (mindst 56px touch felter) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtreredeHeste.map((hest) => (
          <div
            key={hest.id}
            className={`rounded-2xl border p-5 flex flex-col justify-between transition ${
              hest.sundhedsstatus === 'Sygemeldt'
                ? 'bg-rose-950/20 border-rose-900/60'
                : hest.sundhedsstatus === 'Skadet'
                ? 'bg-amber-950/20 border-amber-900/60'
                : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-bold text-white">{hest.navn}</h3>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {hest.stangmaal_cm ? `${hest.stangmaal_cm} cm` : ''}
                    {hest.temperament ? ` • ${hest.temperament}` : ''}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                      Temperament: {hest.temperament ?? 'Normal'}
                    </span>
                    {hest.skaane && (
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-950 text-sky-300 border border-sky-800">
                        🛡️ Skånehest
                      </span>
                    )}
                  </div>
                </div>
                {getStatusBadge(hest.sundhedsstatus)}
              </div>

              {hest.staldnoter && (
                <div className="mt-3 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300">
                  <span className="font-semibold text-slate-400 block mb-0.5">Staldnote:</span>
                  {hest.staldnoter}
                </div>
              )}
            </div>

            <div className="mt-5 pt-3 border-t border-slate-800/60 flex flex-wrap items-center justify-end gap-2">
              {kanRedigereNoter && (
                <button
                  type="button"
                  onClick={() => aabnNoteModal(hest)}
                  className="min-h-[52px] px-3.5 rounded-xl font-semibold text-xs bg-slate-800/90 hover:bg-slate-750 text-slate-300 border border-slate-700 transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <span>📝</span> Redigér oplysninger
                </button>
              )}
              <button
                type="button"
                onClick={() => aabnStatusModal(hest)}
                className="min-h-[52px] px-4 rounded-xl font-semibold text-xs bg-slate-800 hover:bg-slate-750 text-slate-100 border border-slate-700 transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <span>📋</span> Meld hestestatus
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal til statusmelding */}
      {valgtHest && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-100 space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Meld status for {valgtHest.navn}</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Enhver i stalden kan registrere observationer. Ved &apos;Kan ikke bruges&apos; sygemeldes hesten straks.
                </p>
              </div>
              <button
                type="button"
                onClick={lukModal}
                className="min-h-[44px] min-w-[44px] rounded-lg text-slate-400 hover:text-white flex items-center justify-center text-lg"
              >
                ✕
              </button>
            </div>

            {fejl && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-xs text-rose-300">
                {fejl}
              </div>
            )}

            <form onSubmit={haandterIndsendStatus} className="space-y-4">
              {/* Type vælger */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Type melding
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setType('Helbred')}
                    className={`min-h-[56px] rounded-xl font-medium text-sm transition border ${
                      type === 'Helbred'
                        ? 'bg-sky-600 text-white border-sky-500 shadow-md ring-2 ring-sky-400/30'
                        : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-750'
                    }`}
                  >
                    🏥 Helbred (sygdom/halt)
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('Adfaerd')}
                    className={`min-h-[56px] rounded-xl font-medium text-sm transition border ${
                      type === 'Adfaerd'
                        ? 'bg-sky-600 text-white border-sky-500 shadow-md ring-2 ring-sky-400/30'
                        : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-750'
                    }`}
                  >
                    🐎 Adfærd (urolig/stress)
                  </button>
                </div>
              </div>

              {/* Alvorlighed */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Alvorlighed
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAlvorlighed('Info')}
                    className={`min-h-[56px] rounded-xl font-medium text-sm transition border ${
                      alvorlighed === 'Info'
                        ? 'bg-slate-700 text-white border-slate-500 ring-2 ring-slate-400/30'
                        : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-750'
                    }`}
                  >
                    ℹ️ Info
                  </button>
                  <button
                    type="button"
                    onClick={() => setAlvorlighed('Obs')}
                    className={`min-h-[56px] rounded-xl font-medium text-sm transition border ${
                      alvorlighed === 'Obs'
                        ? 'bg-amber-600 text-white border-amber-500 ring-2 ring-amber-400/30'
                        : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-750'
                    }`}
                  >
                    ⚠️ Obs
                  </button>
                  <button
                    type="button"
                    onClick={() => setAlvorlighed('KanIkkeBruges')}
                    className={`min-h-[56px] rounded-xl font-medium text-sm transition border ${
                      alvorlighed === 'KanIkkeBruges'
                        ? 'bg-rose-600 text-white border-rose-500 ring-2 ring-rose-400/30'
                        : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-750'
                    }`}
                  >
                    🚫 Kan ikke bruges
                  </button>
                </div>
                {alvorlighed === 'KanIkkeBruges' && (
                  <p className="text-xs text-rose-300 mt-2 bg-rose-950/40 p-2 rounded-lg border border-rose-900/60">
                    ⚠️ Bemærk: &apos;Kan ikke bruges&apos; sygemelder straks hesten, så den ikke kan tildeles eller rides på i dag.
                  </p>
                )}
              </div>

              {/* Beskrivelse */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="hestestatus-beskrivelse" className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Beskrivelse
                  </label>
                  <span className="text-xs text-slate-500">{beskrivelse.length} / 500</span>
                </div>
                <textarea
                  id="hestestatus-beskrivelse"
                  value={beskrivelse}
                  onChange={(e) => setBeskrivelse(e.target.value)}
                  placeholder="F.eks. Halter svagt på venstre forben efter foldgang..."
                  rows={3}
                  maxLength={500}
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              {/* Hurtige knapper */}
              <div className="flex flex-wrap gap-2 pt-1">
                {['Halter svagt', 'Mangler sko', 'Hoste/feber', 'Meget urolig i boks', 'Sår/hævelse'].map((kvik) => (
                  <button
                    key={kvik}
                    type="button"
                    onClick={() => setBeskrivelse((prev) => (prev ? `${prev}. ${kvik}` : kvik))}
                    className="min-h-[44px] px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700"
                  >
                    + {kvik}
                  </button>
                ))}
              </div>

              {/* Handlingsknapper */}
              <div className="flex items-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={lukModal}
                  disabled={gemmer}
                  className="flex-1 min-h-[56px] rounded-xl font-medium text-sm bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 transition"
                >
                  Annuller
                </button>
                <button
                  type="submit"
                  disabled={gemmer}
                  className={`flex-1 min-h-[56px] rounded-xl font-bold text-sm text-white transition flex items-center justify-center gap-2 ${
                    alvorlighed === 'KanIkkeBruges'
                      ? 'bg-rose-600 hover:bg-rose-500'
                      : 'bg-sky-600 hover:bg-sky-500'
                  }`}
                >
                  {gemmer ? 'Gemmer...' : 'Indsend melding'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal til redigering af staldnote */}
      {redigererNoteHest && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-100 space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Redigér oplysninger: {redigererNoteHest.navn}</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Opdatér hestens temperament, skåne-status eller staldnoter. Gemmes direkte på hesten.
                </p>
              </div>
              <button
                type="button"
                onClick={lukNoteModal}
                className="min-h-[44px] min-w-[44px] rounded-lg text-slate-400 hover:text-white flex items-center justify-center text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {fejl && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-xs text-rose-300">
                {fejl}
              </div>
            )}

            <form onSubmit={haandterGemNote} className="space-y-4">
              {/* Temperament (Rolig / Normal / Frisk) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Temperament
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Rolig', 'Normal', 'Frisk'] as const).map((temp) => (
                    <button
                      key={temp}
                      type="button"
                      onClick={() => setValgtTemperament(temp)}
                      className={`min-h-[48px] rounded-xl border text-sm font-semibold transition cursor-pointer ${
                        valgtTemperament === temp
                          ? 'bg-sky-600 text-white border-sky-500 shadow-md ring-2 ring-sky-400/50'
                          : 'bg-slate-950 text-slate-300 border-slate-700 hover:bg-slate-800'
                      }`}
                    >
                      {temp}
                    </button>
                  ))}
                </div>
              </div>

              {/* Skånehest toggle */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Skånehest status
                </label>
                <button
                  type="button"
                  onClick={() => setValgtSkaane((prev) => !prev)}
                  className={`w-full min-h-[48px] px-4 rounded-xl border text-sm font-semibold transition cursor-pointer flex items-center justify-between ${
                    valgtSkaane
                      ? 'bg-sky-950 text-sky-200 border-sky-600 ring-2 ring-sky-500/40'
                      : 'bg-slate-950 text-slate-400 border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>🛡️</span>
                    <span>{valgtSkaane ? 'Markeret som skånehest' : 'Normal hest (ikke skåne)'}</span>
                  </div>
                  <span className="text-xs font-bold underline">
                    {valgtSkaane ? 'Aktiv' : 'Slå til'}
                  </span>
                </button>
              </div>

              {/* Staldnote textarea */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Staldnote
                </label>
                <textarea
                  rows={3}
                  value={noteTekst}
                  onChange={(e) => setNoteTekst(e.target.value)}
                  placeholder="F.eks. Skal have klokker på forben under ridning. Får hø i boks før lektion..."
                  className="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={lukNoteModal}
                  disabled={gemmer}
                  className="flex-1 min-h-[52px] rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-medium text-sm border border-slate-700 cursor-pointer"
                >
                  Annuller
                </button>
                <button
                  type="submit"
                  disabled={gemmer}
                  className="flex-1 min-h-[52px] rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm shadow-md cursor-pointer transition"
                >
                  {gemmer ? 'Gemmer...' : 'Gem ændringer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

