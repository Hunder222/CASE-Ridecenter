import React, { useState } from 'react';
import type { AuditVerificerSvar } from '@ridecenter/contracts';

export const AuditSide: React.FC = () => {
  const [verificerer, setVerificerer] = useState(false);
  const [resultat, setResultat] = useState<AuditVerificerSvar | null>(null);
  const [fejl, setFejl] = useState<string | null>(null);

  const haandterVerificer = async () => {
    setVerificerer(true);
    setFejl(null);
    setResultat(null);

    try {
      const res = await fetch('/api/v1/audit/verificer', {
        method: 'POST',
      });
      if (res.ok) {
        const data: AuditVerificerSvar = await res.json();
        setResultat(data);
      } else {
        const err = await res.json().catch(() => ({}));
        setFejl(err.besked ?? 'Fejl ved verifikation af hashkæde');
      }
    } catch (err: any) {
      setFejl(err?.message ?? 'Fejl ved hashkæde-tjek');
    } finally {
      setVerificerer(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Revisionsspor &amp; Hashkæde</h1>
          <p className="text-sm text-stone-500 mt-1">
            Uforanderligt kryptografisk revisionsspor for alle hændelser i systemet (Princip III, FR-019).
          </p>
        </div>
        <button
          type="button"
          onClick={haandterVerificer}
          disabled={verificerer}
          className="min-h-[48px] px-6 rounded-xl bg-emerald-700 hover:bg-emerald-650 active:bg-emerald-800 text-white font-bold text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
        >
          {verificerer ? 'Verificerer kæde...' : '🔒 Verificér hashkæde'}
        </button>
      </div>

      {fejl && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          {fejl}
        </div>
      )}

      {/* VERIFIKATIONS RESULTAT */}
      {resultat && (
        <div
          className={`rounded-2xl border p-6 space-y-3 shadow-sm ${
            resultat.gyldig
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-rose-50 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-xl">{resultat.gyldig ? '✅' : '❌'}</span>
            <h2
              className={`text-lg font-bold ${
                resultat.gyldig ? 'text-emerald-900' : 'text-rose-900'
              }`}
            >
              {resultat.gyldig
                ? 'Hashkæde fuldstændig intakt og verificeret'
                : `Integritetsbrud fundet ved hændelse #${resultat.brud_ved_seq}`}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-xs">
            <div className="p-3 bg-white/80 rounded-xl border border-stone-200">
              <span className="text-stone-500 font-semibold block mb-0.5">Antal verificerede hændelser:</span>
              <span className="text-lg font-bold text-stone-900">{resultat.antal_haendelser}</span>
            </div>
            <div className="p-3 bg-white/80 rounded-xl border border-stone-200">
              <span className="text-stone-500 font-semibold block mb-0.5">Seneste kædehash:</span>
              <span className="font-mono text-stone-800 break-all select-all">{resultat.seneste_hash}</span>
            </div>
          </div>
        </div>
      )}

      {/* OPLYSNINGSBOKS OM KÆDEN */}
      <div className="rounded-2xl bg-white border border-stone-200 p-6 space-y-3 shadow-sm text-sm text-stone-700">
        <h3 className="font-bold text-stone-900">Hvordan virker hashkæden?</h3>
        <p className="text-xs text-stone-600 leading-relaxed">
          Hver hændelse i systemet hashes kryptografisk sammen med den forrige hændelses hash:
          <code className="mx-1 px-1.5 py-0.5 rounded bg-stone-100 font-mono text-stone-800">
            hash = SHA-256(forrige_hash ‖ kanonisk_json(indhold))
          </code>
          . Hvis en enkelt række slettes eller ændres direkte i databasen, brydes hele hashkæden øjeblikkeligt, og verifikationsknappen ovenfor vil rapportere det nøjagtige brudsted.
        </p>
      </div>
    </div>
  );
};

