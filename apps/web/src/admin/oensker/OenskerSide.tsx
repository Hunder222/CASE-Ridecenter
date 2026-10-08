import type { Elevoenske, Rytter } from '@ridecenter/contracts';
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
  oensker: Elevoenske[];
}

const NIVEAU_LABELS: Record<Rytter['erfaringsniveau'], string> = {
  Begynder: 'Begynder',
  Letoevet: 'Letøvet',
  Oevet: 'Øvet',
};

function OenskeDialog({
  maaned,
  rytter,
  onLuk,
}: {
  maaned: string;
  rytter: RytterOensker;
  onLuk: () => void;
}) {
  const heste = useHeste();
  const gem = useGemOensker(maaned);
  const [valgte, setValgte] = useState(() => [0, 1, 2].map((i) => rytter.oensker[i]?.oensket_hest_id ?? ''));

  function indsend(event: FormEvent) {
    event.preventDefault();
    gem.mutate(
      { rytter_id: rytter.rytterId, oensker: valgte.filter((id) => id !== '') },
      { onSuccess: onLuk },
    );
  }

  function rydAlle() {
    if (confirm(`Er du sikker på, at du vil rydde alle ønsker for ${rytter.navn}?`)) {
      setValgte(['', '', '']);
      gem.mutate(
        { rytter_id: rytter.rytterId, oensker: [] },
        { onSuccess: onLuk },
      );
    }
  }

  const aktiveHeste = useMemo(() => {
    return (heste.data ?? []).filter((h) => h.aktiv);
  }, [heste.data]);

  return (
    <Dialog aaben titel={`Ønsker for ${rytter.navn} (${NIVEAU_LABELS[rytter.niveau]})`} onLuk={onLuk}>
      <form onSubmit={indsend} className="space-y-4">
        <p className="text-sm text-stone-600">
          Vælg op til 3 prioriterede heste for {maanedNavn(maaned)}.
        </p>

        {valgte.map((valgt, i) => (
          <Felt key={i} label={`${i + 1}. prioritet`}>
            <Valg
              value={valgt}
              onChange={(e) => setValgte((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
            >
              <option value="">— Intet ønske —</option>
              {aktiveHeste.map((h) => (
                <option key={h.id} value={h.id} disabled={valgte.includes(h.id) && valgt !== h.id}>
                  {h.navn} ({h.temperament}, max {h.max_rytter_vaegt_kg} kg)
                </option>
              ))}
            </Valg>
          </Felt>
        ))}

        <FejlBesked fejl={gem.error} />

        <div className="flex items-center justify-between pt-2 border-t border-stone-200">
          <button
            type="button"
            onClick={rydAlle}
            disabled={gem.isPending || valgte.every((v) => v === '')}
            className="text-xs text-rose-700 hover:text-rose-900 font-medium px-2 py-1 rounded hover:bg-rose-50 border border-transparent hover:border-rose-200 disabled:opacity-40 disabled:hover:bg-transparent"
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
  const [filter, setFilter] = useState<'alle' | 'mangler' | 'har'>('alle');
  const [soegning, setSoegning] = useState('');

  const hesteNavne = useMemo(
    () => new Map((heste.data ?? []).map((h) => [h.id, h.navn])),
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

    return aktiveRyttere.map((r): RytterOensker => ({
      rytterId: r.id,
      navn: `${r.fornavn} ${r.efternavn}`,
      niveau: r.erfaringsniveau,
      oensker: oenskerMap.get(r.id) ?? [],
    }));
  }, [ryttere.data, oensker.data]);

  // Filtrering og søgning
  const filtreredeRyttere = useMemo(() => {
    return alleRytterOensker.filter((r) => {
      const matcherSoegning = r.navn.toLowerCase().includes(soegning.trim().toLowerCase());
      if (!matcherSoegning) return false;

      if (filter === 'mangler') return r.oensker.length === 0;
      if (filter === 'har') return r.oensker.length > 0;
      return true;
    });
  }, [alleRytterOensker, filter, soegning]);

  const antalMangler = alleRytterOensker.filter((r) => r.oensker.length === 0).length;
  const antalHar = alleRytterOensker.filter((r) => r.oensker.length > 0).length;

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
        <div className="flex items-center gap-2">
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
            onClick={() => setFilter('mangler')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
              filter === 'mangler'
                ? 'bg-amber-600 text-white border-amber-600'
                : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
            }`}
          >
            Mangler ønsker ({antalMangler})
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
              <Th>Elev</Th>
              <Th>Niveau</Th>
              <Th>Status</Th>
              <Th>1. prioritet</Th>
              <Th>2. prioritet</Th>
              <Th>3. prioritet</Th>
              <Th className="text-right">Handling</Th>
            </tr>
          </thead>
          <tbody>
            {filtreredeRyttere.length === 0 ? (
              <tr>
                <Td colSpan={7} className="text-center py-8 text-stone-500">
                  Ingen elever matcher søgningen eller filteret.
                </Td>
              </tr>
            ) : (
              filtreredeRyttere.map((r) => {
                const oenske1 = r.oensker.find((o) => o.prioritet === 1);
                const oenske2 = r.oensker.find((o) => o.prioritet === 2);
                const oenske3 = r.oensker.find((o) => o.prioritet === 3);

                return (
                  <tr key={r.rytterId} className="hover:bg-stone-50 transition">
                    <Td className="font-semibold text-stone-900">{r.navn}</Td>
                    <Td>
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-stone-100 text-stone-700 border border-stone-200">
                        {NIVEAU_LABELS[r.niveau]}
                      </span>
                    </Td>
                    <Td>
                      {r.oensker.length === 3 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                          ● 3/3 ønsker
                        </span>
                      ) : r.oensker.length > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                          {r.oensker.length}/3 delvis
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                          Mangler
                        </span>
                      )}
                    </Td>
                    <Td>
                      {oenske1 ? (
                        <span className="font-medium text-stone-800">
                          {hesteNavne.get(oenske1.oensket_hest_id) ?? 'Ukendt hest'}
                          {!oenske1.kan_opfyldes && (
                            <Badge variant="advarsel">
                              Kan ikke opfyldes
                            </Badge>
                          )}
                        </span>
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </Td>
                    <Td>
                      {oenske2 ? (
                        <span className="font-medium text-stone-800">
                          {hesteNavne.get(oenske2.oensket_hest_id) ?? 'Ukendt hest'}
                          {!oenske2.kan_opfyldes && (
                            <Badge variant="advarsel">
                              Kan ikke opfyldes
                            </Badge>
                          )}
                        </span>
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </Td>
                    <Td>
                      {oenske3 ? (
                        <span className="font-medium text-stone-800">
                          {hesteNavne.get(oenske3.oensket_hest_id) ?? 'Ukendt hest'}
                          {!oenske3.kan_opfyldes && (
                            <Badge variant="advarsel">
                              Kan ikke opfyldes
                            </Badge>
                          )}
                        </span>
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
          onLuk={() => setRedigerer(null)}
        />
      )}
    </section>
  );
}
