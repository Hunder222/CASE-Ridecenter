/** Stabil JSON: objektnøgler sorteres rekursivt, så samme indhold altid giver samme tekst og hash. */
export function kanoniskJson(vaerdi: unknown): string {
  return JSON.stringify(sorter(vaerdi));
}

function sorter(vaerdi: unknown): unknown {
  if (Array.isArray(vaerdi)) return vaerdi.map(sorter);
  if (vaerdi instanceof Date) return vaerdi.toISOString();
  if (vaerdi !== null && typeof vaerdi === 'object') {
    const objekt = vaerdi as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(objekt)
        .sort()
        .map((noegle) => [noegle, sorter(objekt[noegle])]),
    );
  }
  return vaerdi;
}
