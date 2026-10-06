import type { Sikkerhedsprofil, SikkerhedsprofilInput } from '@ridecenter/contracts';
import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { FejlBesked } from '../../faelles/ui/FejlBesked';
import { Afkrydsning, Felt, Input, Tekstomraade } from '../../faelles/ui/Felt';
import { Indlaeser } from '../../faelles/ui/Indlaeser';
import { Knap } from '../../faelles/ui/Knap';
import { useGemSikkerhedsprofil, useHeste, useRytter, useSikkerhedsprofil } from '../api/stamdata';

type Liste = 'forbudte_heste' | 'paakraevede_heste';

function ProfilFormular({ rytterId, profil }: { rytterId: string; profil: Sikkerhedsprofil }) {
  const heste = useHeste();
  const gem = useGemSikkerhedsprofil(rytterId);
  const [gemt, setGemt] = useState(false);
  const [data, setData] = useState<SikkerhedsprofilInput>(() => ({
    faldtraume_note: profil.faldtraume_note,
    angstkategori: profil.angstkategori,
    intern_note: profil.intern_note,
    forbudte_heste: profil.forbudte_heste,
    paakraevede_heste: profil.paakraevede_heste,
    kun_rolige_heste: profil.kun_rolige_heste,
  }));
  const opdater = (aendring: Partial<SikkerhedsprofilInput>) => {
    setGemt(false);
    setData((d) => ({ ...d, ...aendring }));
  };
  const skift = (liste: Liste, hestId: string) =>
    opdater({
      [liste]: data[liste].includes(hestId)
        ? data[liste].filter((id) => id !== hestId)
        : [...data[liste], hestId],
    });
  const tekst = (vaerdi: string) => (vaerdi.trim() === '' ? null : vaerdi);

  function indsend(event: FormEvent) {
    event.preventDefault();
    gem.mutate(data, { onSuccess: () => setGemt(true) });
  }

  const hesteliste = (liste: Liste, modsat: Liste, titel: string) => (
    <fieldset className="rounded border border-stone-300 p-3">
      <legend className="px-1 font-medium">{titel}</legend>
      <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
        {(heste.data ?? []).map((h) => (
          <Afkrydsning
            key={h.id}
            label={h.navn}
            checked={data[liste].includes(h.id)}
            disabled={data[modsat].includes(h.id)}
            onChange={() => skift(liste, h.id)}
          />
        ))}
      </div>
    </fieldset>
  );

  return (
    <form onSubmit={indsend} className="max-w-4xl space-y-4">
      {hesteliste('forbudte_heste', 'paakraevede_heste', 'Forbudte heste')}
      {hesteliste('paakraevede_heste', 'forbudte_heste', 'Påkrævede heste (rytteren må kun få disse)')}
      <Afkrydsning
        label="Kun rolige heste"
        checked={data.kun_rolige_heste}
        onChange={(e) => opdater({ kun_rolige_heste: e.target.checked })}
      />
      <Felt label="Faldtraume">
        <Tekstomraade
          value={data.faldtraume_note ?? ''}
          onChange={(e) => opdater({ faldtraume_note: tekst(e.target.value) })}
        />
      </Felt>
      <Felt label="Angstkategori">
        <Input
          value={data.angstkategori ?? ''}
          onChange={(e) => opdater({ angstkategori: tekst(e.target.value) })}
        />
      </Felt>
      <Felt label="Intern note">
        <Tekstomraade
          value={data.intern_note ?? ''}
          onChange={(e) => opdater({ intern_note: tekst(e.target.value) })}
        />
      </Felt>
      <FejlBesked fejl={gem.error} />
      {gemt && (
        <p role="status" className="text-emerald-900">
          Sikkerhedsprofilen er gemt.
        </p>
      )}
      <Knap type="submit" disabled={gem.isPending}>
        Gem
      </Knap>
    </form>
  );
}

/** Sikkerhedsprofil (GDPR art. 9, kun Ledelse, T093). Intet gemmes i browserens lager. */
export function SikkerhedsprofilSide() {
  const { id = '' } = useParams();
  const rytter = useRytter(id);
  const profil = useSikkerhedsprofil(id);
  return (
    <section className="space-y-4">
      <Link to={`/admin/ryttere/${id}`} className="text-emerald-800 underline">
        ← Tilbage til rytteren
      </Link>
      <h1 className="text-2xl font-semibold">
        Sikkerhedsprofil{rytter.data ? ` – ${rytter.data.fornavn} ${rytter.data.efternavn}` : ''}
      </h1>
      <p role="note" className="rounded border border-amber-400 bg-amber-50 px-4 py-3 text-amber-900">
        Følsomme oplysninger (GDPR art. 9). Din visning er logget.
      </p>
      <FejlBesked fejl={profil.error} />
      {profil.isPending && <Indlaeser />}
      {profil.data && <ProfilFormular key={id} rytterId={id} profil={profil.data} />}
    </section>
  );
}
