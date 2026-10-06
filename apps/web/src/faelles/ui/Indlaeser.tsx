export function Indlaeser({ tekst = 'Indlæser…' }: { tekst?: string }) {
  return (
    <p role="status" aria-live="polite" className="flex items-center gap-2 text-stone-700">
      <span
        aria-hidden="true"
        className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-stone-400 border-t-transparent"
      />
      {tekst}
    </p>
  );
}
