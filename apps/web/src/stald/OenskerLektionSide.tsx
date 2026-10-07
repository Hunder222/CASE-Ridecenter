import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { db, type LokalHest, type LokalLektion, type LokalPlads } from '../offline/dexie-db';
import { syncMotor } from '../offline/sync-motor';

export function OenskerLektionSide() {
  const { lektionId } = useParams<{ lektionId: string }>();
  const navigate = useNavigate();

  const [lektion, setLektion] = useState<LokalLektion | null>(null);
  const [pladser, setPladser] = useState<LokalPlads[]>([]);
  const [heste, setHeste] = useState<LokalHest[]>([]);
  const [valgtPladsId, setValgtPladsId] = useState<string | null>(null);
  const [oensker, setOensker] = useState<string[]>([]); // hest_id'er
  const [gemtStatus, setGemtStatus] = useState<string | null>(null);
  const [indlaeser, setIndlaeser] = useState(true);

  // Måneden der ønskes for (næste måned YYYY-MM)
  const naesteMaanedStr = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  })();

  useEffect(() => {
    async function indlaes() {
      if (!lektionId) return;
      try {
        const l = await db.lektioner.get(lektionId);
        const p = await db.pladser.where('lektionId').equals(lektionId).toArray();
        const h = await db.heste.toArray();

        if (l) setLektion(l);
        setPladser(p);
        setHeste(h.filter((hest) => hest.sundhedsstatus === 'Aktiv'));

        if (p.length > 0 && !valgtPladsId && p[0]) {
          setValgtPladsId(p[0].id);
        }
      } catch (err) {
        console.error('Fejl ved indlæsning af stald-ønsker:', err);
      } finally {
        setIndlaeser(false);
      }
    }
    indlaes();
  }, [lektionId]);

  const valgtPlads = pladser.find((p) => p.id === valgtPladsId);

  // Filtrér heste til kun de heste, der er godkendt til rytteren (R6)
  const tilgaengeligeHeste = heste.filter((h) => {
    if (!valgtPlads?.godkendteHeste || valgtPlads.godkendteHeste.length === 0) {
      return true;
    }
    return valgtPlads.godkendteHeste.includes(h.id);
  });

  const toggleHestOenske = (hestId: string) => {
    setGemtStatus(null);
    if (oensker.includes(hestId)) {
      setOensker(oensker.filter((id) => id !== hestId));
    } else {
      if (oensker.length >= 3) {
        // Erstat 3. ønske eller roter
        setOensker([...oensker.slice(0, 2), hestId]);
      } else {
        setOensker([...oensker, hestId]);
      }
    }
  };

  const haandterGemOensker = async () => {
    if (!valgtPlads || oensker.length === 0) return;

    const kommandoId = crypto.randomUUID();
    const klientTidspunkt = new Date().toISOString();
    const brugerStr = localStorage.getItem('ridecenter_bruger');
    let brugerId: string | null = null;
    if (brugerStr) {
      try {
        brugerId = JSON.parse(brugerStr).id;
      } catch {
        // ignore
      }
    }

    // Gem i Dexie outbox
    await db.outbox.add({
      kommandoId,
      type: 'RegistrerOensker',
      klientTidspunkt,
      brugerId,
      payload: {
        rytter_id: valgtPlads.rytterId,
        maaned: naesteMaanedStr,
        hest_ids: oensker,
      },
      sendtStatus: 'afventer',
    });

    syncMotor.planlaegSync();

    setGemtStatus(`Ønsker gemt for ${valgtPlads.rytterNavnKort ?? 'rytter'} til ${naesteMaanedStr}!`);
    setTimeout(() => setGemtStatus(null), 3000);
  };

  if (indlaeser) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-slate-400 font-medium animate-pulse">Indlæser heste og ryttere...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(`/stald/lektion/${lektionId}`)}
          className="min-h-[48px] px-4 rounded-xl bg-slate-800 text-slate-300 hover:text-white border border-slate-700 font-medium flex items-center gap-2"
        >
          ← Tilbage til lektion
        </button>
        <span className="text-sm font-semibold text-sky-400 bg-sky-950/60 border border-sky-800 px-3 py-1.5 rounded-full">
          Ønsker til {naesteMaanedStr}
        </span>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-white">Elevønsker (Sidste time i måneden)</h1>
        <p className="text-sm text-slate-400 mt-1">
          Vælg elev og markér op til 3 hesteønsker sammen med rytteren.
        </p>
      </div>

      {/* Ryttervælger fliser */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
          Vælg elev på holdet
        </label>
        <div className="flex flex-wrap gap-2">
          {pladser.map((p) => {
            const erValgt = p.id === valgtPladsId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setValgtPladsId(p.id);
                  setOensker([]);
                  setGemtStatus(null);
                }}
                className={`min-h-[48px] px-4 rounded-xl font-semibold text-sm transition-all border ${
                  erValgt
                    ? 'border-sky-500 bg-sky-950/80 text-sky-200 ring-2 ring-sky-400'
                    : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700'
                }`}
              >
                {p.rytterNavnKort ?? 'Rytter'}
              </button>
            );
          })}
        </div>
      </div>

      {/* Valgte ønsker overblik */}
      {valgtPlads && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">
              Hesteønsker for {valgtPlads.rytterNavnKort} ({oensker.length}/3 valgt)
            </h2>
            <button
              type="button"
              onClick={haandterGemOensker}
              disabled={oensker.length === 0}
              className="min-h-[48px] px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm shadow-lg shadow-emerald-950/50"
            >
              Gem ønsker
            </button>
          </div>

          {gemtStatus && (
            <p className="text-sm font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800 p-3 rounded-xl animate-in fade-in">
              {gemtStatus}
            </p>
          )}

          {/* Hestefliser (kun egnede heste, store touch fliser) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
            {tilgaengeligeHeste.map((hest) => {
              const oenskeNr = oensker.indexOf(hest.id);
              const erValgt = oenskeNr !== -1;

              return (
                <button
                  key={hest.id}
                  type="button"
                  onClick={() => toggleHestOenske(hest.id)}
                  className={`min-h-[80px] p-4 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                    erValgt
                      ? 'border-emerald-500 bg-emerald-950/60 ring-2 ring-emerald-400'
                      : 'border-slate-800 bg-slate-850 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-white">{hest.navn}</span>
                    {erValgt && (
                      <span className="w-7 h-7 rounded-full bg-emerald-500 text-white font-bold text-xs flex items-center justify-center">
                        {oenskeNr + 1}.
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 mt-2 flex items-center justify-between">
                    <span>{hest.temperament ?? 'Rolig'}</span>
                    <span>{hest.stangmaal_cm} cm</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
