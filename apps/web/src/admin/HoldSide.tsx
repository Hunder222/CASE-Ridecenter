import { useState } from 'react';
import type { Hold, HoldInput, Niveau } from '@ridecenter/contracts';
import { harRolle, useSession } from '../faelles/session';
import { Knap } from '../faelles/ui/Knap';
import {
  useAfmeldTilmelding,
  useHold,
  useHoldTilmeldinger,
  useOpretHold,
  useOpretTilmelding,
  useRyttere,
} from './api/stamdata';

const UGEDAGE = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag'];
const NIVEAUER: Niveau[] = ['Traekhold', 'Begynder', 'Letoevet', 'Oevet', 'Parthold'];
const NIVEAU_LABELS: Record<Niveau, string> = {
  Traekhold: 'Trækhold',
  Begynder: 'Begynder',
  Letoevet: 'Letøvet',
  Oevet: 'Øvet',
  Parthold: 'Parthold',
};

export function HoldSide() {
  const { data: session } = useSession();
  const erLedelse = harRolle(session, 'Ledelse');

  const { data: holdListe = [], isLoading } = useHold();
  const [valgtHoldId, setValgtHoldId] = useState<string | null>(null);
  const [visOpretModal, setVisOpretModal] = useState(false);

  // Gruppér hold efter ugedag
  const grupperedeHold = UGEDAGE.map((dagNavn, index) => {
    const ugedagNr = index + 1;
    const holdPaaDagen = holdListe.filter((h) => h.ugedag === ugedagNr);
    return { dagNavn, ugedagNr, hold: holdPaaDagen };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Holdadministration</h1>
          <p className="text-stone-600">
            Oversigt over de ugentlige elevhold, kapacitet og tilmeldte elever.
          </p>
        </div>
        {erLedelse && (
          <Knap onClick={() => setVisOpretModal(true)}>
            + Nyt hold
          </Knap>
        )}
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-stone-500">Indlæser hold...</div>
      ) : (
        <div className="space-y-8">
          {grupperedeHold.map(({ dagNavn, hold }) => (
            <div key={dagNavn} className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-stone-800 mb-4 pb-2 border-b border-stone-100 flex items-center justify-between">
                <span>{dagNavn}</span>
                <span className="text-xs font-normal text-stone-500">{hold.length} hold</span>
              </h2>

              {hold.length === 0 ? (
                <p className="text-sm italic text-stone-400">Ingen hold planlagt denne dag.</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {hold.map((h) => {
                    const tilmeldte = h.antal_tilmeldte ?? 0;
                    const erFuldt = tilmeldte >= h.max_kapacitet;

                    return (
                      <div
                        key={h.id}
                        className={`rounded-lg border p-4 transition-shadow hover:shadow-md ${
                          valgtHoldId === h.id
                            ? 'border-emerald-600 bg-emerald-50/30'
                            : 'border-stone-200 bg-stone-50/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-stone-900">
                            Kl. {h.starttid}
                          </span>
                          <span
                            className={`rounded px-2 py-0.5 text-xs font-medium ${
                              erFuldt
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {tilmeldte}/{h.max_kapacitet} tilmeldt
                          </span>
                        </div>

                        <h3 className="mt-2 text-base font-bold text-stone-800">{h.holdnavn}</h3>
                        <div className="mt-1 flex items-center gap-2 text-xs text-stone-600">
                          <span>{NIVEAU_LABELS[h.niveau] ?? h.niveau}</span>
                          <span>•</span>
                          <span>{h.varighed_min} min</span>
                          {h.er_springhold && (
                            <>
                              <span>•</span>
                              <span className="font-semibold text-amber-700">Spring</span>
                            </>
                          )}
                        </div>

                        <div className="mt-4 pt-3 border-t border-stone-200/60 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => setValgtHoldId(h.id)}
                            className="text-xs font-semibold text-emerald-800 hover:underline"
                          >
                            Administrér tilmeldinger →
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tilmeldingsdialog */}
      {valgtHoldId && (
        <TilmeldingerModal
          holdId={valgtHoldId}
          holdListe={holdListe}
          onLuk={() => setValgtHoldId(null)}
          erLedelse={erLedelse}
        />
      )}

      {/* Opret Hold modal */}
      {visOpretModal && (
        <OpretHoldModal
          onLuk={() => setVisOpretModal(false)}
        />
      )}
    </div>
  );
}

function TilmeldingerModal({
  holdId,
  holdListe,
  onLuk,
  erLedelse,
}: {
  holdId: string;
  holdListe: Hold[];
  onLuk: () => void;
  erLedelse: boolean;
}) {
  const hold = holdListe.find((h) => h.id === holdId);
  const { data: tilmeldinger = [], isLoading } = useHoldTilmeldinger(holdId);
  const { data: alleRyttere = [] } = useRyttere();

  const opretTilmelding = useOpretTilmelding(holdId);
  const afmeldTilmelding = useAfmeldTilmelding(holdId);

  const [valgtRytterId, setValgtRytterId] = useState('');
  const [fejl, setFejl] = useState<string | null>(null);

  if (!hold) return null;

  const tilmeldteRytterIds = new Set(tilmeldinger.map((t) => t.rytter_id));
  const ledigeRyttere = alleRyttere.filter(
    (r) => r.aktiv_status === 'Aktiv' && !tilmeldteRytterIds.has(r.id)
  );

  const haandterTilmeld = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valgtRytterId) return;
    setFejl(null);

    try {
      await opretTilmelding.mutateAsync({ rytter_id: valgtRytterId });
      setValgtRytterId('');
    } catch (err: any) {
      setFejl(err.besked || 'Kunne ikke tilmelde rytter');
    }
  };

  const haandterAfmeld = async (tilmeldingId: string) => {
    if (!confirm('Er du sikker på, at du vil afmelde rytteren fra holdet?')) return;
    try {
      await afmeldTilmelding.mutateAsync(tilmeldingId);
    } catch (err: any) {
      alert(err.besked || 'Kunne ikke afmelde rytter');
    }
  };

  const erFuldt = tilmeldinger.length >= hold.max_kapacitet;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between pb-3 border-b">
          <div>
            <h2 className="text-xl font-bold">{hold.holdnavn} – Tilmeldinger</h2>
            <p className="text-sm text-stone-500">
              Kapacitet: {tilmeldinger.length}/{hold.max_kapacitet} tilmeldte
            </p>
          </div>
          <button
            onClick={onLuk}
            className="text-stone-400 hover:text-stone-600 text-2xl font-semibold leading-none"
          >
            ×
          </button>
        </div>

        {/* Elevliste */}
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {isLoading ? (
            <p className="text-stone-400 text-sm">Henter tilmeldinger...</p>
          ) : tilmeldinger.length === 0 ? (
            <p className="text-stone-400 text-sm italic">Ingen elever tilmeldt endnu.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-stone-50 text-stone-600">
                <tr>
                  <th className="p-2">Rytter</th>
                  <th className="p-2">Gyldig fra</th>
                  <th className="p-2">Anciennitet</th>
                  {erLedelse && <th className="p-2 text-right">Handling</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {tilmeldinger.map((t) => (
                  <tr key={t.id} className="hover:bg-stone-50">
                    <td className="p-2 font-medium text-stone-900">{t.rytter_navn}</td>
                    <td className="p-2 text-stone-600">{t.gyldig_fra}</td>
                    <td className="p-2 text-stone-600">{t.ancienitet_dato}</td>
                    {erLedelse && (
                      <td className="p-2 text-right">
                        <button
                          type="button"
                          onClick={() => haandterAfmeld(t.id)}
                          className="text-xs text-rose-700 hover:underline"
                        >
                          Afmeld
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Tilføj elev (kun ledelse) */}
        {erLedelse && (
          <div className="pt-4 border-t">
            <h3 className="text-sm font-semibold mb-2">Tilmeld ny rytter</h3>
            {erFuldt ? (
              <p className="text-sm text-amber-700 bg-amber-50 p-2 rounded">
                Holdet har nået sin maksimale kapacitet ({hold.max_kapacitet} elever).
              </p>
            ) : (
              <form onSubmit={haandterTilmeld} className="flex gap-3">
                <select
                  value={valgtRytterId}
                  onChange={(e) => setValgtRytterId(e.target.value)}
                  className="flex-1 rounded border border-stone-300 p-2 text-sm"
                  required
                >
                  <option value="">Vælg rytter...</option>
                  {ledigeRyttere.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.fornavn} {r.efternavn} ({r.erfaringsniveau})
                    </option>
                  ))}
                </select>
                <Knap type="submit" disabled={!valgtRytterId || opretTilmelding.isPending}>
                  Tilmeld
                </Knap>
              </form>
            )}
            {fejl && <p className="mt-2 text-sm text-rose-600">{fejl}</p>}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Knap variant="sekundaer" onClick={onLuk}>
            Luk
          </Knap>
        </div>
      </div>
    </div>
  );
}

function OpretHoldModal({ onLuk }: { onLuk: () => void }) {
  const opretHold = useOpretHold();
  const { data: session } = useSession();

  const [holdnavn, setHoldnavn] = useState('');
  const [niveau, setNiveau] = useState<Niveau>('Begynder');
  const [ugedag, setUgedag] = useState(1);
  const [starttid, setStarttid] = useState('16:00');
  const [varighedMin, setVarighedMin] = useState(45);
  const [maxKapacitet, setMaxKapacitet] = useState(10);
  const [erSpringhold, setErSpringhold] = useState(false);
  const [fejl, setFejl] = useState<string | null>(null);

  const haandterOpret = async (e: React.FormEvent) => {
    e.preventDefault();
    setFejl(null);

    const input: HoldInput = {
      holdnavn,
      niveau,
      ugedag,
      starttid,
      varighed_min: varighedMin,
      max_kapacitet: maxKapacitet,
      er_springhold: erSpringhold,
      fast_underviser_id: session?.bruger_id || '00000000-0000-0000-0000-000000000000',
    };

    try {
      await opretHold.mutateAsync(input);
      onLuk();
    } catch (err: any) {
      setFejl(err.besked || 'Kunne ikke oprette hold');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl space-y-5">
        <h2 className="text-xl font-bold">Opret nyt elevhold</h2>

        <form onSubmit={haandterOpret} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
              Holdnavn
            </label>
            <input
              type="text"
              value={holdnavn}
              onChange={(e) => setHoldnavn(e.target.value)}
              placeholder="F.eks. Fredag 16:30 Øvet"
              required
              className="w-full rounded border border-stone-300 p-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
                Niveau
              </label>
              <select
                value={niveau}
                onChange={(e) => setNiveau(e.target.value as Niveau)}
                className="w-full rounded border border-stone-300 p-2 text-sm"
              >
                {NIVEAUER.map((n) => (
                  <option key={n} value={n}>
                    {NIVEAU_LABELS[n] ?? n}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
                Ugedag
              </label>
              <select
                value={ugedag}
                onChange={(e) => setUgedag(Number(e.target.value))}
                className="w-full rounded border border-stone-300 p-2 text-sm"
              >
                {UGEDAGE.map((navn, idx) => (
                  <option key={navn} value={idx + 1}>
                    {navn}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
                Starttid (HH:MM)
              </label>
              <input
                type="text"
                pattern="^[0-2][0-9]:[0-5][0-9]$"
                value={starttid}
                onChange={(e) => setStarttid(e.target.value)}
                placeholder="16:00"
                required
                className="w-full rounded border border-stone-300 p-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
                Varighed (min)
              </label>
              <input
                type="number"
                min={30}
                max={60}
                value={varighedMin}
                onChange={(e) => setVarighedMin(Number(e.target.value))}
                required
                className="w-full rounded border border-stone-300 p-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
                Kapacitet (max 10)
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={maxKapacitet}
                onChange={(e) => setMaxKapacitet(Number(e.target.value))}
                required
                className="w-full rounded border border-stone-300 p-2 text-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="spring-tjek"
              checked={erSpringhold}
              onChange={(e) => setErSpringhold(e.target.checked)}
              className="rounded border-stone-300 text-emerald-600"
            />
            <label htmlFor="spring-tjek" className="text-sm text-stone-700">
              Springhold (HC-05 regler gælder)
            </label>
          </div>

          {fejl && <p className="text-sm text-rose-600">{fejl}</p>}

          <div className="flex justify-end gap-3 pt-3 border-t">
            <Knap variant="sekundaer" onClick={onLuk}>
              Annuller
            </Knap>
            <Knap type="submit" disabled={opretHold.isPending}>
              Opret hold
            </Knap>
          </div>
        </form>
      </div>
    </div>
  );
}
