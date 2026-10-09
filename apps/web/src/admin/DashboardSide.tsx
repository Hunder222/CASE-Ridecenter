import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import type { DashboardNoegletalSvar, HestBelastningCelle } from '@ridecenter/contracts';
import { maanedNavn } from '../faelles/maaned';

export const DashboardSide: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardNoegletalSvar | null>(null);
  const [valgtMaaned, setValgtMaaned] = useState<string>('2026-10');
  const [indlaeser, setIndlaeser] = useState(true);
  const [fejl, setFejl] = useState<string | null>(null);

  const [hesteData, setHesteData] = useState<any[]>([]);
  const [kapacitetFilter, setKapacitetFilter] = useState<{
    gruppe: string;
    felt: string;
    label: string;
  } | null>(null);

  const hentData = async (maaned?: string) => {
    try {
      const url = maaned ? `/api/v1/dashboard/noegletal?maaned=${maaned}` : '/api/v1/dashboard/noegletal';
      const [res, hesteRes] = await Promise.all([
        fetch(url, { credentials: 'include' }),
        fetch('/api/v1/heste', { credentials: 'include' }).catch(() => null),
      ]);

      if (res.ok) {
        const d: DashboardNoegletalSvar = await res.json();
        setData(d);
        if (d.valgt_maaned && !maaned) {
          setValgtMaaned(d.valgt_maaned);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        setFejl(err.besked ?? 'Kunne ikke hente dashboard nøgletal');
      }

      if (hesteRes && hesteRes.ok) {
        const h = await hesteRes.json();
        setHesteData(h);
      }
    } catch (err: any) {
      setFejl(err?.message ?? 'Fejl ved hentning af nøgletal');
    } finally {
      setIndlaeser(false);
    }
  };

  useEffect(() => {
    hentData(valgtMaaned);

    // SSE-lytter for live opdateringer (US4, T165)
    try {
      const es = new EventSource('/api/v1/events');
      es.addEventListener('plads.opdateret', () => hentData(valgtMaaned));
      es.addEventListener('hest.status', () => hentData(valgtMaaned));
      es.addEventListener('lektioner.publiceret', () => hentData(valgtMaaned));
      return () => es.close();
    } catch {
      // ignore
    }
  }, [valgtMaaned]);

  if (indlaeser) {
    return (
      <div className="flex items-center justify-center min-h-[300px] text-stone-500">
        Indlæser ledelsesoverblik...
      </div>
    );
  }

  // Gruppér heatmap celler efter hest_id
  const hesteRækker: Record<string, { hestNavn: string; sundhedsstatus?: string; celler: HestBelastningCelle[] }> = {};
  if (data?.hest_belastningsfordeling) {
    for (const c of data.hest_belastningsfordeling) {
      if (!hesteRækker[c.hest_id]) {
        hesteRækker[c.hest_id] = { hestNavn: c.hest_navn, sundhedsstatus: c.sundhedsstatus, celler: [] };
      }
      hesteRækker[c.hest_id]!.celler.push(c);
    }
  }

  const tilgaengeligeMaaneder = data?.tilgaengelige_maaneder ?? ['2026-10', '2026-11'];
  const aktuelIndex = tilgaengeligeMaaneder.indexOf(valgtMaaned);
  const harForrige = aktuelIndex > 0;
  const harNaeste = aktuelIndex !== -1 && aktuelIndex < tilgaengeligeMaaneder.length - 1;

  const gaaTilForrige = () => {
    if (harForrige) {
      setValgtMaaned(tilgaengeligeMaaneder[aktuelIndex - 1]!);
    }
  };

  const gaaTilNaeste = () => {
    if (harNaeste) {
      setValgtMaaned(tilgaengeligeMaaneder[aktuelIndex + 1]!);
    }
  };

  // Heste metadata map for filtrering
  const hesteMetaMap = new Map<string, any>(hesteData.map((h) => [h.id, h]));

  // Tællere til kapacitet & temperament
  const kapacitetTællere = {
    begynder: hesteData.filter((h) => h.godkendt_til_begyndere).length,
    skaane: hesteData.filter((h) => h.skaane).length,
    spring: hesteData.filter((h) => !h.springforbud && (h.max_spring_uge ?? 0) > 0).length,
    temperament: {
      Rolig: hesteData.filter((h) => h.temperament === 'Rolig').length,
      Normal: hesteData.filter((h) => h.temperament === 'Normal').length,
      Frisk: hesteData.filter((h) => h.temperament === 'Frisk').length,
    },
  };

  // Filtrerede heatmap rækker baseret på kapacitetFilter
  const filtreredeHesteRækker = Object.entries(hesteRækker).filter(([hestId, r]) => {
    if (!kapacitetFilter) return true;
    const meta = hesteMetaMap.get(hestId) ?? hesteData.find((h) => h.navn === r.hestNavn);
    if (!meta) return true;

    if (kapacitetFilter.felt === 'begynder') return !!meta.godkendt_til_begyndere;
    if (kapacitetFilter.felt === 'skaane') return !!meta.skaane;
    if (kapacitetFilter.felt === 'spring') return !meta.springforbud;
    if (kapacitetFilter.gruppe === 'Temperamentsoversigt') return meta.temperament === kapacitetFilter.felt;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">Ledelsesoverblik</h1>
        <p className="text-sm text-stone-500 mt-1">
          Live nøgletal, hestebelastning og automatisk fraværsmonitorering via realtids-hændelser.
        </p>
      </div>

      {fejl && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          {fejl}
        </div>
      )}

      {/* KAPACITETSUDNYTTELSE (4 nøgletal) */}
      <div className="space-y-2">
        <div className="text-xs font-bold uppercase tracking-wider text-stone-500">
          Kapacitetsudnyttelse
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Samlet holdudnyttelse */}
          <div className="rounded-2xl bg-white border border-stone-200 p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-stone-600 uppercase tracking-wider">
                  Holdudnyttelse (samlet)
                </span>
                {data?.samlet_holdudnyttelse_detaljer?.er_over_holddag_max && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-600 text-white">
                    &gt;100% holddag
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span
                  className={`text-3xl font-extrabold ${
                    data?.samlet_holdudnyttelse_detaljer?.er_over_holddag_max
                      ? 'text-rose-600'
                      : 'text-stone-900'
                  }`}
                >
                  {data?.samlet_holdudnyttelse_detaljer?.effektiv_udnyttelse_procent ??
                    data?.ugentlig_holdudnyttelse_procent ??
                    0}
                  %
                </span>
                <span className="text-[11px] text-stone-500 font-medium">
                  inkl. planlagte hestehviledage
                </span>
              </div>
              <span className="text-xs text-stone-500 mt-2 block">
                {data?.samlet_holdudnyttelse_detaljer
                  ? `${data.samlet_holdudnyttelse_detaljer.tilmeldte} elever / ${data.samlet_holdudnyttelse_detaljer.kapacitet} pladser (${data.samlet_holdudnyttelse_detaljer.ugebasis_procent}% ugebasis)`
                  : 'Tilmeldte vs. max kapacitet'}
              </span>
            </div>
          </div>

          {/* Begynder-heste */}
          <div className="rounded-2xl bg-white border border-stone-200 p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
                  Begynder-heste
                </span>
                {data?.begynder_heste_detaljer?.er_over_holddag_max && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-600 text-white">
                    &gt;100% holddag
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span
                  className={`text-3xl font-extrabold ${
                    data?.begynder_heste_detaljer?.er_over_holddag_max
                      ? 'text-rose-600'
                      : 'text-emerald-700'
                  }`}
                >
                  {data?.begynder_heste_detaljer?.effektiv_udnyttelse_procent ??
                    data?.begynder_heste_udnyttelse_procent ??
                    0}
                  %
                </span>
                <span className="text-[11px] text-stone-500 font-medium">
                  inkl. planlagte hestehviledage
                </span>
              </div>
              <span className="text-xs text-stone-500 mt-2 block">
                {data?.begynder_heste_detaljer
                  ? `${data.begynder_heste_detaljer.tilmeldte} elever / ${data.begynder_heste_detaljer.kapacitet} pladser (${data.begynder_heste_detaljer.ugebasis_procent}% ugebasis)`
                  : 'Begynder & trækhold'}
              </span>
            </div>
          </div>

          {/* Øvet-heste */}
          <div className="rounded-2xl bg-white border border-stone-200 p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-sky-800 uppercase tracking-wider">
                  Øvet-heste
                </span>
                {data?.oevet_heste_detaljer?.er_over_holddag_max && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-600 text-white">
                    &gt;100% holddag
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span
                  className={`text-3xl font-extrabold ${
                    data?.oevet_heste_detaljer?.er_over_holddag_max
                      ? 'text-rose-600'
                      : 'text-sky-700'
                  }`}
                >
                  {data?.oevet_heste_detaljer?.effektiv_udnyttelse_procent ??
                    data?.oevet_heste_udnyttelse_procent ??
                    0}
                  %
                </span>
                <span className="text-[11px] text-stone-500 font-medium">
                  inkl. planlagte hestehviledage
                </span>
              </div>
              <span className="text-xs text-stone-500 mt-2 block">
                {data?.oevet_heste_detaljer
                  ? `${data.oevet_heste_detaljer.tilmeldte} elever / ${data.oevet_heste_detaljer.kapacitet} pladser (${data.oevet_heste_detaljer.ugebasis_procent}% ugebasis)`
                  : 'Øvet & letøvet hold'}
              </span>
            </div>
          </div>

          {/* Spring-heste */}
          <div className="rounded-2xl bg-white border border-stone-200 p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-rose-800 uppercase tracking-wider">
                  Spring-heste
                </span>
                {data?.spring_heste_detaljer?.er_over_holddag_max && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-600 text-white">
                    &gt;100% holddag
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span
                  className={`text-3xl font-extrabold ${
                    data?.spring_heste_detaljer?.er_over_holddag_max
                      ? 'text-rose-600'
                      : 'text-stone-900'
                  }`}
                >
                  {data?.spring_heste_detaljer?.effektiv_udnyttelse_procent ??
                    data?.spring_heste_udnyttelse_procent ??
                    0}
                  %
                </span>
                <span className="text-[11px] text-stone-500 font-medium">
                  inkl. planlagte hestehviledage
                </span>
              </div>
              <span className="text-xs text-stone-500 mt-2 block">
                {data?.spring_heste_detaljer
                  ? `${data.spring_heste_detaljer.tilmeldte} elever / ${data.spring_heste_detaljer.kapacitet} springheste (${data.spring_heste_detaljer.ugebasis_procent}% ugebasis)`
                  : 'Springhold (HC-05)'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* DRIFTS-STATUS */}
      <div className="space-y-2">
        <div className="text-xs font-bold uppercase tracking-wider text-stone-500">
          Driftsstatus & bemanding
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div
            onClick={() => navigate('/admin/heste')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && navigate('/admin/heste')}
            className="rounded-2xl bg-white border border-stone-200 p-5 shadow-sm hover:border-stone-400 hover:shadow-md transition cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider group-hover:text-stone-800 transition">
                Heste ude af drift
              </span>
              <span className="text-xs text-stone-400 group-hover:text-stone-700 transition">→</span>
            </div>
            <div
              className={`text-3xl font-extrabold mt-1 ${
                (data?.antal_heste_ude_af_drift ?? 0) > 0 ? 'text-amber-600' : 'text-stone-900'
              }`}
            >
              {data?.antal_heste_ude_af_drift ?? 0}
            </div>
            <span className="text-xs text-stone-400 mt-1 block">Sygemeldt, skadet el. karantæne</span>
          </div>

          <div
            onClick={() => navigate('/admin/venteliste')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && navigate('/admin/venteliste')}
            className="rounded-2xl bg-white border border-stone-200 p-5 shadow-sm hover:border-stone-400 hover:shadow-md transition cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider group-hover:text-stone-800 transition">
                Ventelisteforslag
              </span>
              <span className="text-xs text-stone-400 group-hover:text-stone-700 transition">→</span>
            </div>
            <div
              className={`text-3xl font-extrabold mt-1 ${
                (data?.afventende_ventelisteforslag ?? 0) > 0 ? 'text-sky-600' : 'text-stone-900'
              }`}
            >
              {data?.afventende_ventelisteforslag ?? 0}
            </div>
            <span className="text-xs text-stone-400 mt-1 block">Afventer manuel godkendelse</span>
          </div>

          <div
            onClick={() => navigate('/admin/vikarkoder')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && navigate('/admin/vikarkoder')}
            className="rounded-2xl bg-white border border-stone-200 p-5 shadow-sm hover:border-stone-400 hover:shadow-md transition cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider group-hover:text-stone-800 transition">
                Aktive vikarkoder
              </span>
              <span className="text-xs text-stone-400 group-hover:text-stone-700 transition">→</span>
            </div>
            <div className="text-3xl font-extrabold text-stone-900 mt-1">
              {data?.aktive_vikarkoder ?? 0}
            </div>
            <span className="text-xs text-stone-400 mt-1 block">Gyldige 5-cifrede engangskoder</span>
          </div>
        </div>
      </div>

      {/* Ekstra kapacitets- og temperamentsoversigt (interaktive filtre) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Nøgletal for anvendelighed */}
        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm flex flex-col justify-between">
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">
            Egenskaber & kapacitet
          </div>
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() =>
                setKapacitetFilter((prev) =>
                  prev?.felt === 'begynder'
                    ? null
                    : { gruppe: 'Egenskaber & kapacitet', felt: 'begynder', label: 'Begyndervenlig' },
                )
              }
              className={`rounded-xl p-3 border text-left transition cursor-pointer ${
                kapacitetFilter?.felt === 'begynder'
                  ? 'bg-emerald-100 border-emerald-500 ring-2 ring-emerald-500 shadow-sm'
                  : 'bg-emerald-50/70 border-emerald-100 hover:bg-emerald-100/70'
              }`}
            >
              <div className="text-xs font-semibold text-emerald-800">Begyndervenlig</div>
              <div className="text-2xl font-extrabold text-emerald-700 mt-0.5">
                {kapacitetTællere.begynder} <span className="text-xs font-normal text-stone-500">heste</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                setKapacitetFilter((prev) =>
                  prev?.felt === 'skaane'
                    ? null
                    : { gruppe: 'Egenskaber & kapacitet', felt: 'skaane', label: 'Er skånehest' },
                )
              }
              className={`rounded-xl p-3 border text-left transition cursor-pointer ${
                kapacitetFilter?.felt === 'skaane'
                  ? 'bg-sky-100 border-sky-500 ring-2 ring-sky-500 shadow-sm'
                  : 'bg-sky-50/70 border-sky-100 hover:bg-sky-100/70'
              }`}
            >
              <div className="text-xs font-semibold text-sky-800">Er skånehest</div>
              <div className="text-2xl font-extrabold text-sky-700 mt-0.5">
                {kapacitetTællere.skaane} <span className="text-xs font-normal text-stone-500">heste</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                setKapacitetFilter((prev) =>
                  prev?.felt === 'spring'
                    ? null
                    : { gruppe: 'Egenskaber & kapacitet', felt: 'spring', label: 'Må springe' },
                )
              }
              className={`rounded-xl p-3 border text-left transition cursor-pointer ${
                kapacitetFilter?.felt === 'spring'
                  ? 'bg-indigo-100 border-indigo-500 ring-2 ring-indigo-500 shadow-sm'
                  : 'bg-indigo-50/70 border-indigo-100 hover:bg-indigo-100/70'
              }`}
            >
              <div className="text-xs font-semibold text-indigo-800">Må springe</div>
              <div className="text-2xl font-extrabold text-indigo-700 mt-0.5">
                {kapacitetTællere.spring} <span className="text-xs font-normal text-stone-500">heste</span>
              </div>
            </button>
          </div>
        </div>

        {/* Oversigt over temperament */}
        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm flex flex-col justify-between">
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">
            Temperamentsoversigt
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() =>
                setKapacitetFilter((prev) =>
                  prev?.felt === 'Rolig'
                    ? null
                    : { gruppe: 'Temperamentsoversigt', felt: 'Rolig', label: 'Rolig' },
                )
              }
              className={`rounded-xl p-2.5 border text-center transition cursor-pointer ${
                kapacitetFilter?.felt === 'Rolig'
                  ? 'bg-stone-200 border-stone-500 ring-2 ring-stone-500 shadow-sm'
                  : 'bg-stone-50 border-stone-200/80 hover:bg-stone-100'
              }`}
            >
              <div className="text-xs font-medium text-stone-600">Rolig</div>
              <div className="text-xl font-bold text-stone-800 mt-0.5">
                {kapacitetTællere.temperament.Rolig}
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                setKapacitetFilter((prev) =>
                  prev?.felt === 'Normal'
                    ? null
                    : { gruppe: 'Temperamentsoversigt', felt: 'Normal', label: 'Normal' },
                )
              }
              className={`rounded-xl p-2.5 border text-center transition cursor-pointer ${
                kapacitetFilter?.felt === 'Normal'
                  ? 'bg-stone-200 border-stone-500 ring-2 ring-stone-500 shadow-sm'
                  : 'bg-stone-50 border-stone-200/80 hover:bg-stone-100'
              }`}
            >
              <div className="text-xs font-medium text-stone-600">Normal</div>
              <div className="text-xl font-bold text-stone-800 mt-0.5">
                {kapacitetTællere.temperament.Normal}
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                setKapacitetFilter((prev) =>
                  prev?.felt === 'Frisk'
                    ? null
                    : { gruppe: 'Temperamentsoversigt', felt: 'Frisk', label: 'Frisk' },
                )
              }
              className={`rounded-xl p-2.5 border text-center transition cursor-pointer ${
                kapacitetFilter?.felt === 'Frisk'
                  ? 'bg-amber-100 border-amber-500 ring-2 ring-amber-500 shadow-sm'
                  : 'bg-amber-50 border-amber-200 hover:bg-amber-100/70'
              }`}
            >
              <div className="text-xs font-medium text-amber-800">Frisk</div>
              <div className="text-xl font-bold text-amber-700 mt-0.5">
                {kapacitetTællere.temperament.Frisk}
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Aktivt filter-banner */}
      {kapacitetFilter && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 border border-amber-300 px-4 py-3 text-sm text-amber-950 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="text-base">🔎</span>
            <span>
              Viser <strong>{kapacitetFilter.gruppe}: {kapacitetFilter.label}</strong> ({filtreredeHesteRækker.length} heste fundet i holdplanen)
            </span>
          </div>
          <button
            type="button"
            onClick={() => setKapacitetFilter(null)}
            className="rounded-lg bg-white border border-amber-400 px-3 py-1 font-bold text-xs text-amber-900 hover:bg-amber-100 transition cursor-pointer shadow-xs"
          >
            Reset
          </button>
        </div>
      )}

      {/* ADVARSLER OM GENTAGET FRAVÆR (FR-016: 3+ udeblivelser i træk) */}
      {data?.gentaget_fravaer_advarsler && data.gentaget_fravaer_advarsler.length > 0 && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5 space-y-3">
          <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
            <span>⚠️</span>
            <span>Advarsel: Gentaget elevfravær registreret (3+ udeblivelser i træk)</span>
          </div>
          <div className="space-y-2">
            {data.gentaget_fravaer_advarsler.map((adv) => (
              <div
                key={`${adv.rytter_id}-${adv.holdnavn}`}
                className="flex items-center justify-between text-xs bg-white/80 p-3 rounded-xl border border-amber-200/80 text-amber-950"
              >
                <div>
                  <span className="font-bold">{adv.rytter_navn}</span> på{' '}
                  <span className="font-semibold">{adv.holdnavn}</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-900 font-bold">
                  {adv.antal_udeblivelser_i_traek} udeblivelser i træk
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* INTERAKTIVT HEATMAP FOR HESTEBELASTNING */}
      <div className="rounded-2xl bg-white border border-stone-200 overflow-hidden shadow-sm">
        <div className="p-5 border-b border-stone-200 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-stone-900">
                Hesteflådens belastningsfordeling (Heatmap)
              </h2>
              <span className="rounded bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-700 capitalize">
                {maanedNavn(valgtMaaned)}
              </span>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              Planlagte lektioner pr. ugedag sammenholdt med hestens daglige max-grænse og hviledag.
            </p>
          </div>

          {/* Månedsvælger */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-stone-600">Holdplan for måned:</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={gaaTilForrige}
                disabled={!harForrige}
                className="h-8 px-2 rounded-lg border border-stone-300 bg-stone-50 text-stone-700 hover:bg-stone-200 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold transition"
                title="Forrige måned"
              >
                ←
              </button>

              <select
                value={valgtMaaned}
                onChange={(e) => setValgtMaaned(e.target.value)}
                className="h-8 px-2.5 rounded-lg border border-stone-300 bg-white text-stone-900 font-semibold text-xs capitalize cursor-pointer focus:ring-1 focus:ring-emerald-500"
              >
                {tilgaengeligeMaaneder.map((m) => (
                  <option key={m} value={m}>
                    {maanedNavn(m)}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={gaaTilNaeste}
                disabled={!harNaeste}
                className="h-8 px-2 rounded-lg border border-stone-300 bg-stone-50 text-stone-700 hover:bg-stone-200 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold transition"
                title="Næste måned"
              >
                →
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto p-4">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-stone-200 text-stone-500 uppercase">
                <th className="py-2.5 px-3 font-semibold">Hest</th>
                <th className="py-2.5 px-3 font-semibold text-center">Status</th>
                {['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'].map((dag) => (
                  <th key={dag} className="py-2.5 px-3 text-center font-semibold">
                    {dag}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtreredeHesteRækker.map(([, r]) => {
                const status = r.sundhedsstatus ?? 'Aktiv';
                return (
                  <tr key={r.hestNavn} className="hover:bg-stone-50">
                    <td className="py-2.5 px-3 font-medium text-stone-900">{r.hestNavn}</td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      {status === 'Aktiv' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                          <span>🟢</span> Rask
                        </span>
                      ) : status === 'Sygemeldt' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 border border-rose-200">
                          <span>🔴</span> Syg
                        </span>
                      ) : status === 'Skadet' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 border border-amber-200">
                          <span>🟠</span> Skadet
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-700 border border-purple-200">
                          <span>🟣</span> Karantæne
                        </span>
                      )}
                    </td>
                    {r.celler.map((c) => {
                      let celleKlasse = 'bg-stone-50 text-stone-400';
                      if (c.er_hviledag) {
                        celleKlasse = c.planlagte_lektioner > 0
                          ? 'bg-rose-100 text-rose-800 font-bold border-2 border-sky-500 shadow-sm'
                          : 'bg-sky-50 text-sky-700 font-medium border border-sky-200';
                      } else if (c.er_over_max) {
                        celleKlasse = 'bg-rose-100 text-rose-800 font-bold ring-1 ring-rose-400';
                      } else if (c.planlagte_lektioner > 0) {
                        celleKlasse = 'bg-emerald-100 text-emerald-800 font-semibold';
                      }

                      return (
                        <td key={c.ugedag} className="py-2.5 px-3 text-center">
                          <span
                            className={`inline-flex items-center justify-center min-w-[36px] py-1 px-2 rounded-lg text-xs ${celleKlasse}`}
                            title={
                              c.er_hviledag
                                ? `Hviledag (${c.planlagte_lektioner} lekt.)`
                                : `${c.planlagte_lektioner} af max ${c.max_lektioner_dag} lektioner`
                            }
                          >
                            {c.er_hviledag && c.planlagte_lektioner === 0
                              ? 'Hvile'
                              : `${c.planlagte_lektioner}/${c.max_lektioner_dag}`}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

