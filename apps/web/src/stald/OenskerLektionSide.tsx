import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { db, type LokalHest, type LokalLektion, type LokalPlads } from '../offline/dexie-db';
import { syncMotor } from '../offline/sync-motor';

interface ElevMatrixData {
  rytterId: string;
  rytterNavnKort: string;
  niveau: string;
  holdnavn: string;
  erSpringhold?: boolean;
  ugedag?: number;
  godkendteHeste: string[];
  oensker: string[]; // hest_id'er (prioritet 1, 2, 3)
  harPartaftale?: boolean;
  partaftaleHestId?: string | null;
}

function normaliserNiveau(niveau: string): string {
  const n = (niveau ?? '').toLowerCase();
  if (n.includes('traek') || n.includes('træk')) return 'Trækhold';
  if (n.includes('begynder')) return 'Begynder';
  if (n.includes('letoevet') || n.includes('letøvet')) return 'Letøvet';
  if (n.includes('oevet') || n.includes('øvet')) return 'Øvet';
  if (n.includes('part')) return 'Parthold';
  return niveau;
}

function evaluerHestEgnethed(
  hest: LokalHest,
  elev: ElevMatrixData
): { egnet: boolean; aarsag?: string } {
  if (hest.sundhedsstatus && hest.sundhedsstatus !== 'Aktiv') {
    return { egnet: false, aarsag: `Hesten er pt. ${hest.sundhedsstatus.toLowerCase()}` };
  }
  if (elev.erSpringhold && (hest.springforbud || (hest.max_spring_uge ?? 0) <= 0)) {
    return { egnet: false, aarsag: 'Må ikke springe' };
  }
  if (elev.ugedag && hest.hviledag === elev.ugedag) {
    return { egnet: false, aarsag: 'Hviledag på holdets ugedag' };
  }
  if (elev.niveau === 'Begynder' && !hest.godkendt_til_begyndere) {
    return { egnet: false, aarsag: 'Ikke godkendt til begyndere' };
  }
  if (elev.niveau === 'Øvet' && hest.egnet_oevet === false) {
    return { egnet: false, aarsag: 'Ikke egnet til øvede' };
  }
  if (elev.godkendteHeste && elev.godkendteHeste.length > 0 && !elev.godkendteHeste.includes(hest.id)) {
    return { egnet: false, aarsag: '⚠️ rytter fysiologi' };
  }
  return { egnet: true };
}

export function OenskerLektionSide() {
  const { lektionId } = useParams<{ lektionId?: string }>();
  const navigate = useNavigate();

  const [elever, setElever] = useState<ElevMatrixData[]>([]);
  const [heste, setHeste] = useState<LokalHest[]>([]);
  const [hesteMap, setHesteMap] = useState<Map<string, LokalHest>>(new Map());
  const [indlaeser, setIndlaeser] = useState(true);

  // Filter & Søgning
  const [filterNiveau, setFilterNiveau] = useState<string>('Alle');
  const [filterStatus, setFilterStatus] = useState<'Alle' | 'Mangler' | 'Delvist' | 'Klar' | 'Partaftale'>('Alle');
  const [soeg, setSoeg] = useState<string>('');

  // Aktiv elev der redigeres i modal
  const [redigerElev, setRedigerElev] = useState<ElevMatrixData | null>(null);
  const [valgteOensker, setValgteOensker] = useState<string[]>([]);
  const [gemtStatus, setGemtStatus] = useState<string | null>(null);

  // Måneden der ønskes for (næste måned YYYY-MM)
  const naesteMaanedStr = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  })();

  const indlaesAlt = async () => {
    setIndlaeser(true);
    try {
      // 1. Hent heste
      let h = await db.heste.toArray();
      if (h.length === 0 || h.some((hest) => hest.godkendt_til_begyndere === undefined || hest.skaane === undefined)) {
        try {
          const hRes = await fetch('/api/v1/heste');
          if (hRes.ok) {
            const hData = await hRes.json();
            h = hData.map((x: any) => ({
              id: x.id,
              navn: x.navn,
              stangmaal_cm: x.stangmaal_cm,
              sundhedsstatus: x.sundhedsstatus,
              temperament: x.temperament,
              godkendt_til_begyndere: x.godkendt_til_begyndere ?? x.godkendtTilBegyndere ?? false,
              egnet_oevet: x.egnet_oevet ?? x.egnetOevet ?? true,
              skaane: x.skaane ?? false,
              springforbud: x.springforbud ?? false,
              max_spring_uge: x.max_spring_uge ?? 0,
              staldnoter: x.staldnoter ?? '',
              hviledag: x.hviledag,
              max_lektioner_dag: x.max_lektioner_dag,
            }));
            await db.heste.bulkPut(h);
          }
        } catch {}
      }
      setHeste(h.filter((hest) => hest.sundhedsstatus === 'Aktiv'));
      setHesteMap(new Map(h.map((x) => [x.id, x])));

      // 2. Hent lektioner & pladser
      let lektioner = await db.lektioner.toArray();
      let pladser = await db.pladser.toArray();

      // Hvis tomt eller mangler rytternavne, indlæs fra serveren
      if (pladser.length === 0 || pladser.some((p) => !p.rytterNavnKort)) {
        const iDagStr = new Date().toISOString().slice(0, 10);
        const enhedNoegle = localStorage.getItem('ridecenter_enhedsnoegle') ?? 'demo-enhedsnoegle-stald-tablet-1';
        try {
          const res = await fetch(`/api/v1/stald/dag/${iDagStr}`, {
            headers: { 'X-Enhed-Noegle': enhedNoegle },
          });
          if (res.ok) {
            const dagData = await res.json();
            if (dagData.lektioner) {
              const nyL = dagData.lektioner.map((l: any) => ({
                id: l.id,
                dato: l.dato,
                holdId: l.hold_id,
                holdnavn: l.holdnavn,
                starttid: l.starttid,
                niveau: l.niveau,
                erSpringhold: l.er_springhold,
                fremmoedeLukket: l.fremmoede_lukket,
              }));
              const nyP: LokalPlads[] = [];
              for (const l of dagData.lektioner) {
                for (const pl of l.pladser ?? []) {
                  nyP.push({
                    id: pl.id,
                    lektionId: l.id,
                    rytterId: pl.id,
                    rytterNavnKort: pl.rytter_navn_kort,
                    aktuelHestId: pl.aktuel_hest_id,
                    planlagtHestId: pl.planlagt_hest_id,
                    status: pl.afledt_status,
                    godkendteHeste: pl.godkendte_heste,
                    cheatSheetKoder: pl.cheat_sheet_koder,
                    adfaerdsinstruks: pl.adfaerdsinstruks,
                    har_partaftale: pl.har_partaftale,
                    partaftale_hest_id: pl.partaftale_hest_id,
                  });
                }
              }
              await db.lektioner.bulkPut(nyL);
              await db.pladser.bulkPut(nyP);
              lektioner = nyL;
              pladser = nyP;
            }
          }
        } catch {}
      }

      // 3. Hent eksisterende ønsker for næste måned
      const oenskerMap = new Map<string, string[]>();

      // Fra serveren
      try {
        const res = await fetch(`/api/v1/stald/oensker/${naesteMaanedStr}`);
        if (res.ok) {
          const data: Array<{ rytter_id: string; prioritet: number; oensket_hest_id: string }> = await res.json();
          for (const o of data) {
            const eks = oenskerMap.get(o.rytter_id) ?? [];
            eks[o.prioritet - 1] = o.oensket_hest_id;
            oenskerMap.set(o.rytter_id, eks);
          }
        }
      } catch {}

      // Fra Dexie outbox
      try {
        const outbox = await db.outbox.where('type').equals('RegistrerOensker').toArray();
        for (const post of outbox) {
          if (post.payload?.maaned === naesteMaanedStr && post.payload.rytter_id) {
            oenskerMap.set(post.payload.rytter_id, post.payload.hest_ids ?? []);
          }
        }
      } catch {}

      // 4. Byg matrixliste pr. unik rytter
      const lektionMap = new Map(lektioner.map((l) => [l.id, l]));
      const ryttereMap = new Map<string, ElevMatrixData>();

      for (const p of pladser) {
        if (ryttereMap.has(p.rytterId)) continue;
        const l = lektionMap.get(p.lektionId);
        const råNiveau = l?.niveau ?? 'Letoevet';
        const niveau = normaliserNiveau(råNiveau);
        const holdnavn = l?.holdnavn ?? 'Hold';
        const oensker = (oenskerMap.get(p.rytterId) ?? []).filter(Boolean);

        const holdNavnLower = (l?.holdnavn ?? '').toLowerCase();
        let ugedag = 0;
        if (holdNavnLower.includes('mandag')) ugedag = 1;
        else if (holdNavnLower.includes('tirsdag')) ugedag = 2;
        else if (holdNavnLower.includes('onsdag')) ugedag = 3;
        else if (holdNavnLower.includes('torsdag')) ugedag = 4;
        else if (holdNavnLower.includes('fredag')) ugedag = 5;
        else if (holdNavnLower.includes('lørdag') || holdNavnLower.includes('loerdag')) ugedag = 6;
        else if (holdNavnLower.includes('søndag') || holdNavnLower.includes('soendag')) ugedag = 7;
        else if (l?.dato) {
          const d = new Date(l.dato);
          ugedag = d.getDay() === 0 ? 7 : d.getDay();
        }

        const erSpringhold = Boolean(l?.erSpringhold || holdNavnLower.includes('spring'));

        ryttereMap.set(p.rytterId, {
          rytterId: p.rytterId,
          rytterNavnKort: p.rytterNavnKort ?? 'Rytter',
          niveau,
          holdnavn,
          erSpringhold,
          ugedag,
          godkendteHeste: p.godkendteHeste ?? [],
          oensker,
          harPartaftale: Boolean(p.har_partaftale || p.partaftale_hest_id),
          partaftaleHestId: p.partaftale_hest_id ?? null,
        });
      }

      const liste = Array.from(ryttereMap.values()).sort((a, b) =>
        a.rytterNavnKort.localeCompare(b.rytterNavnKort, 'da')
      );
      setElever(liste);
    } catch (err) {
      console.error('Fejl ved indlæsning af elevønsker:', err);
    } finally {
      setIndlaeser(false);
    }
  };

  useEffect(() => {
    indlaesAlt();
  }, [lektionId]);

  // Åbn redigering af en elev
  const aabnRedigering = (elev: ElevMatrixData) => {
    setRedigerElev(elev);
    setValgteOensker([...elev.oensker]);
    setGemtStatus(null);
  };

  // Gruppering af heste for den elev, der redigeres i modal
  const { egnedeHeste, ikkeEgnedeHeste } = useMemo(() => {
    if (!redigerElev) return { egnedeHeste: [], ikkeEgnedeHeste: [] };
    const egnede: Array<{ hest: LokalHest }> = [];
    const ikkeEgnede: Array<{ hest: LokalHest; aarsag?: string }> = [];

    for (const h of heste) {
      // Hvis elev skal ønske til springhold, vises kun heste der må springe
      if (redigerElev.erSpringhold && (h.springforbud || (h.max_spring_uge ?? 0) <= 0)) {
        continue;
      }
      // Giv aldrig mulighed for at ønske en hest, der har hviledag på samme ugedag man har tildelt hold
      if (redigerElev.ugedag && h.hviledag === redigerElev.ugedag) {
        continue;
      }
      const res = evaluerHestEgnethed(h, redigerElev);
      if (res.egnet) {
        egnede.push({ hest: h });
      } else {
        ikkeEgnede.push({ hest: h, aarsag: res.aarsag });
      }
    }

    egnede.sort((a, b) => a.hest.navn.localeCompare(b.hest.navn, 'da'));
    ikkeEgnede.sort((a, b) => a.hest.navn.localeCompare(b.hest.navn, 'da'));

    return { egnedeHeste: egnede, ikkeEgnedeHeste: ikkeEgnede };
  }, [heste, redigerElev]);

  const toggleHestOenske = (hestId: string) => {
    const valgtHest = hesteMap.get(hestId);
    if (valgtHest && redigerElev?.ugedag && valgtHest.hviledag === redigerElev.ugedag) {
      alert('Denne hest har hviledag på holdets ugedag og kan ikke ønskes.');
      return;
    }
    if (valgtHest && redigerElev?.erSpringhold && (valgtHest.springforbud || (valgtHest.max_spring_uge ?? 0) <= 0)) {
      alert('Denne hest må ikke springe og kan ikke vælges til et springhold.');
      return;
    }
    if (valgteOensker.includes(hestId)) {
      setValgteOensker(valgteOensker.filter((id) => id !== hestId));
    } else {
      if (valgteOensker.length >= 3) {
        setValgteOensker([...valgteOensker.slice(0, 2), hestId]);
      } else {
        setValgteOensker([...valgteOensker, hestId]);
      }
    }
  };

  const gemOenskerForElev = async (elev: ElevMatrixData, nyeOensker: string[]) => {
    const kommandoId = crypto.randomUUID();
    const klientTidspunkt = new Date().toISOString();
    const brugerStr = localStorage.getItem('ridecenter_bruger');
    let brugerId: string | null = null;
    if (brugerStr) {
      try {
        brugerId = JSON.parse(brugerStr).id;
      } catch {}
    }
    if (!brugerId) {
      const foersteBruger = await db.brugere.toCollection().first();
      brugerId = foersteBruger?.id ?? null;
    }

    // 1. Gem i Dexie outbox
    await db.outbox.add({
      kommandoId,
      type: 'RegistrerOensker',
      klientTidspunkt,
      brugerId,
      payload: {
        rytter_id: elev.rytterId,
        maaned: naesteMaanedStr,
        hest_ids: nyeOensker,
      },
      sendtStatus: 'afventer',
    });

    // 2. Opdatér lokal matrix-state med det samme (feltet skifter straks farve)
    setElever((prev) =>
      prev.map((e) => (e.rytterId === elev.rytterId ? { ...e, oensker: [...nyeOensker] } : e))
    );

    syncMotor.planlaegSync();

    // Forsøg også direkte API batch gem
    try {
      await fetch('/api/v1/oensker/stald/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rytter_id: elev.rytterId,
          maaned: naesteMaanedStr,
          oensker: nyeOensker.map((hestId, index) => ({
            oensket_hest_id: hestId,
            prioritet: index + 1,
          })),
        }),
      });
    } catch {}

    const besked =
      nyeOensker.length === 0
        ? `✓ Ønsker ryddet for ${elev.rytterNavnKort}!`
        : `✓ ${nyeOensker.length} af 3 ønsker gemt for ${elev.rytterNavnKort}!`;
    setGemtStatus(besked);
    setTimeout(() => {
      setGemtStatus(null);
      setRedigerElev(null);
    }, 1200);
  };

  const haandterGemOensker = async () => {
    if (!redigerElev) return;
    await gemOenskerForElev(redigerElev, valgteOensker);
  };

  const haandterRydOensker = async () => {
    if (!redigerElev) return;
    setValgteOensker([]);
    await gemOenskerForElev(redigerElev, []);
  };

  // Filtrering af elever til matrixen
  const filtreredeElever = elever.filter((e) => {
    if (filterNiveau !== 'Alle' && e.niveau !== filterNiveau) return false;
    if (filterStatus === 'Partaftale' && !e.harPartaftale) return false;
    if (filterStatus === 'Mangler' && (e.harPartaftale || e.oensker.length > 0)) return false;
    if (filterStatus === 'Delvist' && (e.harPartaftale || e.oensker.length === 0 || e.oensker.length === 3)) return false;
    if (filterStatus === 'Klar' && (e.harPartaftale || e.oensker.length < 3)) return false;
    if (soeg.trim() && !e.rytterNavnKort.toLowerCase().includes(soeg.toLowerCase())) return false;
    return true;
  });

  // Gruppér elever pr. niveau
  const niveauer = ['Trækhold', 'Begynder', 'Letøvet', 'Øvet', 'Parthold'];
  const eleverPrNiveau = niveauer.map((niv) => ({
    niveau: niv,
    elever: filtreredeElever.filter((e) => e.niveau === niv),
  }));

  // Tilføj eventuelle øvrige niveauer hvis de findes
  const oevrigeNiveauer = Array.from(new Set(filtreredeElever.map((e) => e.niveau))).filter(
    (niv) => !niveauer.includes(niv)
  );
  for (const niv of oevrigeNiveauer) {
    eleverPrNiveau.push({
      niveau: niv,
      elever: filtreredeElever.filter((e) => e.niveau === niv),
    });
  }

  // Statistik (elever med partaftale tælles særskilt og ekskluderes fra 'Mangler')
  const totalElever = elever.length;
  const eleverUdenPart = elever.filter((e) => !e.harPartaftale);
  const antalPart = elever.filter((e) => e.harPartaftale).length;
  const antalKlar = eleverUdenPart.filter((e) => e.oensker.length === 3).length;
  const antalDelvist = eleverUdenPart.filter((e) => e.oensker.length > 0 && e.oensker.length < 3).length;
  const antalMangler = eleverUdenPart.filter((e) => e.oensker.length === 0).length;
  const procentKlar = eleverUdenPart.length > 0 ? Math.round((antalKlar / eleverUdenPart.length) * 100) : 0;

  if (indlaeser) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-slate-400 font-medium animate-pulse">Indlæser elevønsker og niveauer...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      {/* Topbar navigation & Månedsindikator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <span>⭐ Elevønsker</span>
            <span className="text-sm font-semibold px-3 py-1 rounded-full bg-sky-950 text-sky-300 border border-sky-800">
              Måned: {naesteMaanedStr}
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Samlet elevmatrix grupperet efter niveau. Grønne felter har afgivet 3 ønsker, gule felter mangler.
          </p>
        </div>

        <button
          type="button"
          onClick={indlaesAlt}
          className="min-h-[44px] px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 text-sm font-semibold transition cursor-pointer self-start sm:self-auto flex items-center gap-2"
        >
          <span>🔄</span>
          <span>Opdater</span>
        </button>
      </div>

      {/* Statusbar & Nøgletal */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-lg flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="space-y-1.5 flex-1">
          <div className="flex items-center justify-between text-sm font-semibold">
            <span className="text-slate-300">Status på ønsker for {naesteMaanedStr}</span>
            <span className="text-sky-400 font-bold">{antalKlar} af {totalElever} klar ({procentKlar}%)</span>
          </div>
          <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden flex border border-slate-700/60">
            <div
              className="bg-emerald-500 transition-all duration-500 rounded-full"
              style={{ width: `${procentKlar}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setFilterStatus('Alle')}
            className={`min-h-[48px] px-4 rounded-xl text-xs sm:text-sm font-bold border transition cursor-pointer flex items-center justify-center ${
              filterStatus === 'Alle'
                ? 'bg-slate-700 text-white border-slate-600 shadow'
                : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            Alle ({totalElever})
          </button>
          {antalPart > 0 && (
            <button
              type="button"
              onClick={() => setFilterStatus('Partaftale')}
              className={`min-h-[48px] px-4 rounded-xl text-xs sm:text-sm font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                filterStatus === 'Partaftale'
                  ? 'bg-blue-600 text-white border-blue-500 shadow'
                  : 'bg-blue-950/40 text-blue-300 border-blue-800/80 hover:bg-blue-950/60'
              }`}
            >
              <span>Partaftale ({antalPart})</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setFilterStatus('Mangler')}
            className={`min-h-[48px] px-4 rounded-xl text-xs sm:text-sm font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
              filterStatus === 'Mangler'
                ? 'bg-rose-600 text-white border-rose-500 shadow'
                : 'bg-rose-950/40 text-rose-300 border-rose-800/80 hover:bg-rose-950/60'
            }`}
          >
            <span>⛔ Mangler ({antalMangler})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('Delvist')}
            className={`min-h-[48px] px-4 rounded-xl text-xs sm:text-sm font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
              filterStatus === 'Delvist'
                ? 'bg-amber-600 text-white border-amber-500 shadow'
                : 'bg-amber-950/40 text-amber-300 border-amber-800/80 hover:bg-amber-950/60'
            }`}
          >
            <span>⚠️ Mangler delvist ({antalDelvist})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('Klar')}
            className={`min-h-[48px] px-4 rounded-xl text-xs sm:text-sm font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
              filterStatus === 'Klar'
                ? 'bg-emerald-600 text-white border-emerald-500 shadow'
                : 'bg-emerald-950/40 text-emerald-300 border-emerald-800/80 hover:bg-emerald-950/60'
            }`}
          >
            <span>✓ Klar ({antalKlar})</span>
          </button>
        </div>
      </div>

      {/* Filter og søgning bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setFilterNiveau('Alle')}
            className={`min-h-[44px] px-4 rounded-xl text-xs sm:text-sm font-semibold border transition cursor-pointer shrink-0 flex items-center justify-center ${
              filterNiveau === 'Alle'
                ? 'bg-sky-600 text-white border-sky-400 shadow'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
            }`}
          >
            Alle niveauer
          </button>
          {niveauer.map((niv) => (
            <button
              key={niv}
              type="button"
              onClick={() => setFilterNiveau(niv)}
              className={`min-h-[44px] px-4 rounded-xl text-xs sm:text-sm font-semibold border transition cursor-pointer shrink-0 flex items-center justify-center ${
                filterNiveau === niv
                  ? 'bg-sky-600 text-white border-sky-400 shadow'
                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
              }`}
            >
              {niv}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={soeg}
          onChange={(e) => setSoeg(e.target.value)}
          placeholder="🔍 Søg elev..."
          className="w-full sm:w-64 min-h-[42px] px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
      </div>

      {/* MATRIX GRUPPERET EFTER NIVEAU */}
      <div className="space-y-8">
        {eleverPrNiveau.map(({ niveau, elever: niveauElever }) => {
          if (filterNiveau !== 'Alle' && niveau !== filterNiveau) return null;
          if (niveauElever.length === 0) return null;

          const klarCount = niveauElever.filter((e) => !e.harPartaftale && e.oensker.length === 3).length;

          return (
            <section key={niveau} className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-xl font-bold text-white">{niveau}</h2>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                    {niveauElever.length} elever
                  </span>
                </div>
                <span className="text-xs font-medium text-slate-400">
                  {klarCount} af {niveauElever.length} klar
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                {niveauElever.map((elev) => {
                  const erPart = !!elev.harPartaftale;
                  const harTreOensker = elev.oensker.length === 3;
                  const harDelvistOensker = elev.oensker.length > 0 && elev.oensker.length < 3;

                  return (
                    <button
                      key={elev.rytterId}
                      type="button"
                      onClick={() => aabnRedigering(elev)}
                      className={`text-left rounded-2xl border p-4 flex flex-col justify-between gap-3 transition-all active:scale-[0.98] cursor-pointer shadow-md ${
                        erPart
                          ? 'bg-blue-950/40 hover:bg-blue-950/60 border-blue-500/80 ring-1 ring-blue-500/30'
                          : harTreOensker
                          ? 'bg-emerald-950/40 hover:bg-emerald-950/60 border-emerald-500/80 ring-1 ring-emerald-500/30'
                          : harDelvistOensker
                          ? 'bg-amber-950/40 hover:bg-amber-950/60 border-amber-500/80 ring-1 ring-amber-500/30'
                          : 'bg-rose-950/40 hover:bg-rose-950/60 border-rose-500/80 ring-1 ring-rose-500/30'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-lg text-white truncate">
                            {elev.rytterNavnKort}
                          </span>
                          {erPart ? (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-900/90 text-blue-300 border border-blue-700 shrink-0">
                              Partaftale
                            </span>
                          ) : harTreOensker ? (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-900/90 text-emerald-300 border border-emerald-700 shrink-0">
                              ✓ 3/3 klar
                            </span>
                          ) : harDelvistOensker ? (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-900/90 text-amber-300 border border-amber-700 shrink-0">
                              ⚠️ Delvist ({elev.oensker.length}/3)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-900/90 text-rose-300 border border-rose-700 shrink-0">
                              ⛔ Mangler (0/3)
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-slate-400">
                          {elev.holdnavn}
                        </div>
                      </div>

                      <div className="pt-2.5 border-t border-slate-800/80">
                        {erPart ? (
                          <div className="text-xs text-blue-300 font-medium truncate">
                            Fast hest: {elev.partaftaleHestId ? (hesteMap.get(elev.partaftaleHestId)?.navn ?? 'Parthest') : 'Partaftale'}
                          </div>
                        ) : elev.oensker.length === 0 ? (
                          <div className="text-xs text-rose-300/80 italic flex items-center justify-between">
                            <span>Tryk for at vælge heste</span>
                            <span>+</span>
                          </div>
                        ) : (
                          <div className="text-xs font-medium flex flex-wrap items-center gap-1.5">
                            {elev.oensker.map((id, idx) => {
                              const h = hesteMap.get(id);
                              const egnethed = h ? evaluerHestEgnethed(h, elev) : { egnet: true };
                              const advarsel = !egnethed.egnet ? egnethed.aarsag : null;
                              return (
                                <span
                                  key={id}
                                  className={`inline-flex items-center gap-0.5 ${
                                    harTreOensker ? 'text-emerald-300' : 'text-amber-300'
                                  }`}
                                >
                                  <span>
                                    {idx + 1}. {h?.navn ?? 'Hest'}
                                  </span>
                                  {advarsel && (
                                    <span
                                      className="text-amber-400 font-bold cursor-help"
                                      title={`⚠️ ${advarsel}`}
                                      aria-label={advarsel}
                                    >
                                      ⚠️
                                    </span>
                                  )}
                                  {idx < elev.oensker.length - 1 && <span className="text-slate-500">•</span>}
                                </span>
                              );
                            })}
                            {!harTreOensker && (
                              <span className="text-amber-400/80 text-[11px] ml-0.5">
                                (mangler {3 - elev.oensker.length})
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {/* REDIGERINGS-MODAL FOR VALGT ELEV */}
      {redigerElev && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 flex items-start justify-between gap-4 bg-slate-900/95">
              <div>
                <span className="text-xs uppercase font-bold text-sky-400 tracking-wider">
                  Niveau: {redigerElev.niveau} • {redigerElev.holdnavn}
                </span>
                <h2 className="text-2xl font-bold text-white mt-0.5">
                  Hesteønsker for {redigerElev.rytterNavnKort}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Vælg op til 3 heste i prioriteret rækkefølge til måned {naesteMaanedStr}.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setRedigerElev(null)}
                className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white flex items-center justify-center font-bold text-lg cursor-pointer"
                title="Luk"
              >
                ✕
              </button>
            </div>

            {/* Valgte ønsker statuslinje */}
            <div className="px-6 py-4 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase text-slate-400">Valgte heste:</span>
                {valgteOensker.length === 0 ? (
                  <span className="text-xs text-amber-300 italic">Ingen heste valgt endnu</span>
                ) : (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {valgteOensker.map((hid, idx) => {
                      const h = hesteMap.get(hid);
                      const erEgnet = h ? evaluerHestEgnethed(h, redigerElev).egnet : true;
                      return (
                        <span
                          key={hid}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border ${
                            erEgnet
                              ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                              : 'bg-amber-950 text-amber-300 border-amber-700'
                          }`}
                        >
                          <span>
                            {idx + 1}. {h?.navn ?? 'Hest'}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleHestOenske(hid)}
                            className="hover:text-white cursor-pointer ml-0.5"
                          >
                            ✕
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                <span>{valgteOensker.length} af 3 valgt</span>
              </div>
            </div>

            {gemtStatus && (
              <div className="px-6 py-3 bg-emerald-950/80 border-b border-emerald-800 text-emerald-300 text-sm font-bold flex items-center gap-2">
                <span>✓</span>
                <span>{gemtStatus}</span>
              </div>
            )}

            {/* Hestevælger Grid (scrollable) - To sektioner */}
            <div className="flex-1 overflow-y-auto p-6 space-y-7">
              {/* SEKTION 1: Egnede heste (grønne, øverst) */}
              <section className="space-y-3">
                <div className="flex items-center justify-between border-b border-emerald-900/60 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-emerald-400 flex items-center gap-1.5">
                      <span>🟢</span> Egnede heste til {redigerElev.niveau}
                    </span>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                      {egnedeHeste.length}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 font-medium">
                    Godkendt til rytter og niveau
                  </span>
                </div>

                {egnedeHeste.length === 0 ? (
                  <p className="text-slate-500 text-sm italic py-2">
                    Ingen heste godkendt direkte til dette niveau.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {egnedeHeste.map(({ hest }) => {
                      const oenskeNr = valgteOensker.indexOf(hest.id);
                      const erValgt = oenskeNr !== -1;
                      const erBegynder = !!hest.godkendt_til_begyndere;
                      const erSpring = !hest.springforbud && (hest.max_spring_uge ?? 0) > 0;
                      const erSkaane = !!hest.skaane;

                      return (
                        <button
                          key={hest.id}
                          type="button"
                          onClick={() => toggleHestOenske(hest.id)}
                          className={`min-h-[110px] p-4 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                            erValgt
                              ? 'border-emerald-500 bg-emerald-950/80 ring-2 ring-emerald-400 shadow-md'
                              : 'border-emerald-900/50 bg-slate-850 hover:border-emerald-600/70 hover:bg-slate-800 text-slate-300'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-lg font-bold text-white">{hest.navn}</span>
                              {erValgt ? (
                                <span className="w-7 h-7 rounded-full bg-emerald-500 text-white font-bold text-xs flex items-center justify-center shadow">
                                  {oenskeNr + 1}.
                                </span>
                              ) : (
                                <span className="w-6 h-6 rounded-full border border-emerald-700/60 text-emerald-400 text-xs flex items-center justify-center">
                                  +
                                </span>
                              )}
                            </div>

                            {/* Relevante tags ift. kabalen */}
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {erBegynder && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800/80">
                                  👶 Begynderhest
                                </span>
                              )}
                              {erSpring && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-950 text-indigo-300 border border-indigo-800/80">
                                  🏇 Springhest
                                </span>
                              )}
                              {erSkaane && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-950 text-sky-300 border border-sky-800/80">
                                  🛡️ Skånehest
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="mt-3 space-y-1">
                            <div className="text-xs text-slate-400 flex items-center justify-between">
                              <span>{hest.temperament ?? 'Rolig'}</span>
                              <span>{hest.stangmaal_cm} cm</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                                <span>✓</span> Egnet til {redigerElev.niveau}
                              </span>
                              {redigerElev.niveau !== 'Begynder' && erBegynder && (
                                <span className="text-[10px] text-amber-400/90 block mt-0.5">
                                  💡Forbeholdt begynderhold
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* SEKTION 2: Ikke godkendte heste til niveau (nederst) */}
              <section className="space-y-3">
                <div className="flex items-center justify-between border-b border-amber-900/60 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-amber-400 flex items-center gap-1.5">
                      <span>⚠️</span> Ikke godkendte heste til niveau
                    </span>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800">
                      {ikkeEgnedeHeste.length}
                    </span>
                  </div>
                  <span className="text-xs text-amber-500/90 font-medium">
                    Kan vælges med dispensation
                  </span>
                </div>

                {ikkeEgnedeHeste.length === 0 ? (
                  <p className="text-slate-500 text-sm italic py-2">
                    Alle heste er godkendte til dette niveau.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {ikkeEgnedeHeste.map(({ hest, aarsag }) => {
                      const oenskeNr = valgteOensker.indexOf(hest.id);
                      const erValgt = oenskeNr !== -1;
                      const erBegynder = !!hest.godkendt_til_begyndere;
                      const erSpring = !hest.springforbud && (hest.max_spring_uge ?? 0) > 0;
                      const erSkaane = !!hest.skaane;

                      return (
                        <button
                          key={hest.id}
                          type="button"
                          onClick={() => toggleHestOenske(hest.id)}
                          className={`min-h-[110px] p-4 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                            erValgt
                              ? 'border-amber-500 bg-amber-950/80 ring-2 ring-amber-400 shadow-md'
                              : 'border-slate-800/80 bg-slate-900/50 hover:border-slate-700 text-slate-400'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between">
                              <span className={`text-lg font-bold ${erValgt ? 'text-white' : 'text-slate-300'}`}>
                                {hest.navn}
                              </span>
                              {erValgt ? (
                                <span className="w-7 h-7 rounded-full bg-amber-500 text-white font-bold text-xs flex items-center justify-center shadow">
                                  {oenskeNr + 1}.
                                </span>
                              ) : (
                                <span className="w-6 h-6 rounded-full border border-slate-700 text-slate-500 text-xs flex items-center justify-center">
                                  +
                                </span>
                              )}
                            </div>

                            {/* Relevante tags ift. kabalen */}
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {erBegynder && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800/80">
                                  👶 Begynderhest
                                </span>
                              )}
                              {erSpring && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-950 text-indigo-300 border border-indigo-800/80">
                                  🏇 Springhest
                                </span>
                              )}
                              {erSkaane && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-950 text-sky-300 border border-sky-800/80">
                                  🛡️ Skånehest
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="mt-3 space-y-1">
                            <div className="text-xs text-slate-500 flex items-center justify-between">
                              <span>{hest.temperament ?? 'Rolig'}</span>
                              <span>{hest.stangmaal_cm} cm</span>
                            </div>
                            <div>
                              <span
                                className="text-[10px] text-amber-400 font-semibold truncate block"
                                title={aarsag}
                              >
                                {aarsag?.startsWith('⚠️') ? aarsag : `⚠️ ${aarsag ?? 'Ikke godkendt'}`}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-900 flex flex-wrap items-center justify-between gap-3">
              {redigerElev.oensker.length > 0 ? (
                <button
                  type="button"
                  onClick={haandterRydOensker}
                  className="min-h-[48px] px-4 rounded-xl border border-rose-900/80 bg-rose-950/40 text-rose-300 hover:bg-rose-900/60 font-semibold cursor-pointer text-sm flex items-center gap-1.5 transition"
                >
                  <span>🗑️</span>
                  <span>Ryd alle ønsker</span>
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setRedigerElev(null)}
                  className="min-h-[48px] px-5 rounded-xl border border-slate-700 bg-slate-800 font-semibold text-slate-300 hover:bg-slate-700 cursor-pointer text-sm"
                >
                  Annuller
                </button>
                <button
                  type="button"
                  onClick={haandterGemOensker}
                  disabled={valgteOensker.length === 0 && redigerElev.oensker.length === 0}
                  className="min-h-[48px] px-7 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm shadow-lg shadow-emerald-950/50 cursor-pointer transition flex items-center gap-2"
                >
                  <span>💾</span>
                  <span>
                    {valgteOensker.length === 0
                      ? 'Gem som ryddet (0 ønsker)'
                      : `Gem ${valgteOensker.length} af 3 ønsker`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
