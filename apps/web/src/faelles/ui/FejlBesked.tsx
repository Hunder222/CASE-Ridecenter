import { ApiFejl } from '../api-klient';

export function FejlBesked({ fejl }: { fejl: unknown }) {
  if (!fejl) return null;
  const besked = fejl instanceof Error ? fejl.message : 'Der opstod en fejl';
  const detaljer = fejl instanceof ApiFejl ? fejl.detaljer : [];

  return (
    <div role="alert" className="rounded border border-red-300 bg-red-50 px-4 py-3 text-red-900">
      <p className="font-medium">{besked}</p>
      {detaljer.length > 0 && (
        <ul className="mt-1 list-disc pl-5 text-sm">
          {detaljer.map((detalje) => (
            <li key={detalje}>{detalje}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
