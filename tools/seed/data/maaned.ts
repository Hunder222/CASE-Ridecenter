// Små hjælpere til månedsnøgler 'YYYY-MM' (rene strengoperationer, ingen tidszoner).

export function forrigeMaaned(maaned: string): string {
  const [aar, md] = maaned.split('-').map(Number) as [number, number];
  return md === 1 ? `${aar - 1}-12` : `${aar}-${String(md - 1).padStart(2, '0')}`;
}

export function foersteDag(maaned: string): string {
  return `${maaned}-01`;
}
