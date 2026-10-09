import type { Rytter, RytterInput } from '@ridecenter/contracts';
import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { FejlBesked } from '../../faelles/ui/FejlBesked';
import { Afkrydsning, Felt, Input, Valg } from '../../faelles/ui/Felt';
import { Indlaeser } from '../../faelles/ui/Indlaeser';
import { Knap } from '../../faelles/ui/Knap';
import { useHeste, useOpdaterRytter, useRytter } from '../api/stamdata';
import { NIVEAU } from './RyttereSide';

function tilInput(r: Rytter): RytterInput {
  return {
    fornavn: r.fornavn,
    efternavn: r.efternavn,
    foedselsdato: r.foedselsdato,
    bopaelskommune: r.bopaelskommune,
    hoejde_cm: r.hoejde_cm,
    vaegt_kg: r.vaegt_kg,
    erfaringsniveau: r.erfaringsniveau,
    klar_til_udvikling: r.klar_til_udvikling,
    er_hjaelper: r.er_hjaelper,
    kontaktperson_navn: r.kontaktperson_navn,
    kontakt_telefon: r.kontakt_telefon,
    kontakt_email: r.kontakt_email,
    partaftale_hest_id: r.partaftale_hest_id,
    partaftale_godkendt_trods_niveau: r.partaftale_godkendt_trods_niveau,
  };
}

function RytterFormular({ rytter }: { rytter: Rytter }) {
  const [data, setData] = useState(() => tilInput(rytter));
  const [gemt, setGemt] = useState(false);
  const heste = useHeste();
  const opdater = useOpdaterRytter();
  const saet = <K extends keyof RytterInput>(felt: K, vaerdi: RytterInput[K]) => {
    setGemt(false);
    setData((d) => ({ ...d, [felt]: vaerdi }));
  };

  function gem(event: FormEvent) {
    event.preventDefault();
    opdater.mutate({ id: rytter.id, aendring: data }, { onSuccess: () => setGemt(true) });
  }

  return (
    <form onSubmit={gem} className="grid max-w-3xl grid-cols-2 gap-4">
      <Felt label="Fornavn">
        <Input value={data.fornavn} onChange={(e) => saet('fornavn', e.target.value)} required />
      </Felt>
      <Felt label="Efternavn">
        <Input value={data.efternavn} onChange={(e) => saet('efternavn', e.target.value)} required />
      </Felt>
      <Felt label="Fødselsdato">
        <Input
          type="date"
          value={data.foedselsdato}
          onChange={(e) => saet('foedselsdato', e.target.value)}
          required
        />
      </Felt>
      <Felt label="Bopælskommune">
        <Input
          value={data.bopaelskommune}
          onChange={(e) => saet('bopaelskommune', e.target.value)}
          required
        />
      </Felt>
      <Felt label="Højde (cm)">
        <Input
          type="number"
          min={80}
          max={210}
          value={data.hoejde_cm}
          onChange={(e) => saet('hoejde_cm', Number(e.target.value))}
        />
      </Felt>
      <Felt label="Vægt (kg)">
        <Input
          type="number"
          min={15}
          max={150}
          value={data.vaegt_kg}
          onChange={(e) => saet('vaegt_kg', Number(e.target.value))}
        />
      </Felt>
      <Felt label="Erfaringsniveau">
        <Valg
          value={data.erfaringsniveau}
          onChange={(e) => saet('erfaringsniveau', e.target.value as RytterInput['erfaringsniveau'])}
        >
          {Object.entries(NIVEAU).map(([vaerdi, navn]) => (
            <option key={vaerdi} value={vaerdi}>
              {navn}
            </option>
          ))}
        </Valg>
      </Felt>
      <Felt label="Kontaktperson">
        <Input value={data.kontaktperson_navn} onChange={(e) => saet('kontaktperson_navn', e.target.value)} />
      </Felt>
      <Felt label="Telefon">
        <Input value={data.kontakt_telefon} onChange={(e) => saet('kontakt_telefon', e.target.value)} />
      </Felt>
      <Felt label="E-mail">
        <Input
          type="email"
          value={data.kontakt_email}
          onChange={(e) => saet('kontakt_email', e.target.value)}
        />
      </Felt>
      <Afkrydsning
        label="Klar til udvikling"
        checked={data.klar_til_udvikling}
        onChange={(e) => saet('klar_til_udvikling', e.target.checked)}
      />
      <Afkrydsning
        label="Hjælper"
        checked={data.er_hjaelper}
        onChange={(e) => saet('er_hjaelper', e.target.checked)}
      />
      <div className="col-span-2 rounded-xl border border-stone-200 bg-stone-50 p-4 space-y-3">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-stone-600 block">
            Aktive partaftaler & påkrævede heste
          </span>
          <span className="text-xs text-stone-500">
            En elev kan have flere partsheste (f.eks. påkrævede heste fra sikkerhedsprofilen).
          </span>
        </div>
        {rytter.partaftale_hest_ids && rytter.partaftale_hest_ids.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {rytter.partaftale_hest_ids.map((hid) => {
              const hest = heste.data?.find((h) => h.id === hid);
              const erPaakraevet = (rytter.paakraevede_hest_ids ?? []).includes(hid) || rytter.har_paakraevet_hest;
              return (
                <span
                  key={hid}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300"
                >
                  <span>🐎 {hest?.navn ?? 'Parthest'}</span>
                  {erPaakraevet && (
                    <span
                      title="Påkrævet hest af hensyn til rytterens sikkerhedsprofil (partaftale)"
                      className="cursor-help text-amber-700 text-sm font-bold inline-flex items-center leading-none"
                    >
                      🔒
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-stone-500 italic">Ingen aktive partaftaler eller påkrævede heste.</p>
        )}
      </div>

      <Felt label="Primær parthest (eller tilføj part)">
        <Valg
          value={data.partaftale_hest_id ?? ''}
          onChange={(e) => saet('partaftale_hest_id', e.target.value === '' ? null : e.target.value)}
        >
          <option value="">Ingen partaftale</option>
          {(heste.data ?? [])
            .filter((h) => h.aktiv)
            .map((h) => (
              <option key={h.id} value={h.id}>
                {h.navn}
              </option>
            ))}
        </Valg>
      </Felt>
      <Afkrydsning
        label="Godkendt trods niveau"
        hjaelp="Gør det muligt at bruge parthesten på et hold, hesten ellers ikke er godkendt til (HC-08). Alle øvrige sikkerhedsregler gælder stadig."
        checked={data.partaftale_godkendt_trods_niveau}
        disabled={!data.partaftale_hest_id}
        onChange={(e) => saet('partaftale_godkendt_trods_niveau', e.target.checked)}
      />
      <div className="col-span-2">
        <FejlBesked fejl={opdater.error} />
        {gemt && (
          <p role="status" className="text-emerald-900">
            Ændringerne er gemt.
          </p>
        )}
      </div>
      <div className="col-span-2 flex gap-2">
        <Knap type="submit" disabled={opdater.isPending}>
          Gem
        </Knap>
      </div>
    </form>
  );
}

/** Rytterens stamdata og partaftale (kun Ledelse, T092). */
export function RytterDetaljeSide() {
  const { id } = useParams();
  const rytter = useRytter(id);
  return (
    <section className="space-y-4">
      <Link to="/admin/ryttere" className="text-emerald-800 underline">
        ← Alle ryttere
      </Link>
      <FejlBesked fejl={rytter.error} />
      {rytter.isPending && <Indlaeser />}
      {!rytter.isPending && !rytter.data && <p role="alert">Rytteren findes ikke.</p>}
      {rytter.data && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold">
              {rytter.data.fornavn} {rytter.data.efternavn}
            </h1>
            <Link
              to={`/admin/ryttere/${rytter.data.id}/sikkerhed`}
              className="ml-auto text-emerald-800 underline"
            >
              Sikkerhedsprofil
            </Link>
          </div>
          <RytterFormular key={rytter.data.id} rytter={rytter.data} />
        </>
      )}
    </section>
  );
}
