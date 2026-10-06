import type { ReactNode } from 'react';

export type BadgeVariant = 'ok' | 'advarsel' | 'fejl' | 'info' | 'neutral';

const farver: Record<BadgeVariant, string> = {
  ok: 'bg-emerald-100 text-emerald-900',
  advarsel: 'bg-amber-100 text-amber-900',
  fejl: 'bg-red-100 text-red-900',
  info: 'bg-sky-100 text-sky-900',
  neutral: 'bg-stone-200 text-stone-900',
};

export function Badge({
  variant = 'neutral',
  title,
  children,
}: {
  variant?: BadgeVariant;
  title?: string;
  children: ReactNode;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded px-2 py-0.5 text-sm font-medium ${farver[variant]}`}
    >
      {children}
    </span>
  );
}
