// Månedsnøgler 'YYYY-MM' i brugerens lokale tid (stalden og ledelsen er i Europe/Copenhagen).

export function maanedFra(dato: Date): string {
  return `${dato.getFullYear()}-${String(dato.getMonth() + 1).padStart(2, '0')}`;
}

export function naesteMaaned(nu = new Date()): string {
  return maanedFra(new Date(nu.getFullYear(), nu.getMonth() + 1, 1));
}

export function forskydMaaned(maaned: string, antal: number): string {
  const [aar, md] = maaned.split('-').map(Number) as [number, number];
  return maanedFra(new Date(aar, md - 1 + antal, 1));
}

export function maanedNavn(maaned: string): string {
  const [aar, md] = maaned.split('-').map(Number) as [number, number];
  return new Intl.DateTimeFormat('da-DK', { month: 'long', year: 'numeric' }).format(
    new Date(aar, md - 1, 1),
  );
}
