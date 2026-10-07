import React, { useEffect, useState } from 'react';
import type { DashboardNoegletalSvar, HestBelastningCelle } from '@ridecenter/contracts';

export const DashboardSide: React.FC = () => {
  const [data, setData] = useState<DashboardNoegletalSvar | null>(null);
  const [indlaeser, setIndlaeser] = useState(true);
  const [fejl, setFejl] = useState<string | null>(null);

  const hentData = async () => {
    try {
      const res = await fetch('/api/v1/dashboard/noegletal');
      if (res.ok) {
        const d = await res.json();
        setData(d);
      } else {
        const err = await res.json().catch(() => ({}));
        setFejl(err.besked ?? 'Kunne ikke hente dashboard nøgletal');
      }
    } catch (err: any) {
      setFejl(err?.message ?? 'Fejl ved hentning af nøgletal');
    } finally {
      setIndlaeser(false);
    }
  };

  useEffect(() => {
    hentData();

    // SSE-lytter for live opdateringer (US4, T165)
    try {
      const es = new EventSource('/api/v1/events');
      es.addEventListener('plads.opdateret', () => hentData());
      es.addEventListener('hest.status', () => hentData());
      es.addEventListener('lektioner.publiceret', () => hentData());
      return () => es.close();
    } catch {
      // ignore
    }
  }, []);

  if (indlaeser) {
    return (
      <div className="flex items-center justify-center min-h-[300px] text-stone-500">
        Indlæser ledelsesoverblik...
      </div>
    );
  }

  // Gruppér heatmap celler efter hest_id
  const hesteRækker: Record<string, { hestNavn: string; celler: HestBelastningCelle[] }> = {};
  if (data?.hest_belastningsfordeling) {
    for (const c of data.hest_belastningsfordeling) {
      if (!hesteRækker[c.hest_id]) {
        hesteRækker[c.hest_id] = { hestNavn: c.hest_navn, celler: [] };
      }
      hesteRækker[c.hest_id]!.celler.push(c);
    }
  }

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

      {/* KPI KORT (4 nøgletal) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-white border border-stone-200 p-5 shadow-sm">
          <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
            Holdudnyttelse
          </span>
          <div className="text-3xl font-extrabold text-stone-900 mt-1">
            {data?.ugentlig_holdudnyttelse_procent ?? 0}%
          </div>
          <span className="text-xs text-stone-400 mt-1 block">Tilmeldte vs. max kapacitet</span>
        </div>

        <div className="rounded-2xl bg-white border border-stone-200 p-5 shadow-sm">
          <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
            Heste ude af drift
          </span>
          <div
            className={`text-3xl font-extrabold mt-1 ${
              (data?.antal_heste_ude_af_drift ?? 0) > 0 ? 'text-amber-600' : 'text-stone-900'
            }`}
          >
            {data?.antal_heste_ude_af_drift ?? 0}
          </div>
          <span className="text-xs text-stone-400 mt-1 block">Sygemeldt, skadet el. karantæne</span>
        </div>

        <div className="rounded-2xl bg-white border border-stone-200 p-5 shadow-sm">
          <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
            Ventelisteforslag
          </span>
          <div
            className={`text-3xl font-extrabold mt-1 ${
              (data?.afventende_ventelisteforslag ?? 0) > 0 ? 'text-sky-600' : 'text-stone-900'
            }`}
          >
            {data?.afventende_ventelisteforslag ?? 0}
          </div>
          <span className="text-xs text-stone-400 mt-1 block">Afventer manuel godkendelse</span>
        </div>

        <div className="rounded-2xl bg-white border border-stone-200 p-5 shadow-sm">
          <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
            Aktive vikarkoder
          </span>
          <div className="text-3xl font-extrabold text-stone-900 mt-1">
            {data?.aktive_vikarkoder ?? 0}
          </div>
          <span className="text-xs text-stone-400 mt-1 block">Gyldige 6-cifrede engangskoder</span>
        </div>
      </div>

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
        <div className="p-5 border-b border-stone-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-stone-900">
              Hesteflådens belastningsfordeling (Heatmap)
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Planlagte lektioner pr. ugedag sammenholdt med hestens daglige max-grænse og hviledag.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto p-4">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-stone-200 text-stone-500 uppercase">
                <th className="py-2.5 px-3 font-semibold">Hest</th>
                {['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'].map((dag) => (
                  <th key={dag} className="py-2.5 px-3 text-center font-semibold">
                    {dag}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {Object.values(hesteRækker).map((r) => (
                <tr key={r.hestNavn} className="hover:bg-stone-50">
                  <td className="py-2.5 px-3 font-medium text-stone-900">{r.hestNavn}</td>
                  {r.celler.map((c) => {
                    let celleKlasse = 'bg-stone-50 text-stone-400';
                    if (c.er_hviledag) {
                      celleKlasse = c.planlagte_lektioner > 0
                        ? 'bg-rose-100 text-rose-800 font-bold ring-1 ring-rose-400'
                        : 'bg-stone-100 text-stone-400 italic';
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
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

