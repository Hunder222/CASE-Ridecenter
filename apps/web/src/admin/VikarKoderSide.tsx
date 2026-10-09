import React, { useEffect, useState } from 'react';
import type { VikarKodeOpretSvar, VikarKodePost } from '@ridecenter/contracts';

const LOKAL_STORAGE_NOEGLE = 'ridecenter_vikarkoder';

export const VikarKoderSide: React.FC = () => {
  const [koder, setKoder] = useState<VikarKodePost[]>([]);
  const [indlaeser, setIndlaeser] = useState(true);
  const [fejl, setFejl] = useState<string | null>(null);
  const [oprettetKode, setOprettetKode] = useState<VikarKodeOpretSvar | null>(null);
  const [opretter, setOpretter] = useState(false);
  const [kopieretId, setKopieretId] = useState<string | null>(null);
  const [synligeKoder, setSynligeKoder] = useState<Set<string>>(new Set());

  // Modal til oprettelse af kode
  const [visModal, setVisModal] = useState(false);
  const [opretNavn, setOpretNavn] = useState('');
  const [opretFastVikar, setOpretFastVikar] = useState(false);
  const [opretUdloebDage, setOpretUdloebDage] = useState<number>(90);

  // Sortering og filtrering
  type SorteringsFelt = 'kode' | 'navn' | 'type' | 'status' | 'udstedt' | 'udloeb' | 'anvendt';
  const [sortFelt, setSortFelt] = useState<SorteringsFelt>('udstedt');
  const [sortRetning, setSortRetning] = useState<'asc' | 'desc'>('desc');
  const [typeFilter, setTypeFilter] = useState<'alle' | 'faste' | 'midlertidige'>('alle');
  const [soegTekst, setSoegTekst] = useState('');

  // Modal til efterfølgende redigering af kode (navn og fast vikar)
  const [redigerKode, setRedigerKode] = useState<VikarKodePost | null>(null);
  const [redigerNavn, setRedigerNavn] = useState('');
  const [redigerFastVikar, setRedigerFastVikar] = useState(false);
  const [gemmerRedigering, setGemmerRedigering] = useState(false);

  // Print af bon / seddel
  const [printSeddelData, setPrintSeddelData] = useState<{
    kode: string;
    navn?: string | null;
    fast_vikar?: boolean;
    udloebsdato?: string;
  } | null>(null);

  const udskrivSeddel = (data: {
    kode: string;
    navn?: string | null;
    fast_vikar?: boolean;
    udloebsdato?: string;
  }) => {
    setPrintSeddelData(data);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  // Hent gemte klartekstkoder fra localStorage som fallback
  const hentGemteKoder = (): Record<string, string> => {
    try {
      const raw = localStorage.getItem(LOKAL_STORAGE_NOEGLE);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  };

  const gemKodeLokalt = (id: string, kode: string) => {
    try {
      const nuvaerende = hentGemteKoder();
      nuvaerende[id] = kode;
      localStorage.setItem(LOKAL_STORAGE_NOEGLE, JSON.stringify(nuvaerende));
    } catch {
      // Ignorér fejl
    }
  };

  const hentKoder = async () => {
    setIndlaeser(true);
    try {
      const res = await fetch('/api/v1/auth/vikarkoder');
      if (res.ok) {
        const data: VikarKodePost[] = await res.json();
        const gemte = hentGemteKoder();
        // Berig med eventuelle lokalt huskede koder
        const opdaterede = data.map((k) => ({
          ...k,
          kode: k.kode ?? gemte[k.id] ?? null,
        }));
        setKoder(opdaterede);
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

  const haandterUdstedNyKode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setOpretter(true);
    setFejl(null);
    setKopieretId(null);
    try {
      const payload = {
        navn: opretNavn.trim() || undefined,
        fast_vikar: opretFastVikar,
        udloeb_dage: opretUdloebDage === 0 ? null : opretUdloebDage,
      };

      const res = await fetch('/api/v1/auth/vikarkoder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const nyKode: VikarKodeOpretSvar = await res.json();
        setOprettetKode(nyKode);
        gemKodeLokalt(nyKode.id, nyKode.kode);
        // Åbn automatisk koden i tabellen også
        setSynligeKoder((prev) => new Set(prev).add(nyKode.id));
        setVisModal(false);
        setOpretNavn('');
        setOpretFastVikar(false);
        setOpretUdloebDage(90);
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

  const toggleSynlighed = (id: string) => {
    setSynligeKoder((prev) => {
      const naeste = new Set(prev);
      if (naeste.has(id)) {
        naeste.delete(id);
      } else {
        naeste.add(id);
      }
      return naeste;
    });
  };

  const aabnRedigerModal = (k: VikarKodePost) => {
    setRedigerKode(k);
    setRedigerNavn(k.navn || k.anvendt_af_vikarnavn || '');
    setRedigerFastVikar(Boolean(k.fast_vikar));
  };

  const gemRedigering = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!redigerKode) return;
    setGemmerRedigering(true);
    setFejl(null);
    try {
      const res = await fetch(`/api/v1/auth/vikarkoder/${redigerKode.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          navn: redigerNavn.trim() || null,
          fast_vikar: redigerFastVikar,
        }),
      });
      if (res.ok) {
        setRedigerKode(null);
        await hentKoder();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.besked ?? 'Kunne ikke opdatere vikarkode');
      }
    } catch (err: any) {
      alert(err?.message ?? 'Fejl ved opdatering af vikarkode');
    } finally {
      setGemmerRedigering(false);
    }
  };

  const toggleSortering = (felt: SorteringsFelt) => {
    if (sortFelt === felt) {
      setSortRetning((curr) => (curr === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortFelt(felt);
      setSortRetning('asc');
    }
  };

  const filtreredeOgSorteredeKoder = [...koder]
    .filter((k) => {
      if (typeFilter === 'faste' && !k.fast_vikar) return false;
      if (typeFilter === 'midlertidige' && k.fast_vikar) return false;
      if (soegTekst.trim()) {
        const query = soegTekst.toLowerCase();
        const navnMatch = (k.navn || k.anvendt_af_vikarnavn || '').toLowerCase().includes(query);
        const kodeMatch = (k.kode || '').includes(query);
        const statusMatch = k.status.toLowerCase().includes(query);
        return navnMatch || kodeMatch || statusMatch;
      }
      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      switch (sortFelt) {
        case 'navn': {
          const navnA = a.navn || a.anvendt_af_vikarnavn || '';
          const navnB = b.navn || b.anvendt_af_vikarnavn || '';
          cmp = navnA.localeCompare(navnB, 'da-DK');
          break;
        }
        case 'type': {
          const typeA = a.fast_vikar ? 1 : 0;
          const typeB = b.fast_vikar ? 1 : 0;
          cmp = typeA - typeB;
          break;
        }
        case 'status':
          cmp = a.status.localeCompare(b.status, 'da-DK');
          break;
        case 'udstedt':
          cmp = new Date(a.udstedt_dato).getTime() - new Date(b.udstedt_dato).getTime();
          break;
        case 'udloeb':
          cmp = new Date(a.udloebsdato).getTime() - new Date(b.udloebsdato).getTime();
          break;
        case 'anvendt': {
          const tidA = a.anvendt_dato ? new Date(a.anvendt_dato).getTime() : 0;
          const tidB = b.anvendt_dato ? new Date(b.anvendt_dato).getTime() : 0;
          cmp = tidA - tidB;
          break;
        }
        case 'kode':
          cmp = (a.kode || '').localeCompare(b.kode || '');
          break;
      }
      return sortRetning === 'asc' ? cmp : -cmp;
    });

  const kopierKodeTilUdklipsholder = async (id: string, kodeTekst: string) => {
    try {
      await navigator.clipboard.writeText(kodeTekst);
      setKopieretId(id);
      setTimeout(() => setKopieretId((curr) => (curr === id ? null : curr)), 2000);
    } catch {
      // fallback
    }
  };

  const getStatusBadge = (status: VikarKodePost['status']) => {
    switch (status) {
      case 'Aktiv':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
            ● Aktiv
          </span>
        );
      case 'Anvendt':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-800 border border-sky-300">
            Anvendt
          </span>
        );
      case 'Spaerret':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300">
            Spærret
          </span>
        );
      case 'Udloebet':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-stone-100 text-stone-600 border border-stone-300">
            Udløbet
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header og handling */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-stone-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Vikar-adgang & Koder</h1>
          <p className="text-sm text-stone-600 mt-1">
            Udsted 5-cifrede koder til akutte eller faste vikarer. Faste vikarer kan genbruge deres kode uden automatisk låsning.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setVisModal(true)}
          className="min-h-[44px] px-5 rounded-lg bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-medium text-sm shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
        >
          + Udsted ny vikarkode
        </button>
      </div>

      {fejl && (
        <div className="p-4 rounded-lg bg-rose-50 border border-rose-300 text-sm text-rose-800 font-medium">
          {fejl}
        </div>
      )}

      {/* Modal til oprettelse */}
      {visModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h2 className="text-lg font-bold text-stone-900">Udsted vikarkode</h2>
              <button
                type="button"
                onClick={() => setVisModal(false)}
                className="text-stone-400 hover:text-stone-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={haandterUdstedNyKode} className="space-y-4">
              <div>
                <label htmlFor="vikar-navn-input" className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Navn / Titel (Valgfri)
                </label>
                <input
                  id="vikar-navn-input"
                  type="text"
                  value={opretNavn}
                  onChange={(e) => setOpretNavn(e.target.value)}
                  placeholder="F.eks. Sofie (Fast vikar) eller Akut weekendvikar"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
                <p className="text-xs text-stone-500 mt-1">
                  Angiv personens navn for hurtig genkendelse på staldens login-skærm.
                </p>
              </div>

              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={opretFastVikar}
                    onChange={(e) => setOpretFastVikar(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <div>
                    <span className="text-sm font-bold text-stone-800 block">
                      Fast vikar (Genanvendelig kode)
                    </span>
                    <span className="text-xs text-stone-600 block">
                      Koden forbliver aktiv efter brug og låses ikke automatisk. Ideel til tilbagevendende vikarer.
                    </span>
                  </div>
                </label>
              </div>

              <div>
                <label htmlFor="vikar-udloeb-select" className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Gyldighed / Udløb
                </label>
                <select
                  id="vikar-udloeb-select"
                  value={opretUdloebDage}
                  onChange={(e) => setOpretUdloebDage(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                >
                  <option value={90}>90 dage (Standard)</option>
                  <option value={30}>30 dage</option>
                  <option value={365}>1 år</option>
                  <option value={0}>Udløber aldrig (10 år)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setVisModal(false)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-stone-600 hover:bg-stone-100 transition"
                >
                  Afbryd
                </button>
                <button
                  type="submit"
                  disabled={opretter}
                  className="px-5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold shadow-sm transition disabled:opacity-50"
                >
                  {opretter ? 'Udsteder...' : 'Udsted kode'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Nyoprettet kode-dialog / fremhævelse */}
      {oprettetKode && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-300 p-5 shadow-sm space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 uppercase tracking-wider bg-emerald-200/80 px-2 py-0.5 rounded">
                ✓ Ny vikarkode udstedt
              </span>
              <h2 className="text-sm text-stone-700 mt-1">
                Koden er klar til brug. {oprettetKode.navn ? `Tildelt: ${oprettetKode.navn}. ` : ''}
                {oprettetKode.fast_vikar ? 'Markeret som fast vikar (genanvendelig).' : 'Engangskode.'}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setOprettetKode(null)}
              className="text-stone-500 hover:text-stone-800 text-sm font-semibold p-1"
              title="Luk besked"
            >
              ✕
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 pt-1">
            <div className="text-3xl sm:text-4xl font-mono font-bold tracking-[0.2em] text-emerald-950 bg-white px-5 py-2.5 rounded-lg border border-emerald-400 shadow-inner">
              {oprettetKode.kode}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => kopierKodeTilUdklipsholder('oprettet', oprettetKode.kode)}
                className="min-h-[40px] px-4 rounded-lg bg-white hover:bg-stone-50 active:bg-stone-100 text-stone-800 text-xs font-semibold border border-stone-300 shadow-sm flex items-center gap-1.5 transition"
              >
                {kopieretId === 'oprettet' ? '✓ Kopieret!' : '📋 Kopiér kode'}
              </button>
              <button
                type="button"
                onClick={() =>
                  udskrivSeddel({
                    kode: oprettetKode.kode,
                    navn: oprettetKode.navn,
                    fast_vikar: oprettetKode.fast_vikar,
                    udloebsdato: new Date(oprettetKode.udloebsdato).toLocaleDateString('da-DK'),
                  })
                }
                className="min-h-[40px] px-4 rounded-lg bg-white hover:bg-stone-50 text-stone-700 text-xs font-semibold border border-stone-300 shadow-sm transition flex items-center gap-1.5"
              >
                🖨️ Udskriv seddel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal til redigering af vikarkode (navngivning og fast vikar) */}
      {redigerKode && (
        <div className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h2 className="text-lg font-bold text-stone-900">Redigér vikarkode</h2>
              <button
                type="button"
                onClick={() => setRedigerKode(null)}
                className="text-stone-400 hover:text-stone-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={gemRedigering} className="space-y-4">
              <div>
                <label htmlFor="rediger-navn-input" className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Navn / Titel
                </label>
                <input
                  id="rediger-navn-input"
                  type="text"
                  value={redigerNavn}
                  onChange={(e) => setRedigerNavn(e.target.value)}
                  placeholder="F.eks. Sofie (Fast vikar) eller Weekendvikar 1"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
                <p className="text-xs text-stone-500 mt-1">
                  Navngiv koden, så den fremgår med et genkendeligt navn på tablet og i rapporter.
                </p>
              </div>

              <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 space-y-2">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={redigerFastVikar}
                    onChange={(e) => setRedigerFastVikar(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="text-sm font-bold text-stone-900 block">
                      Fast vikar (Permanent profil)
                    </span>
                    <span className="text-xs text-stone-600 block mt-0.5 leading-relaxed">
                      Faste vikarer kan genbruge deres kode gentagne gange og låses ikke automatisk efter brug.
                      Udløbsdato forlænges automatisk.
                    </span>
                  </div>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setRedigerKode(null)}
                  className="px-4 py-2 rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50 text-sm font-semibold transition"
                >
                  Annullér
                </button>
                <button
                  type="submit"
                  disabled={gemmerRedigering}
                  className="px-5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold shadow-sm transition disabled:opacity-50"
                >
                  {gemmerRedigering ? 'Gemmer...' : 'Gem ændringer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tabel over vikarkoder med sortering og filtrering */}
      <div className="rounded-lg border border-stone-300 bg-white overflow-hidden shadow-sm">
        {/* Kontrolbjælke: filtre og søgning */}
        <div className="px-5 py-3.5 border-b border-stone-200 bg-stone-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setTypeFilter('alle')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                typeFilter === 'alle'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-white text-stone-700 border border-stone-300 hover:bg-stone-100'
              }`}
            >
              Alle ({koder.length})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('faste')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                typeFilter === 'faste'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-white text-stone-700 border border-stone-300 hover:bg-stone-100'
              }`}
            >
              Faste vikarer ({koder.filter((k) => k.fast_vikar).length})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('midlertidige')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                typeFilter === 'midlertidige'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-white text-stone-700 border border-stone-300 hover:bg-stone-100'
              }`}
            >
              Midlertidige ({koder.filter((k) => !k.fast_vikar).length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="search"
              value={soegTekst}
              onChange={(e) => setSoegTekst(e.target.value)}
              placeholder="Søg vikar eller kode..."
              className="px-3 py-1.5 rounded-lg border border-stone-300 text-xs w-full sm:w-48 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>
        </div>

        {indlaeser ? (
          <div className="p-8 text-center text-stone-500 font-medium">Henter koder...</div>
        ) : filtreredeOgSorteredeKoder.length === 0 ? (
          <div className="p-8 text-center text-stone-500 text-sm">
            {koder.length === 0
              ? 'Ingen vikarkoder udstedt endnu. Klik på knappen ovenfor for at oprette en kode.'
              : 'Ingen vikarkoder matcher det valgte filter eller søgning.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-stone-800">
              <thead className="bg-stone-100 text-xs font-semibold text-stone-700 uppercase tracking-wider border-b border-stone-300">
                <tr>
                  <th
                    className="px-4 py-3 cursor-pointer hover:bg-stone-200 select-none transition"
                    onClick={() => toggleSortering('kode')}
                  >
                    <span className="flex items-center gap-1">
                      Kode {sortFelt === 'kode' && (sortRetning === 'asc' ? '▲' : '▼')}
                    </span>
                  </th>
                  <th
                    className="px-4 py-3 cursor-pointer hover:bg-stone-200 select-none transition"
                    onClick={() => toggleSortering('navn')}
                  >
                    <span className="flex items-center gap-1">
                      Navn / Titel {sortFelt === 'navn' && (sortRetning === 'asc' ? '▲' : '▼')}
                    </span>
                  </th>
                  <th
                    className="px-4 py-3 cursor-pointer hover:bg-stone-200 select-none transition"
                    onClick={() => toggleSortering('type')}
                  >
                    <span className="flex items-center gap-1">
                      Type {sortFelt === 'type' && (sortRetning === 'asc' ? '▲' : '▼')}
                    </span>
                  </th>
                  <th
                    className="px-4 py-3 cursor-pointer hover:bg-stone-200 select-none transition"
                    onClick={() => toggleSortering('status')}
                  >
                    <span className="flex items-center gap-1">
                      Status {sortFelt === 'status' && (sortRetning === 'asc' ? '▲' : '▼')}
                    </span>
                  </th>
                  <th
                    className="px-4 py-3 cursor-pointer hover:bg-stone-200 select-none transition"
                    onClick={() => toggleSortering('udstedt')}
                  >
                    <span className="flex items-center gap-1">
                      Udstedt {sortFelt === 'udstedt' && (sortRetning === 'asc' ? '▲' : '▼')}
                    </span>
                  </th>
                  <th
                    className="px-4 py-3 cursor-pointer hover:bg-stone-200 select-none transition"
                    onClick={() => toggleSortering('udloeb')}
                  >
                    <span className="flex items-center gap-1">
                      Udløb {sortFelt === 'udloeb' && (sortRetning === 'asc' ? '▲' : '▼')}
                    </span>
                  </th>
                  <th
                    className="px-4 py-3 cursor-pointer hover:bg-stone-200 select-none transition"
                    onClick={() => toggleSortering('anvendt')}
                  >
                    <span className="flex items-center gap-1">
                      Sidst anvendt {sortFelt === 'anvendt' && (sortRetning === 'asc' ? '▲' : '▼')}
                    </span>
                  </th>
                  <th className="px-4 py-3 text-right">Handling</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {filtreredeOgSorteredeKoder.map((k) => {
                  const erSynlig = synligeKoder.has(k.id);
                  const kodeVaerdi = k.kode;
                  const erKopieret = kopieretId === k.id;

                  return (
                    <tr key={k.id} className="hover:bg-stone-50/80 transition">
                      {/* Kode med øje-ikon og kopiér */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-mono font-bold text-sm px-2.5 py-1 rounded border tracking-wider ${
                              erSynlig
                                ? 'bg-amber-50 text-stone-900 border-amber-300'
                                : 'bg-stone-100 text-stone-500 border-stone-300'
                            }`}
                          >
                            {erSynlig ? (kodeVaerdi ?? '••••••') : '••••••'}
                          </span>

                          {/* Øje ikon til vis/skjul */}
                          <button
                            type="button"
                            onClick={() => toggleSynlighed(k.id)}
                            title={erSynlig ? 'Skjul kode' : 'Vis kode'}
                            aria-label={erSynlig ? 'Skjul kode' : 'Vis kode'}
                            className="p-1.5 rounded hover:bg-stone-200 text-stone-600 hover:text-stone-900 transition cursor-pointer"
                          >
                            {erSynlig ? '🙈' : '👁️'}
                          </button>

                          {/* Kopiér-knap hvis kode er kendt */}
                          {kodeVaerdi && (
                            <button
                              type="button"
                              onClick={() => kopierKodeTilUdklipsholder(k.id, kodeVaerdi)}
                              title="Kopiér kode"
                              aria-label="Kopiér kode"
                              className="p-1.5 rounded hover:bg-stone-200 text-stone-600 hover:text-stone-900 transition cursor-pointer text-xs"
                            >
                              {erKopieret ? '✓' : '📋'}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Navn / Titel */}
                      <td className="px-4 py-3.5 font-medium text-stone-900 whitespace-nowrap">
                        {k.navn || k.anvendt_af_vikarnavn || (
                          <span className="text-stone-400 italic">Ikke navngivet</span>
                        )}
                      </td>

                      {/* Type */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {k.fast_vikar ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-sky-100 text-sky-800 border border-sky-300">
                            Fast vikar
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-stone-100 text-stone-700 border border-stone-200">
                            Midlertidig
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap">{getStatusBadge(k.status)}</td>

                      {/* Udstedt */}
                      <td className="px-4 py-3.5 text-xs text-stone-600 font-mono whitespace-nowrap">
                        {new Date(k.udstedt_dato).toLocaleString('da-DK', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </td>

                      {/* Udløb */}
                      <td className="px-4 py-3.5 text-xs text-stone-600 font-mono whitespace-nowrap">
                        {(() => {
                          const udloebAar = new Date(k.udloebsdato).getFullYear();
                          if (udloebAar >= 2035) {
                            return <span className="text-emerald-700 font-semibold">Udløber aldrig</span>;
                          }
                          return new Date(k.udloebsdato).toLocaleDateString('da-DK', {
                            dateStyle: 'short',
                          });
                        })()}
                      </td>

                      {/* Sidst anvendt */}
                      <td className="px-4 py-3.5 text-xs text-stone-600">
                        {k.anvendt_dato ? (
                          <div>
                            {k.anvendt_af_vikarnavn && (
                              <span className="font-medium text-stone-900 block truncate max-w-[150px]">
                                {k.anvendt_af_vikarnavn}
                              </span>
                            )}
                            <span className="font-mono text-stone-500">
                              {new Date(k.anvendt_dato).toLocaleString('da-DK', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })}
                            </span>
                          </div>
                        ) : (
                          <span className="text-stone-400 italic">Aldrig anvendt</span>
                        )}
                      </td>

                      {/* Handling */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => aabnRedigerModal(k)}
                            className="px-2.5 py-1 rounded text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 transition cursor-pointer flex items-center gap-1"
                            title="Navngiv koden eller gør til fast vikar"
                          >
                            <span>✏️</span>
                            <span>Redigér</span>
                          </button>

                          {kodeVaerdi && (
                            <button
                              type="button"
                              onClick={() =>
                                udskrivSeddel({
                                  kode: kodeVaerdi,
                                  navn: k.navn || k.anvendt_af_vikarnavn,
                                  fast_vikar: k.fast_vikar,
                                  udloebsdato: new Date(k.udloebsdato).toLocaleDateString('da-DK'),
                                })
                              }
                              className="px-2 py-1 rounded text-xs font-medium text-stone-700 hover:text-stone-900 bg-white hover:bg-stone-100 border border-stone-300 transition cursor-pointer flex items-center gap-1"
                              title="Udskriv bon/seddel for denne kode"
                            >
                              🖨️ Bon
                            </button>
                          )}
                          {(k.status === 'Aktiv' || k.status === 'Anvendt') && (
                            <button
                              type="button"
                              onClick={() => haandterSpaerKode(k.id)}
                              className="px-2.5 py-1 rounded text-xs font-medium text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 border border-rose-300 transition cursor-pointer"
                            >
                              Spær
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Print styling - skjuler alt andet end kvitteringen ved udskrivning */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #vikar-print-seddel, #vikar-print-seddel * {
            visibility: visible !important;
          }
          #vikar-print-seddel {
            position: fixed !important;
            left: 50% !important;
            top: 2rem !important;
            transform: translateX(-50%) !important;
            width: 90% !important;
            max-width: 480px !important;
            display: block !important;
            margin: 0 auto !important;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      {/* Fysisk udskriftsbon - kun synlig i print preview */}
      <div
        id="vikar-print-seddel"
        className="hidden print:block p-8 border-2 border-dashed border-stone-800 rounded-2xl text-center space-y-4"
      >
        <div className="border-b-2 border-stone-800 pb-3">
          <h1 className="text-2xl font-bold uppercase tracking-wider text-stone-900">Bøgegården Ridecenter</h1>
          <p className="text-sm font-semibold text-stone-600">Vikar Login Adgangskode</p>
        </div>

        {printSeddelData?.navn && (
          <div className="text-left bg-stone-100 p-3 rounded">
            <span className="text-xs font-bold text-stone-500 uppercase block">Tildelt vikar</span>
            <span className="text-lg font-bold text-stone-900">{printSeddelData.navn}</span>
          </div>
        )}

        <div className="py-4 bg-stone-50 border-2 border-stone-900 rounded-xl my-4">
          <span className="text-xs uppercase tracking-widest text-stone-500 font-bold block mb-1">
            Pinkode til staldtablet
          </span>
          <span className="text-4xl font-mono font-black tracking-[0.25em] text-stone-900">
            {printSeddelData?.kode}
          </span>
        </div>

        <div className="text-left text-xs space-y-2 text-stone-700 bg-stone-50 p-4 rounded border border-stone-200">
          <p className="font-bold text-stone-900">Vejledning til stald-tablet:</p>
          <p>1. Åbn tabletten i stalden og gå til <strong>Vikar Login</strong>.</p>
          <p>
            2.{' '}
            {printSeddelData?.navn
              ? `Vælg "${printSeddelData.navn}" på listen over registrerede vikarer.`
              : 'Indtast dit navn på skærmen.'}
          </p>
          <p>3. Indtast den 5-cifrede pinkode for at låse staldvisningen op.</p>
          <p className="text-[10px] text-stone-500 pt-2 border-t border-stone-200">
            Kodetype: {printSeddelData?.fast_vikar ? 'Fast vikar (genanvendelig)' : 'Engangskode (låser efter brug)'}
            {printSeddelData?.udloebsdato ? ` • Udløber: ${printSeddelData.udloebsdato}` : ''}
          </p>
        </div>

        <div className="text-[10px] text-stone-400 pt-2 border-t border-stone-300">
          Udskrevet {new Date().toLocaleString('da-DK')} • Fortroligt vikarlogin
        </div>
      </div>
    </div>
  );
};
