import type { Elevoenske, Hest, Rytter } from '@ridecenter/contracts';
import { useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { forskydMaaned, maanedNavn, naesteMaaned } from '../../faelles/maaned';
import { Badge } from '../../faelles/ui/Badge';
import { Dialog } from '../../faelles/ui/Dialog';
import { FejlBesked } from '../../faelles/ui/FejlBesked';
import { Felt, Input, Valg } from '../../faelles/ui/Felt';
import { Indlaeser } from '../../faelles/ui/Indlaeser';
import { Knap } from '../../faelles/ui/Knap';
import { Tabel, Td, Th } from '../../faelles/ui/Tabel';
import { useGemOensker, useHeste, useOensker, useRyttere } from '../api/stamdata';

interface RytterOensker {
  rytterId: string;
  navn: string;
  niveau: Rytter['erfaringsniveau'];
  holdType: string;
  erSpringhold: boolean;
  ugedag?: number;
  harPartaftale: boolean;
  partaftaleHestId: string | null;
  vaegtKg: number;
  hoejdeCm: number;
  oensker: Elevoenske[];
}

const NIVEAU_LABELS: Record<string, string> = {
  Begynder: 'Begynder',
  Letoevet: 'Letøvet',
  Oevet: 'Øvet',
  Traekhold: 'Trækhold',
  Parthold: 'Parthold',
};

function findOenskeAdvarsel(
  hest: Hest | undefined,
  rytter: {
    niveau: string;
    vaegtKg?: number;
    hoejdeCm?: number;
    erSpringhold?: boolean;
    ugedag?: number;
  },
  kanOpfyldes?: boolean,
): { erBlokeret: boolean; besked: string } | null {
  if (!hest) return null;

  const problemer: string[] = [];

  if (kanOpfyldes === false) {
    if (hest.temperament === 'Frisk') {
      problemer.push('Frisk hest må ikke tildeles rytter med rolig-krav (HC-07 Sikkerhedsprofil)');
    } else {
      problemer.push('Spærret af elevens sikkerhedsprofil (HC-07)');
    }
  }
  if (hest.sundhedsstatus !== 'Aktiv') {
    problemer.push(`Hesten er pt. ${hest.sundhedsstatus.toLowerCase()}`);
  }
  if (rytter.erSpringhold && (hest.springforbud || (hest.max_spring_uge ?? 0) <= 0)) {
    problemer.push('Hesten må ikke springe (springforbud)');
  }
  if (rytter.ugedag && hest.hviledag === rytter.ugedag) {
    problemer.push('Hesten har fast hviledag på holdets ugedag');
  }
  if (rytter.vaegtKg && hest.max_rytter_vaegt_kg < rytter.vaegtKg) {
    problemer.push(`Rytterens vægt (${rytter.vaegtKg} kg) overskrider hestens max vægt (${hest.max_rytter_vaegt_kg} kg)`);
  }
  if (rytter.hoejdeCm && hest.max_rytter_hoejde_cm && hest.max_rytter_hoejde_cm < rytter.hoejdeCm) {
    problemer.push(`Rytterens højde (${rytter.hoejdeCm} cm) overskrider hestens max højde (${hest.max_rytter_hoejde_cm} cm)`);
  }
  if (rytter.niveau === 'Begynder' && !hest.godkendt_til_begyndere) {
    problemer.push('Hesten er ikke godkendt til begyndere');
  }
  if (rytter.niveau === 'Oevet' && hest.egnet_oevet === false) {
    problemer.push('Hesten er ikke egnet til øvede');
  }

  if (problemer.length === 0) return null;

  return {
    erBlokeret: kanOpfyldes === false,
    besked: problemer.join(' • '),
  };
}

function OenskeDialog({
  maaned,
  rytter,
  rytterData,
  onLuk,
}: {
  maaned: string;
  rytter: RytterOensker;
  rytterData?: Rytter;
  onLuk: () => void;
}) {
  const heste = useHeste();
  const gem = useGemOensker(maaned);
  const [valgte, setValgte] = useState<string[]>(() =>
    [0, 1, 2]
      .map((i) => rytter.oensker[i]?.oensket_hest_id ?? '')
      .filter(Boolean),
  );

  const aktiveHeste = useMemo(() => {
    return (heste.data ?? []).filter((h) => h.aktiv);
  }, [heste.data]);

  const toggleHest = (hestId: string) => {
    if (valgte.includes(hestId)) {
      setValgte(valgte.filter((id) => id !== hestId));
    } else {
      if (valgte.length >= 3) {
        alert('Der kan maksimalt vælges 3 prioriteter. Fjern et ønske for at vælge denne hest.');
        return;
      }
      setValgte([...valgte, hestId]);
    }
  };

  const { top5Egnede, oevrigeEgnede, uegnede } = useMemo(() => {
    type HestMedStatus = {
      hest: (typeof aktiveHeste)[0];
      egnet: boolean;
      aarsag?: string;
      score: number;
    };

    const evaluerede: HestMedStatus[] = aktiveHeste.map((h) => {
      let egnet = true;
      let aarsag: string | undefined = undefined;
      let score = 50;

      if (rytterData) {
        if (h.max_rytter_vaegt_kg < rytterData.vaegt_kg) {
          egnet = false;
          aarsag = `Max vægt (${h.max_rytter_vaegt_kg} kg < ${rytterData.vaegt_kg} kg)`;
          score = -100;
        } else if (h.max_rytter_hoejde_cm && h.max_rytter_hoejde_cm < rytterData.hoejde_cm) {
          egnet = false;
          aarsag = `Max højde (${h.max_rytter_hoejde_cm} cm < ${rytterData.hoejde_cm} cm)`;
          score = -100;
        } else if (rytterData.erfaringsniveau === 'Begynder' && !h.godkendt_til_begyndere) {
          egnet = false;
          aarsag = 'Ikke godkendt til begyndere';
          score = -50;
        } else if (rytterData.erfaringsniveau === 'Oevet' && h.egnet_oevet === false) {
          egnet = false;
          aarsag = 'Ikke egnet til øvede';
          score = -50;
        }

        if (rytterData.partaftale_hest_id === h.id) {
          score += 200;
        }
        if (rytterData.erfaringsniveau === 'Begynder' && h.temperament === 'Rolig') score += 20;
        if (rytterData.erfaringsniveau === 'Oevet' && h.temperament === 'Frisk') score += 20;
      } else {
        if (rytter.niveau === 'Begynder' && !h.godkendt_til_begyndere) {
          egnet = false;
          aarsag = 'Ikke godkendt til begyndere';
        } else if (rytter.niveau === 'Oevet' && h.egnet_oevet === false) {
          egnet = false;
          aarsag = 'Ikke egnet til øvede';
        }
      }

      return { hest: h, egnet, aarsag, score };
    });

    const alleEgnede = evaluerede
      .filter((x) => x.egnet)
      .sort((a, b) => b.score - a.score || a.hest.navn.localeCompare(b.hest.navn, 'da'));

    const alleUegnede = evaluerede
      .filter((x) => !x.egnet)
      .sort((a, b) => a.hest.navn.localeCompare(b.hest.navn, 'da'));

    return {
      top5Egnede: alleEgnede.slice(0, 5),
      oevrigeEgnede: alleEgnede.slice(5),
      uegnede: alleUegnede,
    };
  }, [aktiveHeste, rytterData, rytter.niveau]);

  function indsend(event: FormEvent) {
    event.preventDefault();
    gem.mutate(
      { rytter_id: rytter.rytterId, oensker: valgte },
      { onSuccess: onLuk },
    );
  }

  function rydAlle() {
    if (confirm(`Er du sikker på, at du vil rydde alle ønsker for ${rytter.navn}?`)) {
      setValgte([]);
      gem.mutate(
        { rytter_id: rytter.rytterId, oensker: [] },
        { onSuccess: onLuk },
      );
    }
  }

  const hesteMap = useMemo(() => new Map(aktiveHeste.map((h) => [h.id, h])), [aktiveHeste]);

  return (
    <Dialog aaben titel={`Hesteønsker for ${rytter.navn} (${NIVEAU_LABELS[rytter.niveau]})`} onLuk={onLuk}>
      <form onSubmit={indsend} className="space-y-4">
        {/* Valgte heste statusbjælke */}
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">Valgte prioriteter:</span>
            {valgte.length === 0 ? (
              <span className="text-xs text-amber-700 italic">Ingen heste valgt endnu</span>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5">
                {valgte.map((hid, idx) => {
                  const h = hesteMap.get(hid);
                  return (
                    <span
                      key={hid}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300"
                    >
                      <span>
                        {idx + 1}. {h?.navn ?? 'Hest'}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleHest(hid)}
                        className="hover:text-rose-700 cursor-pointer ml-0.5 text-xs font-black"
                        title="Fjern ønske"
                      >
                        ✕
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
          <span className="text-xs text-stone-500 font-semibold">{valgte.length} af 3 valgt</span>
        </div>

        {/* Scrollable heste-sektioner */}
        <div className="max-h-[58vh] overflow-y-auto space-y-6 pr-1">
          {/* 1. TOP 5 EGNEDE */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between border-b border-emerald-200 pb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                <span>🟢</span> Top 5 egnede heste
              </span>
              <span className="text-[11px] font-semibold text-stone-500">Mest velegnede til eleven</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {top5Egnede.map(({ hest }) => {
                const oenskeNr = valgte.indexOf(hest.id);
                const erValgt = oenskeNr !== -1;
                return (
                  <button
                    key={hest.id}
                    type="button"
                    onClick={() => toggleHest(hest.id)}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                      erValgt
                        ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-500 shadow-sm'
                        : 'border-stone-200 bg-white hover:bg-stone-50 hover:border-emerald-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-stone-900 text-sm">{hest.navn}</span>
                      {erValgt ? (
                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[11px] flex items-center justify-center">
                          {oenskeNr + 1}.
                        </span>
                      ) : (
                        <span className="w-5 h-5 rounded-full border border-stone-300 text-stone-400 text-xs flex items-center justify-center">
                          +
                        </span>
                      )}
                    </div>
                    <div className="mt-2 text-[11px] text-stone-500 space-y-0.5">
                      <div>{hest.stangmaal_cm} cm • {hest.temperament}</div>
                      <div className="text-emerald-700 font-medium">✓ Egnet</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. ØVRIGE EGNEDE */}
          {oevrigeEgnede.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between border-b border-stone-200 pb-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
                  <span>🐎</span> Øvrige egnede heste ({oevrigeEgnede.length})
                </span>
                <span className="text-[11px] font-semibold text-stone-500">Også godkendt</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {oevrigeEgnede.map(({ hest }) => {
                  const oenskeNr = valgte.indexOf(hest.id);
                  const erValgt = oenskeNr !== -1;
                  return (
                    <button
                      key={hest.id}
                      type="button"
                      onClick={() => toggleHest(hest.id)}
                      className={`p-3 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                        erValgt
                          ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-500 shadow-sm'
                          : 'border-stone-200 bg-white hover:bg-stone-50 hover:border-stone-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-stone-900 text-sm">{hest.navn}</span>
                        {erValgt ? (
                          <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[11px] flex items-center justify-center">
                            {oenskeNr + 1}.
                          </span>
                        ) : (
                          <span className="w-5 h-5 rounded-full border border-stone-300 text-stone-400 text-xs flex items-center justify-center">
                            +
                          </span>
                        )}
                      </div>
                      <div className="mt-2 text-[11px] text-stone-500 space-y-0.5">
                        <div>{hest.stangmaal_cm} cm • {hest.temperament}</div>
                        <div className="text-emerald-700 font-medium">✓ Egnet</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. UEGNEDE HESTE */}
          {uegnede.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between border-b border-rose-200 pb-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
                  <span>⚠️</span> Uegnede heste ({uegnede.length})
                </span>
                <span className="text-[11px] font-semibold text-rose-600">Opfylder ikke krav</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {uegnede.map(({ hest, aarsag }) => {
                  const oenskeNr = valgte.indexOf(hest.id);
                  const erValgt = oenskeNr !== -1;
                  return (
                    <button
                      key={hest.id}
                      type="button"
                      onClick={() => toggleHest(hest.id)}
                      className={`p-3 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer opacity-85 hover:opacity-100 ${
                        erValgt
                          ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-400'
                          : 'border-stone-200 bg-stone-50 hover:bg-stone-100'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-stone-700 text-sm">{hest.navn}</span>
                        {erValgt ? (
                          <span className="w-5 h-5 rounded-full bg-amber-600 text-white font-bold text-[11px] flex items-center justify-center">
                            {oenskeNr + 1}.
                          </span>
                        ) : (
                          <span className="w-5 h-5 rounded-full border border-stone-300 text-stone-400 text-xs flex items-center justify-center">
                            +
                          </span>
                        )}
                      </div>
                      <div className="mt-2 text-[11px] text-stone-500 space-y-0.5">
                        <div className="text-rose-700 font-semibold">{aarsag}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <FejlBesked fejl={gem.error} />

        <div className="flex items-center justify-between pt-3 border-t border-stone-200">
          <button
            type="button"
            onClick={rydAlle}
            disabled={gem.isPending || valgte.length === 0}
            className="text-xs text-rose-700 hover:text-rose-900 font-semibold px-2 py-1 rounded hover:bg-rose-50 border border-transparent hover:border-rose-200 disabled:opacity-40"
          >
            🗑️ Ryd alle ønsker
          </button>

          <div className="flex gap-2">
            <Knap variant="sekundaer" onClick={onLuk}>
              Annullér
            </Knap>
            <Knap type="submit" disabled={gem.isPending}>
              {gem.isPending ? 'Gemmer...' : 'Gem ønsker'}
            </Knap>
          </div>
        </div>
      </form>
    </Dialog>
  );
}

/**
 * Ønsker for måneden (F1.1, T094).
 * Viser alle aktive elever med status for afgivne ønsker, så admin kan registrere, redigere eller rydde ønsker.
 */
export function OenskerSide() {
  const { maaned = naesteMaaned() } = useParams();
  const oensker = useOensker(maaned);
  const ryttere = useRyttere();
  const heste = useHeste();
  const gemOensker = useGemOensker(maaned);

  const [redigerer, setRedigerer] = useState<RytterOensker | null>(null);
  const [filter, setFilter] = useState<'alle' | 'part' | 'mangler' | 'delvist' | 'har'>('alle');
  const [soegning, setSoegning] = useState('');

  type SorteringsFelt = 'elev' | 'holdtype' | 'status' | 'oenske1' | 'oenske2' | 'oenske3';
  const [sortFelt, setSortFelt] = useState<SorteringsFelt>('elev');
  const [sortRetning, setSortRetning] = useState<'asc' | 'desc'>('asc');

  const skiftSortering = (felt: SorteringsFelt) => {
    if (sortFelt === felt) {
      setSortRetning(sortRetning === 'asc' ? 'desc' : 'asc');
    } else {
      setSortFelt(felt);
      setSortRetning('asc');
    }
  };

  const hesteNavne = useMemo(
    () => new Map((heste.data ?? []).map((h) => [h.id, h.navn])),
    [heste.data],
  );

  const hesteById = useMemo(
    () => new Map((heste.data ?? []).map((h) => [h.id, h])),
    [heste.data],
  );

  // Kombiner alle aktive ryttere med deres ønsker for den valgte måned
  const alleRytterOensker = useMemo(() => {
    const oenskerMap = new Map<string, Elevoenske[]>();
    for (const o of oensker.data ?? []) {
      const eksisterende = oenskerMap.get(o.rytter_id) ?? [];
      eksisterende.push(o);
      oenskerMap.set(o.rytter_id, eksisterende);
    }

    const aktiveRyttere = (ryttere.data ?? []).filter((r) => r.aktiv_status === 'Aktiv');

    return aktiveRyttere.map((r): RytterOensker => {
      const holdDetalje = r.hold_detaljer?.[0];
      const erSpring = Boolean(
        r.hold_detaljer?.some((h) => h.er_springhold) ||
        r.hold_typer?.some((t) => t.toLowerCase().includes('spring')),
      );
      const holdType =
        r.hold_typer && r.hold_typer.length > 0
          ? r.hold_typer.join(', ')
          : NIVEAU_LABELS[r.erfaringsniveau] ?? r.erfaringsniveau;

      return {
        rytterId: r.id,
        navn: `${r.fornavn} ${r.efternavn}`,
        niveau: r.erfaringsniveau,
        holdType,
        erSpringhold: erSpring,
        ugedag: holdDetalje?.ugedag,
        harPartaftale: Boolean(r.partaftale_hest_id),
        partaftaleHestId: r.partaftale_hest_id,
        vaegtKg: r.vaegt_kg,
        hoejdeCm: r.hoejde_cm,
        oensker: oenskerMap.get(r.id) ?? [],
      };
    });
  }, [ryttere.data, oensker.data]);

  // Filtrering og søgning
  const filtreredeOgSorteredeRyttere = useMemo(() => {
    return alleRytterOensker
      .filter((r) => {
        const matcherSoegning = r.navn.toLowerCase().includes(soegning.trim().toLowerCase());
        if (!matcherSoegning) return false;

        if (filter === 'part') return r.harPartaftale;
        if (filter === 'mangler') return !r.harPartaftale && r.oensker.length === 0;
        if (filter === 'delvist') return !r.harPartaftale && r.oensker.length > 0 && r.oensker.length < 3;
        if (filter === 'har') return !r.harPartaftale && r.oensker.length === 3;
        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortFelt === 'elev') {
          cmp = a.navn.localeCompare(b.navn, 'da');
        } else if (sortFelt === 'holdtype') {
          cmp = a.holdType.localeCompare(b.holdType, 'da');
        } else if (sortFelt === 'status') {
          const statusVaerdi = (x: RytterOensker) => {
            if (x.harPartaftale) return 1;
            if (x.oensker.length === 3) return 2;
            if (x.oensker.length > 0) return 3;
            return 4;
          };
          cmp = statusVaerdi(a) - statusVaerdi(b);
        } else if (sortFelt === 'oenske1') {
          const hA = hesteNavne.get(a.oensker.find((o) => o.prioritet === 1)?.oensket_hest_id ?? '') ?? '';
          const hB = hesteNavne.get(b.oensker.find((o) => o.prioritet === 1)?.oensket_hest_id ?? '') ?? '';
          cmp = hA.localeCompare(hB, 'da');
        } else if (sortFelt === 'oenske2') {
          const hA = hesteNavne.get(a.oensker.find((o) => o.prioritet === 2)?.oensket_hest_id ?? '') ?? '';
          const hB = hesteNavne.get(b.oensker.find((o) => o.prioritet === 2)?.oensket_hest_id ?? '') ?? '';
          cmp = hA.localeCompare(hB, 'da');
        } else if (sortFelt === 'oenske3') {
          const hA = hesteNavne.get(a.oensker.find((o) => o.prioritet === 3)?.oensket_hest_id ?? '') ?? '';
          const hB = hesteNavne.get(b.oensker.find((o) => o.prioritet === 3)?.oensket_hest_id ?? '') ?? '';
          cmp = hA.localeCompare(hB, 'da');
        }
        return sortRetning === 'asc' ? cmp : -cmp;
      });
  }, [alleRytterOensker, filter, soegning, sortFelt, sortRetning, hesteNavne]);

  const antalPart = alleRytterOensker.filter((r) => r.harPartaftale).length;
  const antalMangler = alleRytterOensker.filter((r) => !r.harPartaftale && r.oensker.length === 0).length;
  const antalDelvist = alleRytterOensker.filter((r) => !r.harPartaftale && r.oensker.length > 0 && r.oensker.length < 3).length;
  const antalHar = alleRytterOensker.filter((r) => !r.harPartaftale && r.oensker.length === 3).length;

  const haandterHurtigRyd = (r: RytterOensker) => {
    if (confirm(`Er du sikker på, at du vil rydde alle ønsker for ${r.navn}?`)) {
      gemOensker.mutate({ rytter_id: r.rytterId, oensker: [] });
    }
  };

  return (
    <section className="space-y-6">
      {/* Header og månedsnavigator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-stone-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Elevønsker – {maanedNavn(maaned)}</h1>
          <p className="text-sm text-stone-600 mt-1">
            Indtast eller redigér elevernes hesteønsker forud for månedsfordelingen.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm font-medium">
          <Link
            to={`/admin/oensker/${forskydMaaned(maaned, -1)}`}
            className="px-3 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 shadow-sm transition"
          >
            ← Forrige måned
          </Link>
          <Link
            to={`/admin/oensker/${forskydMaaned(maaned, 1)}`}
            className="px-3 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 shadow-sm transition"
          >
            Næste måned →
          </Link>
        </div>
      </div>

      <FejlBesked fejl={oensker.error ?? ryttere.error} />

      {/* Filterknapper og søgefelt */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFilter('alle')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
              filter === 'alle'
                ? 'bg-stone-800 text-white border-stone-800'
                : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
            }`}
          >
            Alle ({alleRytterOensker.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('part')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
              filter === 'part'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
            }`}
          >
            Partaftale ({antalPart})
          </button>
          <button
            type="button"
            onClick={() => setFilter('mangler')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
              filter === 'mangler'
                ? 'bg-rose-600 text-white border-rose-600'
                : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
            }`}
          >
            Mangler ønsker ({antalMangler})
          </button>
          <button
            type="button"
            onClick={() => setFilter('delvist')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
              filter === 'delvist'
                ? 'bg-amber-600 text-white border-amber-600'
                : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
            }`}
          >
            Delvist udfyldt ({antalDelvist})
          </button>
          <button
            type="button"
            onClick={() => setFilter('har')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
              filter === 'har'
                ? 'bg-emerald-700 text-white border-emerald-700'
                : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
            }`}
          >
            Har afgivet ønsker ({antalHar})
          </button>
        </div>

        <div className="w-full sm:w-64">
          <Input
            type="search"
            placeholder="Søg elev..."
            value={soegning}
            onChange={(e) => setSoegning(e.target.value)}
          />
        </div>
      </div>

      {(oensker.isPending || ryttere.isPending) && <Indlaeser />}

      {!oensker.isPending && !ryttere.isPending && (
        <Tabel>
          <thead>
            <tr>
              <Th className="w-[16%] min-w-[120px] whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => skiftSortering('elev')}
                  className="flex items-center gap-1 hover:text-stone-900 cursor-pointer font-bold"
                >
                  <span>Elev</span>
                  {sortFelt === 'elev' && <span>{sortRetning === 'asc' ? '▲' : '▼'}</span>}
                </button>
              </Th>
              <Th className="w-[16%] min-w-[150px] whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => skiftSortering('holdtype')}
                  className="flex items-center gap-1 hover:text-stone-900 cursor-pointer font-bold"
                >
                  <span>Holdtype</span>
                  {sortFelt === 'holdtype' && <span>{sortRetning === 'asc' ? '▲' : '▼'}</span>}
                </button>
              </Th>
              <Th className="w-[15%] min-w-[130px] whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => skiftSortering('status')}
                  className="flex items-center gap-1 hover:text-stone-900 cursor-pointer font-bold"
                >
                  <span>Status</span>
                  {sortFelt === 'status' && <span>{sortRetning === 'asc' ? '▲' : '▼'}</span>}
                </button>
              </Th>
              <Th className="w-[15%] min-w-[110px] whitespace-nowrap px-2">
                <button
                  type="button"
                  onClick={() => skiftSortering('oenske1')}
                  className="flex items-center gap-1 hover:text-stone-900 cursor-pointer font-bold"
                >
                  <span>1. prioritet</span>
                  {sortFelt === 'oenske1' && <span>{sortRetning === 'asc' ? '▲' : '▼'}</span>}
                </button>
              </Th>
              <Th className="w-[15%] min-w-[110px] whitespace-nowrap px-2">
                <button
                  type="button"
                  onClick={() => skiftSortering('oenske2')}
                  className="flex items-center gap-1 hover:text-stone-900 cursor-pointer font-bold"
                >
                  <span>2. prioritet</span>
                  {sortFelt === 'oenske2' && <span>{sortRetning === 'asc' ? '▲' : '▼'}</span>}
                </button>
              </Th>
              <Th className="w-[15%] min-w-[110px] whitespace-nowrap px-2">
                <button
                  type="button"
                  onClick={() => skiftSortering('oenske3')}
                  className="flex items-center gap-1 hover:text-stone-900 cursor-pointer font-bold"
                >
                  <span>3. prioritet</span>
                  {sortFelt === 'oenske3' && <span>{sortRetning === 'asc' ? '▲' : '▼'}</span>}
                </button>
              </Th>
              <Th className="w-[8%] text-right whitespace-nowrap">Handling</Th>
            </tr>
          </thead>
          <tbody>
            {filtreredeOgSorteredeRyttere.length === 0 ? (
              <tr>
                <Td colSpan={7} className="text-center py-8 text-stone-500">
                  Ingen elever matcher søgningen eller filteret.
                </Td>
              </tr>
            ) : (
              filtreredeOgSorteredeRyttere.map((r) => {
                const oenske1 = r.oensker.find((o) => o.prioritet === 1);
                const oenske2 = r.oensker.find((o) => o.prioritet === 2);
                const oenske3 = r.oensker.find((o) => o.prioritet === 3);

                return (
                  <tr key={r.rytterId} className="hover:bg-stone-50 transition">
                    <Td className="font-semibold text-stone-900 whitespace-nowrap">{r.navn}</Td>
                    <Td className="whitespace-nowrap">
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-stone-100 text-stone-700 border border-stone-200 whitespace-nowrap">
                        {r.holdType}
                      </span>
                    </Td>
                    <Td className="whitespace-nowrap">
                      {r.harPartaftale ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-300 whitespace-nowrap">
                          Partaftale
                        </span>
                      ) : r.oensker.length === 3 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 whitespace-nowrap">
                          ● 3/3 ønsker
                        </span>
                      ) : r.oensker.length > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 whitespace-nowrap">
                          {r.oensker.length}/3 delvis
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap">
                          Mangler
                        </span>
                      )}
                    </Td>
                    <Td className="px-2">
                      {oenske1 ? (
                        (() => {
                          const h = hesteById.get(oenske1.oensket_hest_id);
                          const advarsel = findOenskeAdvarsel(h, r, oenske1.kan_opfyldes);
                          const hestNavn = h?.navn ?? hesteNavne.get(oenske1.oensket_hest_id) ?? 'Ukendt hest';
                          return (
                            <span className="font-medium text-stone-800 inline-flex items-center gap-1.5 flex-nowrap">
                              <span className="truncate max-w-[120px]" title={hestNavn}>{hestNavn}</span>
                              {advarsel?.erBlokeret ? (
                                <span
                                  className="cursor-help px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 shrink-0 whitespace-nowrap"
                                  title={`⛔ Kan ikke opfyldes: ${advarsel.besked}`}
                                >
                                  ⛔ Kan ikke opfyldes
                                </span>
                              ) : advarsel ? (
                                <span
                                  className="text-amber-600 font-bold cursor-help shrink-0"
                                  title={`⚠️ ${advarsel.besked}`}
                                  aria-label={advarsel.besked}
                                >
                                  ⚠️
                                </span>
                              ) : null}
                            </span>
                          );
                        })()
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </Td>
                    <Td className="px-2">
                      {oenske2 ? (
                        (() => {
                          const h = hesteById.get(oenske2.oensket_hest_id);
                          const advarsel = findOenskeAdvarsel(h, r, oenske2.kan_opfyldes);
                          const hestNavn = h?.navn ?? hesteNavne.get(oenske2.oensket_hest_id) ?? 'Ukendt hest';
                          return (
                            <span className="font-medium text-stone-800 inline-flex items-center gap-1.5 flex-nowrap">
                              <span className="truncate max-w-[120px]" title={hestNavn}>{hestNavn}</span>
                              {advarsel?.erBlokeret ? (
                                <span
                                  className="cursor-help px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 shrink-0 whitespace-nowrap"
                                  title={`⛔ Kan ikke opfyldes: ${advarsel.besked}`}
                                >
                                  ⛔ Kan ikke opfyldes
                                </span>
                              ) : advarsel ? (
                                <span
                                  className="text-amber-600 font-bold cursor-help shrink-0"
                                  title={`⚠️ ${advarsel.besked}`}
                                  aria-label={advarsel.besked}
                                >
                                  ⚠️
                                </span>
                              ) : null}
                            </span>
                          );
                        })()
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </Td>
                    <Td className="px-2">
                      {oenske3 ? (
                        (() => {
                          const h = hesteById.get(oenske3.oensket_hest_id);
                          const advarsel = findOenskeAdvarsel(h, r, oenske3.kan_opfyldes);
                          const hestNavn = h?.navn ?? hesteNavne.get(oenske3.oensket_hest_id) ?? 'Ukendt hest';
                          return (
                            <span className="font-medium text-stone-800 inline-flex items-center gap-1.5 flex-nowrap">
                              <span className="truncate max-w-[120px]" title={hestNavn}>{hestNavn}</span>
                              {advarsel?.erBlokeret ? (
                                <span
                                  className="cursor-help px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 shrink-0 whitespace-nowrap"
                                  title={`⛔ Kan ikke opfyldes: ${advarsel.besked}`}
                                >
                                  ⛔ Kan ikke opfyldes
                                </span>
                              ) : advarsel ? (
                                <span
                                  className="text-amber-600 font-bold cursor-help shrink-0"
                                  title={`⚠️ ${advarsel.besked}`}
                                  aria-label={advarsel.besked}
                                >
                                  ⚠️
                                </span>
                              ) : null}
                            </span>
                          );
                        })()
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </Td>
                    <Td className="text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <Knap
                          variant="sekundaer"
                          onClick={() => setRedigerer(r)}
                          className="text-xs py-1 px-2.5"
                        >
                          {r.oensker.length > 0 ? 'Redigér' : '+ Indtast'}
                        </Knap>
                        {r.oensker.length > 0 && (
                          <button
                            type="button"
                            onClick={() => haandterHurtigRyd(r)}
                            title="Ryd ønsker"
                            aria-label="Ryd ønsker"
                            className="p-1.5 rounded hover:bg-rose-50 text-rose-600 hover:text-rose-800 border border-transparent hover:border-rose-200 transition text-xs cursor-pointer"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </Td>
                  </tr>
                );
              })
            )}
          </tbody>
        </Tabel>
      )}

      {redigerer && (
        <OenskeDialog
          maaned={maaned}
          rytter={redigerer}
          rytterData={ryttere.data?.find((r) => r.id === redigerer.rytterId)}
          onLuk={() => setRedigerer(null)}
        />
      )}
    </section>
  );
}
