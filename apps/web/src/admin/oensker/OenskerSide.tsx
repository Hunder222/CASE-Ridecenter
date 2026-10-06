import type { Elevoenske } from '@ridecenter/contracts';
import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { forskydMaaned, maanedNavn, naesteMaaned } from '../../faelles/maaned';
import { Badge } from '../../faelles/ui/Badge';
import { Dialog } from '../../faelles/ui/Dialog';
import { FejlBesked } from '../../faelles/ui/FejlBesked';
import { Felt, Valg } from '../../faelles/ui/Felt';
import { Indlaeser } from '../../faelles/ui/Indlaeser';
import { Knap } from '../../faelles/ui/Knap';
import { Tabel, Td, Th } from '../../faelles/ui/Tabel';
import { useGemOensker, useHeste, useOensker } from '../api/stamdata';

interface RytterOensker {
  rytterId: string;
  navn: string;
  oensker: Elevoenske[];
}

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

  return (
    <Dialog aaben titel={`Ønsker for ${rytter.navn}`} onLuk={onLuk}>
      <form onSubmit={indsend} className="space-y-3">
        {valgte.map((valgt, i) => (
          <Felt key={i} label={`${i + 1}. ønske`}>
            <Valg
              value={valgt}
              onChange={(e) => setValgte((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
            >
              <option value="">Intet ønske</option>
              {(heste.data ?? [])
                .filter((h) => h.aktiv)
                .map((h) => (
                  <option key={h.id} value={h.id} disabled={valgte.includes(h.id) && valgt !== h.id}>
                    {h.navn}
                  </option>
                ))}
            </Valg>
          </Felt>
        ))}
        <FejlBesked fejl={gem.error} />
        <div className="flex justify-end gap-2">
          <Knap variant="sekundaer" onClick={onLuk}>
            Annullér
          </Knap>
          <Knap type="submit" disabled={gem.isPending}>
            Gem
          </Knap>
        </div>
      </form>
    </Dialog>
  );
}

/**
 * Ønsker for måneden (F1.1, T094). API'et har endnu ikke tilmeldinger pr. hold (Fase 2), så tabellen er pr.
 * rytter. En ridelærer kan kun gemme for ryttere på egne hold (API'et håndhæver det).
 */
export function OenskerSide() {
  const { maaned = naesteMaaned() } = useParams();
  const oensker = useOensker(maaned);
  const heste = useHeste();
  const [redigerer, setRedigerer] = useState<RytterOensker | null>(null);
  const hesteNavne = new Map((heste.data ?? []).map((h) => [h.id, h.navn]));
  const prRytter = new Map<string, RytterOensker>();
  for (const o of oensker.data ?? []) {
    const r = prRytter.get(o.rytter_id) ?? { rytterId: o.rytter_id, navn: o.rytter_navn, oensker: [] };
    r.oensker.push(o);
    prRytter.set(o.rytter_id, r);
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Ønsker – {maanedNavn(maaned)}</h1>
        <Link to={`/admin/oensker/${forskydMaaned(maaned, -1)}`} className="text-emerald-800 underline">
          ← Forrige måned
        </Link>
        <Link to={`/admin/oensker/${forskydMaaned(maaned, 1)}`} className="text-emerald-800 underline">
          Næste måned →
        </Link>
      </div>
      <FejlBesked fejl={oensker.error} />
      {oensker.isPending && <Indlaeser />}
      {oensker.data && prRytter.size === 0 && <p>Der er ingen ønsker for måneden endnu.</p>}
      {prRytter.size > 0 && (
        <Tabel>
          <thead>
            <tr>
              <Th>Rytter</Th>
              <Th>1. ønske</Th>
              <Th>2. ønske</Th>
              <Th>3. ønske</Th>
              <Th>
                <span className="sr-only">Handling</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {[...prRytter.values()].map((r) => (
              <tr key={r.rytterId}>
                <Td className="font-medium">{r.navn}</Td>
                {[1, 2, 3].map((prioritet) => {
                  const oenske = r.oensker.find((o) => o.prioritet === prioritet);
                  return (
                    <Td key={prioritet}>
                      {oenske ? (hesteNavne.get(oenske.oensket_hest_id) ?? 'Ukendt hest') : '—'}{' '}
                      {oenske && !oenske.kan_opfyldes && <Badge variant="advarsel">Kan ikke opfyldes</Badge>}
                    </Td>
                  );
                })}
                <Td>
                  <Knap variant="sekundaer" onClick={() => setRedigerer(r)}>
                    Redigér
                  </Knap>
                </Td>
              </tr>
            ))}
          </tbody>
        </Tabel>
      )}
      {redigerer && <OenskeDialog maaned={maaned} rytter={redigerer} onLuk={() => setRedigerer(null)} />}
    </section>
  );
}
