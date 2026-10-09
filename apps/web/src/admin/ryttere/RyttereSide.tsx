import type { Rytter, RytterInput } from '@ridecenter/contracts';
import { useState } from 'react';
import { Link } from 'react-router';
import { FejlBesked } from '../../faelles/ui/FejlBesked';
import { Felt, Input } from '../../faelles/ui/Felt';
import { Indlaeser } from '../../faelles/ui/Indlaeser';
import { Tabel, Td, Th } from '../../faelles/ui/Tabel';
import { useHeste, useOpretRytter, useRyttere, useSletRytter } from '../api/stamdata';

export const NIVEAU: Record<Rytter['erfaringsniveau'], string> = {
  Begynder: 'Begynder',
  Letoevet: 'Letøvet',
  Oevet: 'Øvet',
};

const TOM_RYTTER: RytterInput = {
  fornavn: '',
  efternavn: '',
  foedselsdato: '2014-05-15',
  bopaelskommune: 'Strandby Kommune',
  hoejde_cm: 155,
  vaegt_kg: 48,
  erfaringsniveau: 'Begynder',
  klar_til_udvikling: false,
  er_hjaelper: false,
  partaftale_hest_id: null,
  partaftale_godkendt_trods_niveau: false,
  kontaktperson_navn: '',
  kontakt_telefon: '',
  kontakt_email: '',
};

export function RyttereSide() {
  const ryttere = useRyttere();
  const heste = useHeste();
  const opretRytter = useOpretRytter();
  const sletRytter = useSletRytter();

  const [soegning, setSoegning] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Alle' | 'Aktiv' | 'Opsagt'>('Alle');
  const [sorteringsFelt, setSorteringsFelt] = useState<'navn' | 'niveau' | 'hold' | 'hoejde' | 'part' | 'status'>('navn');
  const [sorteringsRetning, setSorteringsRetning] = useState<'asc' | 'desc'>('asc');
  const [visOpretModal, setVisOpretModal] = useState(false);
  const [nytInput, setNytInput] = useState<RytterInput>(TOM_RYTTER);
  const [opretFejl, setOpretFejl] = useState<string | null>(null);
  const [rytterTilSletning, setRytterTilSletning] = useState<Rytter | null>(null);

  const hesteNavne = new Map((heste.data ?? []).map((h) => [h.id, h.navn]));

  const skiftSortering = (felt: 'navn' | 'niveau' | 'hold' | 'hoejde' | 'part' | 'status') => {
    if (sorteringsFelt === felt) {
      setSorteringsRetning(sorteringsRetning === 'asc' ? 'desc' : 'asc');
    } else {
      setSorteringsFelt(felt);
      setSorteringsRetning('asc');
    }
  };

  const viste = (ryttere.data ?? [])
    .filter((r) => {
      const matcherNavn = `${r.fornavn} ${r.efternavn}`
        .toLowerCase()
        .includes(soegning.trim().toLowerCase());
      const matcherStatus =
        statusFilter === 'Alle' ||
        (statusFilter === 'Aktiv' && r.aktiv_status === 'Aktiv') ||
        (statusFilter === 'Opsagt' && r.aktiv_status === 'Opsagt');
      return matcherNavn && matcherStatus;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sorteringsFelt === 'navn') {
        const navnA = `${a.fornavn} ${a.efternavn}`.toLowerCase();
        const navnB = `${b.fornavn} ${b.efternavn}`.toLowerCase();
        cmp = navnA.localeCompare(navnB, 'da');
      } else if (sorteringsFelt === 'niveau') {
        const niveauer: Record<string, number> = { Begynder: 1, Letoevet: 2, Oevet: 3 };
        cmp = (niveauer[a.erfaringsniveau] ?? 0) - (niveauer[b.erfaringsniveau] ?? 0);
      } else if (sorteringsFelt === 'hold') {
        const holdA = (a.hold_navne ?? []).join(', ');
        const holdB = (b.hold_navne ?? []).join(', ');
        cmp = holdA.localeCompare(holdB, 'da');
      } else if (sorteringsFelt === 'hoejde') {
        cmp = a.hoejde_cm - b.hoejde_cm;
      } else if (sorteringsFelt === 'part') {
        const partA = a.partaftale_hest_id ? (hesteNavne.get(a.partaftale_hest_id) ?? '') : '';
        const partB = b.partaftale_hest_id ? (hesteNavne.get(b.partaftale_hest_id) ?? '') : '';
        cmp = partA.localeCompare(partB, 'da');
      } else if (sorteringsFelt === 'status') {
        cmp = a.aktiv_status.localeCompare(b.aktiv_status, 'da');
      }
      return sorteringsRetning === 'asc' ? cmp : -cmp;
    });

  const haandterOpret = async (e: React.FormEvent) => {
    e.preventDefault();
    setOpretFejl(null);

    if (!nytInput.fornavn.trim() || !nytInput.efternavn.trim()) {
      setOpretFejl('Fornavn og efternavn er påkrævet.');
      return;
    }
    if (!nytInput.kontakt_email.trim() || !nytInput.kontakt_telefon.trim()) {
      setOpretFejl('Kontakt e-mail og telefonnummer er påkrævet.');
      return;
    }

    try {
      await opretRytter.mutateAsync(nytInput);
      setVisOpretModal(false);
      setNytInput(TOM_RYTTER);
    } catch (err: any) {
      setOpretFejl(err?.message ?? 'Der opstod en fejl ved oprettelse af rytter');
    }
  };

  const haandterSletBekraeftet = async () => {
    if (!rytterTilSletning) return;
    try {
      await sletRytter.mutateAsync(rytterTilSletning.id);
      setRytterTilSletning(null);
    } catch (err: any) {
      alert(err?.message ?? 'Fejl ved sletning af rytter');
    }
  };

  return (
    <section className="space-y-5">
      {/* Top bjælke med titel og opret knap */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-stone-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Ryttere & Elever</h1>
          <p className="text-sm text-stone-600 mt-0.5">
            Administration af stamdata, tilmeldinger og sikkerhedsprofiler for ridecenterets elever.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setNytInput(TOM_RYTTER);
            setOpretFejl(null);
            setVisOpretModal(true);
          }}
          className="px-4 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold shadow-sm transition flex items-center gap-1.5 cursor-pointer"
        >
          <span>+ Opret rytter</span>
        </button>
      </div>

      {/* Søgning og filter */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="w-full sm:w-80">
          <Input
            type="search"
            placeholder="Søg rytter efter navn..."
            value={soegning}
            onChange={(e) => setSoegning(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-stone-500 font-medium">Status:</span>
          {(['Alle', 'Aktiv', 'Opsagt'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-md font-medium transition cursor-pointer ${
                statusFilter === s
                  ? 'bg-stone-800 text-white shadow-xs'
                  : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <FejlBesked fejl={ryttere.error} />
      {ryttere.isPending && <Indlaeser />}

      {ryttere.data && (
        <Tabel>
          <thead>
            <tr>
              <Th>
                <button
                  type="button"
                  onClick={() => skiftSortering('navn')}
                  className="flex items-center gap-1 hover:text-stone-900 cursor-pointer font-bold"
                >
                  <span>Navn</span>
                  {sorteringsFelt === 'navn' && <span>{sorteringsRetning === 'asc' ? '▲' : '▼'}</span>}
                </button>
              </Th>
              <Th>
                <button
                  type="button"
                  onClick={() => skiftSortering('niveau')}
                  className="flex items-center gap-1 hover:text-stone-900 cursor-pointer font-bold"
                >
                  <span>Niveau</span>
                  {sorteringsFelt === 'niveau' && <span>{sorteringsRetning === 'asc' ? '▲' : '▼'}</span>}
                </button>
              </Th>
              <Th>
                <button
                  type="button"
                  onClick={() => skiftSortering('hold')}
                  className="flex items-center gap-1 hover:text-stone-900 cursor-pointer font-bold"
                >
                  <span>Tilmeldte hold</span>
                  {sorteringsFelt === 'hold' && <span>{sorteringsRetning === 'asc' ? '▲' : '▼'}</span>}
                </button>
              </Th>
              <Th>
                <button
                  type="button"
                  onClick={() => skiftSortering('hoejde')}
                  className="flex items-center gap-1 hover:text-stone-900 cursor-pointer font-bold"
                >
                  <span>Højde / Vægt</span>
                  {sorteringsFelt === 'hoejde' && <span>{sorteringsRetning === 'asc' ? '▲' : '▼'}</span>}
                </button>
              </Th>
              <Th>
                <button
                  type="button"
                  onClick={() => skiftSortering('part')}
                  className="flex items-center gap-1 hover:text-stone-900 cursor-pointer font-bold"
                >
                  <span>Partaftale</span>
                  {sorteringsFelt === 'part' && <span>{sorteringsRetning === 'asc' ? '▲' : '▼'}</span>}
                </button>
              </Th>
              <Th>
                <button
                  type="button"
                  onClick={() => skiftSortering('status')}
                  className="flex items-center gap-1 hover:text-stone-900 cursor-pointer font-bold"
                >
                  <span>Status</span>
                  {sorteringsFelt === 'status' && <span>{sorteringsRetning === 'asc' ? '▲' : '▼'}</span>}
                </button>
              </Th>
              <Th className="text-right">Handling</Th>
            </tr>
          </thead>
          <tbody>
            {viste.length === 0 ? (
              <tr>
                <Td colSpan={7} className="text-center py-8 text-stone-500 text-sm">
                  Ingen ryttere fundet med de valgte kriterier.
                </Td>
              </tr>
            ) : (
              viste.map((r) => (
                <tr key={r.id} className="hover:bg-stone-50/80 transition">
                  <Td>
                    <Link
                      to={`/admin/ryttere/${r.id}`}
                      className="font-semibold text-emerald-900 hover:text-emerald-700 underline"
                    >
                      {r.fornavn} {r.efternavn}
                    </Link>
                  </Td>
                  <Td>
                    <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-stone-100 text-stone-800 border border-stone-200">
                      {NIVEAU[r.erfaringsniveau]}
                    </span>
                  </Td>
                  <Td>
                    {r.hold_navne && r.hold_navne.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {r.hold_navne.map((navn) => (
                          <span
                            key={navn}
                            className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-stone-100 text-stone-700 border border-stone-200"
                          >
                            {navn}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-stone-400 text-xs italic">Ingen hold</span>
                    )}
                  </Td>
                  <Td className="text-xs text-stone-600 font-mono">
                    {r.hoejde_cm} cm / {r.vaegt_kg} kg
                  </Td>
                  <Td>
                    {r.partaftale_hest_ids && r.partaftale_hest_ids.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {r.partaftale_hest_ids.map((hid) => {
                          const hestNavn = hesteNavne.get(hid) ?? 'Parthest';
                          const erPaakraevet = (r.paakraevede_hest_ids ?? []).includes(hid) || r.har_paakraevet_hest;
                          return (
                            <span key={hid} className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-800">
                              <span>🐎 {hestNavn}</span>
                              {erPaakraevet && (
                                <span
                                  title="Påkrævet hest af hensyn til rytterens sikkerhedsprofil (partaftale)"
                                  className="cursor-help text-amber-700 text-sm font-bold inline-flex items-center leading-none"
                                >
                                  🔒
                                </span>
                              )}
                              {r.partaftale_godkendt_trods_niveau && hid === r.partaftale_hest_id && ' (godkendt)'}
                            </span>
                          );
                        })}
                      </div>
                    ) : r.partaftale_hest_id ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-800">
                        <span>🐎 {hesteNavne.get(r.partaftale_hest_id) ?? 'Parthest'}</span>
                        {r.har_paakraevet_hest && (
                          <span
                            title="Påkrævet hest af hensyn til rytterens sikkerhedsprofil (partaftale)"
                            className="cursor-help text-amber-700 text-sm font-bold inline-flex items-center leading-none"
                          >
                            🔒
                          </span>
                        )}
                        {r.partaftale_godkendt_trods_niveau && ' (godkendt)'}
                      </span>
                    ) : r.har_paakraevet_hest ? (
                      <span
                        title="Påkrævet hest af hensyn til rytterens sikkerhedsprofil (partaftale)"
                        className="cursor-help text-amber-700 text-sm font-bold inline-flex items-center leading-none"
                      >
                        🔒
                      </span>
                    ) : (
                      <span className="text-stone-400 text-xs">—</span>
                    )}
                  </Td>
                  <Td>
                    {r.aktiv_status === 'Aktiv' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        ● Aktiv
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-600 border border-stone-300">
                        {r.aktiv_status}
                      </span>
                    )}
                  </Td>
                  <Td className="text-right">
                    <button
                      type="button"
                      onClick={() => setRytterTilSletning(r)}
                      title="Slet eller opsig rytter"
                      className="px-2.5 py-1 text-xs font-semibold text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 border border-rose-300 rounded transition cursor-pointer"
                    >
                      🗑️ Slet
                    </button>
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </Tabel>
      )}

      {/* Modal: Opret Rytter */}
      {visOpretModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-lg w-full p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h2 className="text-lg font-bold text-stone-900">Opret ny elev / rytter</h2>
              <button
                type="button"
                onClick={() => setVisOpretModal(false)}
                className="text-stone-400 hover:text-stone-600 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {opretFejl && (
              <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg text-rose-800 text-xs font-medium">
                {opretFejl}
              </div>
            )}

            <form onSubmit={haandterOpret} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Felt label="Fornavn *">
                  <Input
                    required
                    value={nytInput.fornavn}
                    onChange={(e) => setNytInput({ ...nytInput, fornavn: e.target.value })}
                    placeholder="F.eks. Lærke"
                  />
                </Felt>
                <Felt label="Efternavn *">
                  <Input
                    required
                    value={nytInput.efternavn}
                    onChange={(e) => setNytInput({ ...nytInput, efternavn: e.target.value })}
                    placeholder="F.eks. Hansen"
                  />
                </Felt>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Felt label="Fødselsdato *">
                  <Input
                    type="date"
                    required
                    value={nytInput.foedselsdato}
                    onChange={(e) => setNytInput({ ...nytInput, foedselsdato: e.target.value })}
                  />
                </Felt>
                <Felt label="Bopælskommune *">
                  <Input
                    required
                    value={nytInput.bopaelskommune}
                    onChange={(e) => setNytInput({ ...nytInput, bopaelskommune: e.target.value })}
                  />
                </Felt>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Felt label="Højde (cm)">
                  <Input
                    type="number"
                    min={80}
                    max={210}
                    value={nytInput.hoejde_cm}
                    onChange={(e) => setNytInput({ ...nytInput, hoejde_cm: Number(e.target.value) })}
                  />
                </Felt>
                <Felt label="Vægt (kg)">
                  <Input
                    type="number"
                    min={15}
                    max={150}
                    value={nytInput.vaegt_kg}
                    onChange={(e) => setNytInput({ ...nytInput, vaegt_kg: Number(e.target.value) })}
                  />
                </Felt>
                <Felt label="Niveau">
                  <select
                    value={nytInput.erfaringsniveau}
                    onChange={(e) =>
                      setNytInput({
                        ...nytInput,
                        erfaringsniveau: e.target.value as RytterInput['erfaringsniveau'],
                      })
                    }
                    className="w-full h-[42px] px-2.5 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                  >
                    <option value="Begynder">Begynder</option>
                    <option value="Letoevet">Letøvet</option>
                    <option value="Oevet">Øvet</option>
                  </select>
                </Felt>
              </div>

              <div className="border-t border-stone-100 pt-3">
                <h3 className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
                  Kontaktperson & Forældre
                </h3>
                <div className="space-y-3">
                  <Felt label="Kontaktperson navn *">
                    <Input
                      required
                      value={nytInput.kontaktperson_navn}
                      onChange={(e) => setNytInput({ ...nytInput, kontaktperson_navn: e.target.value })}
                      placeholder="Forælder / værge"
                    />
                  </Felt>
                  <div className="grid grid-cols-2 gap-3">
                    <Felt label="Telefon *">
                      <Input
                        required
                        value={nytInput.kontakt_telefon}
                        onChange={(e) => setNytInput({ ...nytInput, kontakt_telefon: e.target.value })}
                        placeholder="+45 12 34 56 78"
                      />
                    </Felt>
                    <Felt label="E-mail *">
                      <Input
                        type="email"
                        required
                        value={nytInput.kontakt_email}
                        onChange={(e) => setNytInput({ ...nytInput, kontakt_email: e.target.value })}
                        placeholder="kontakt@eksempel.dk"
                      />
                    </Felt>
                  </div>
                </div>
              </div>

              <div className="border-t border-stone-100 pt-3">
                <Felt label="Eventuel fast parthest">
                  <select
                    value={nytInput.partaftale_hest_id ?? ''}
                    onChange={(e) =>
                      setNytInput({
                        ...nytInput,
                        partaftale_hest_id: e.target.value ? e.target.value : null,
                      })
                    }
                    className="w-full h-[42px] px-2.5 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                  >
                    <option value="">Ingen partaftale</option>
                    {(heste.data ?? [])
                      .filter((h) => h.aktiv)
                      .map((h) => (
                        <option key={h.id} value={h.id}>
                          🐎 {h.navn}
                        </option>
                      ))}
                  </select>
                </Felt>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setVisOpretModal(false)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-stone-600 hover:bg-stone-100 transition cursor-pointer"
                >
                  Afbryd
                </button>
                <button
                  type="submit"
                  disabled={opretRytter.isPending}
                  className="px-5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  {opretRytter.isPending ? 'Opretter...' : 'Opret rytter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Bekræft Sletning */}
      {rytterTilSletning && (
        <div className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-lg font-bold text-stone-900">
              Slet eller opsig rytter?
            </h2>
            <p className="text-sm text-stone-600">
              Er du sikker på, at du vil slette eller opsige{' '}
              <strong>
                {rytterTilSletning.fornavn} {rytterTilSletning.efternavn}
              </strong>
              ?
            </p>
            <p className="text-xs text-stone-500 bg-stone-50 p-3 rounded-lg border border-stone-200">
              ℹ️ Hvis rytteren allerede har lektionshistorik eller aktive holdtilmeldinger,
              vil eleven blive markeret som <strong>Opsagt</strong> for at bevare det kommunale
              revisionsspor og fremmødehistorik. Hvis eleven ikke har lektioner, slettes eleven helt.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setRytterTilSletning(null)}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-stone-600 hover:bg-stone-100 transition cursor-pointer"
              >
                Annullér
              </button>
              <button
                type="button"
                onClick={haandterSletBekraeftet}
                disabled={sletRytter.isPending}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold shadow-sm transition disabled:opacity-50 cursor-pointer"
              >
                {sletRytter.isPending ? 'Arbejder...' : 'Bekræft handling'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
