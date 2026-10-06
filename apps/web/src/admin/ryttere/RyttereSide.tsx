import type { Rytter } from '@ridecenter/contracts';
import { useState } from 'react';
import { Link } from 'react-router';
import { FejlBesked } from '../../faelles/ui/FejlBesked';
import { Felt, Input } from '../../faelles/ui/Felt';
import { Indlaeser } from '../../faelles/ui/Indlaeser';
import { Tabel, Td, Th } from '../../faelles/ui/Tabel';
import { useHeste, useRyttere } from '../api/stamdata';

export const NIVEAU: Record<Rytter['erfaringsniveau'], string> = {
  Begynder: 'Begynder',
  Letoevet: 'Letøvet',
  Oevet: 'Øvet',
};

/** Ryttere (kun Ledelse, T092) med søgning. */
export function RyttereSide() {
  const ryttere = useRyttere();
  const heste = useHeste();
  const [soegning, setSoegning] = useState('');
  const hesteNavne = new Map((heste.data ?? []).map((h) => [h.id, h.navn]));
  const viste = (ryttere.data ?? []).filter((r) =>
    `${r.fornavn} ${r.efternavn}`.toLowerCase().includes(soegning.trim().toLowerCase()),
  );

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Ryttere</h1>
      <div className="max-w-sm">
        <Felt label="Søg efter navn">
          <Input type="search" value={soegning} onChange={(e) => setSoegning(e.target.value)} />
        </Felt>
      </div>
      <FejlBesked fejl={ryttere.error} />
      {ryttere.isPending && <Indlaeser />}
      {ryttere.data && (
        <Tabel>
          <thead>
            <tr>
              <Th>Navn</Th>
              <Th>Niveau</Th>
              <Th>Partaftale</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {viste.map((r) => (
              <tr key={r.id}>
                <Td>
                  <Link to={`/admin/ryttere/${r.id}`} className="text-emerald-800 underline">
                    {r.fornavn} {r.efternavn}
                  </Link>
                </Td>
                <Td>{NIVEAU[r.erfaringsniveau]}</Td>
                <Td>
                  {r.partaftale_hest_id
                    ? `${hesteNavne.get(r.partaftale_hest_id) ?? 'Ukendt hest'}${
                        r.partaftale_godkendt_trods_niveau ? ' (godkendt trods niveau)' : ''
                      }`
                    : '—'}
                </Td>
                <Td>{r.aktiv_status}</Td>
              </tr>
            ))}
          </tbody>
        </Tabel>
      )}
    </section>
  );
}
