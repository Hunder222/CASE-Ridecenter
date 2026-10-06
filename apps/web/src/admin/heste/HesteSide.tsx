import type { Hest, HestInput } from '@ridecenter/contracts';
import { useState, type FormEvent } from 'react';
import { harRolle, useSession } from '../../faelles/session';
import { Dialog } from '../../faelles/ui/Dialog';
import { FejlBesked } from '../../faelles/ui/FejlBesked';
import { Afkrydsning, Felt, Input, Tekstomraade, Valg } from '../../faelles/ui/Felt';
import { Indlaeser } from '../../faelles/ui/Indlaeser';
import { Knap } from '../../faelles/ui/Knap';
import { Tabel, Td, Th } from '../../faelles/ui/Tabel';
import { useHeste, useOpdaterHest, useOpretHest } from '../api/stamdata';

export const UGEDAGE = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag'];
const SUNDHED: Record<Hest['sundhedsstatus'], string> = {
  Aktiv: 'Aktiv',
  Sygemeldt: 'Sygemeldt',
  Skadet: 'Skadet',
  Karantaene: 'Karantæne',
};
const jaNej = (vaerdi: boolean) => (vaerdi ? 'Ja' : 'Nej');

const NY_HEST: HestInput = {
  navn: '',
  stangmaal_cm: 140,
  max_rytter_vaegt_kg: 60,
  max_rytter_hoejde_cm: null,
  temperament: 'Normal',
  godkendt_til_begyndere: false,
  egnet_oevet: true,
  skaane: false,
  springforbud: false,
  hviledag: 1,
  staldnoter: '',
};

function tilInput(h: Hest): HestInput {
  return {
    navn: h.navn,
    stangmaal_cm: h.stangmaal_cm,
    max_rytter_vaegt_kg: h.max_rytter_vaegt_kg,
    max_rytter_hoejde_cm: h.max_rytter_hoejde_cm,
    temperament: h.temperament,
    godkendt_til_begyndere: h.godkendt_til_begyndere,
    egnet_oevet: h.egnet_oevet,
    skaane: h.skaane,
    springforbud: h.springforbud,
    hviledag: h.hviledag,
    staldnoter: h.staldnoter,
  };
}

function HestDialog({ id, start, onLuk }: { id: string | null; start: HestInput; onLuk: () => void }) {
  const [data, setData] = useState(start);
  const opret = useOpretHest();
  const opdater = useOpdaterHest();
  const saet = <K extends keyof HestInput>(felt: K, vaerdi: HestInput[K]) =>
    setData((d) => ({ ...d, [felt]: vaerdi }));

  async function gem(event: FormEvent) {
    event.preventDefault();
    try {
      if (id) await opdater.mutateAsync({ id, aendring: data });
      else await opret.mutateAsync(data);
      onLuk();
    } catch {
      // Fejlen vises af FejlBesked.
    }
  }

  return (
    <Dialog aaben titel={id ? `Redigér ${start.navn}` : 'Opret hest'} onLuk={onLuk}>
      <form onSubmit={gem} className="grid grid-cols-2 gap-4">
        <Felt label="Navn">
          <Input value={data.navn} onChange={(e) => saet('navn', e.target.value)} required />
        </Felt>
        <Felt label="Stangmål (cm)">
          <Input
            type="number"
            min={80}
            max={190}
            value={data.stangmaal_cm}
            onChange={(e) => saet('stangmaal_cm', Number(e.target.value))}
            required
          />
        </Felt>
        <Felt label="Max ryttervægt (kg)">
          <Input
            type="number"
            min={1}
            value={data.max_rytter_vaegt_kg}
            onChange={(e) => saet('max_rytter_vaegt_kg', Number(e.target.value))}
            required
          />
        </Felt>
        <Felt label="Max rytterhøjde (cm, tom = ingen grænse)">
          <Input
            type="number"
            min={1}
            value={data.max_rytter_hoejde_cm ?? ''}
            onChange={(e) =>
              saet('max_rytter_hoejde_cm', e.target.value === '' ? null : Number(e.target.value))
            }
          />
        </Felt>
        <Felt label="Temperament">
          <Valg
            value={data.temperament}
            onChange={(e) => saet('temperament', e.target.value as HestInput['temperament'])}
          >
            <option>Rolig</option>
            <option>Normal</option>
            <option>Frisk</option>
          </Valg>
        </Felt>
        <Felt label="Hviledag">
          <Valg value={data.hviledag} onChange={(e) => saet('hviledag', Number(e.target.value))}>
            {UGEDAGE.map((navn, i) => (
              <option key={navn} value={i + 1}>
                {navn}
              </option>
            ))}
          </Valg>
        </Felt>
        <Afkrydsning
          label="Godkendt til begyndere"
          checked={data.godkendt_til_begyndere}
          onChange={(e) => saet('godkendt_til_begyndere', e.target.checked)}
        />
        <Afkrydsning
          label="Egnet til øvet"
          checked={data.egnet_oevet}
          onChange={(e) => saet('egnet_oevet', e.target.checked)}
        />
        <Afkrydsning
          label="Skånehest"
          checked={data.skaane}
          onChange={(e) => saet('skaane', e.target.checked)}
        />
        <Afkrydsning
          label="Springforbud"
          checked={data.springforbud}
          onChange={(e) => saet('springforbud', e.target.checked)}
        />
        <div className="col-span-2">
          <Felt label="Staldnoter">
            <Tekstomraade
              maxLength={500}
              value={data.staldnoter}
              onChange={(e) => saet('staldnoter', e.target.value)}
            />
          </Felt>
        </div>
        <p className="col-span-2 text-sm text-stone-700">
          Afledt af serveren: højst {data.skaane ? 2 : 3} hold om dagen og {data.springforbud ? 0 : 1}{' '}
          springhold om ugen.
        </p>
        <div className="col-span-2">
          <FejlBesked fejl={opret.error ?? opdater.error} />
        </div>
        <div className="col-span-2 flex justify-end gap-2">
          <Knap variant="sekundaer" onClick={onLuk}>
            Annullér
          </Knap>
          <Knap type="submit" disabled={opret.isPending || opdater.isPending}>
            Gem
          </Knap>
        </div>
      </form>
    </Dialog>
  );
}

/** Heste (FR-001, F1.3, T091). Ledelse kan oprette og redigere, ridelærere kan se. */
export function HesteSide() {
  const { data: session } = useSession();
  const kanRedigere = harRolle(session, 'Ledelse');
  const heste = useHeste();
  const [redigerer, setRedigerer] = useState<{ id: string | null; data: HestInput } | null>(null);

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Heste</h1>
        {kanRedigere && (
          <Knap className="ml-auto" onClick={() => setRedigerer({ id: null, data: NY_HEST })}>
            Opret hest
          </Knap>
        )}
      </div>
      <FejlBesked fejl={heste.error} />
      {heste.isPending && <Indlaeser />}
      {heste.data && (
        <Tabel>
          <thead>
            <tr>
              <Th>Navn</Th>
              <Th>Stangmål</Th>
              <Th>Max vægt</Th>
              <Th>Max højde</Th>
              <Th>Temperament</Th>
              <Th>Godkendt til begyndere</Th>
              <Th>Egnet til øvet</Th>
              <Th>Skåne</Th>
              <Th>Springforbud</Th>
              <Th>Hviledag</Th>
              <Th>Sundhed</Th>
              {kanRedigere && (
                <Th>
                  <span className="sr-only">Handling</span>
                </Th>
              )}
            </tr>
          </thead>
          <tbody>
            {heste.data.map((h) => (
              <tr key={h.id}>
                <Td className="font-medium">{h.navn}</Td>
                <Td>{h.stangmaal_cm} cm</Td>
                <Td>{h.max_rytter_vaegt_kg} kg</Td>
                <Td>{h.max_rytter_hoejde_cm === null ? 'Ingen' : `${h.max_rytter_hoejde_cm} cm`}</Td>
                <Td>{h.temperament}</Td>
                <Td>{jaNej(h.godkendt_til_begyndere)}</Td>
                <Td>{jaNej(h.egnet_oevet)}</Td>
                <Td>{jaNej(h.skaane)}</Td>
                <Td>{jaNej(h.springforbud)}</Td>
                <Td>{UGEDAGE[h.hviledag - 1]}</Td>
                <Td>{SUNDHED[h.sundhedsstatus]}</Td>
                {kanRedigere && (
                  <Td>
                    <Knap variant="sekundaer" onClick={() => setRedigerer({ id: h.id, data: tilInput(h) })}>
                      Redigér
                    </Knap>
                  </Td>
                )}
              </tr>
            ))}
          </tbody>
        </Tabel>
      )}
      {redigerer && <HestDialog id={redigerer.id} start={redigerer.data} onLuk={() => setRedigerer(null)} />}
    </section>
  );
}
