import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';

export function Tabel({ titel, children }: { titel?: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-stone-300 bg-white">
      <table className="w-full border-collapse text-left text-base">
        {titel && <caption className="px-4 py-2 text-left text-lg font-semibold">{titel}</caption>}
        {children}
      </table>
    </div>
  );
}

export function Th({ className = '', ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={`border-b border-stone-300 bg-stone-100 px-4 py-2 font-semibold ${className}`}
      {...rest}
    />
  );
}

export function Td({ className = '', ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={`border-b border-stone-200 px-4 py-2 align-top ${className}`} {...rest} />;
}
