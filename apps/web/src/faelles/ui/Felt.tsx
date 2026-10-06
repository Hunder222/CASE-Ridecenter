import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

export const feltStil =
  'mt-1 block w-full rounded border border-stone-400 bg-white px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-emerald-700';

/** Label over et felt. */
export function Felt({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}

export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${feltStil} ${className}`} {...rest} />;
}

export function Valg({ className = '', ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${feltStil} ${className}`} {...rest} />;
}

export function Tekstomraade({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} className={`${feltStil} ${className}`} {...rest} />;
}

/** Afkrydsning. En evt. hjælpetekst knyttes med aria-describedby, så den ikke bliver en del af navnet. */
export function Afkrydsning({
  label,
  hjaelp,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: string; hjaelp?: string }) {
  const hjaelpId = useId();
  return (
    <div>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          className="h-5 w-5 accent-emerald-800"
          aria-describedby={hjaelp ? hjaelpId : undefined}
          {...rest}
        />
        <span className="font-medium">{label}</span>
      </label>
      {hjaelp && (
        <p id={hjaelpId} className="ml-7 text-sm text-stone-700">
          {hjaelp}
        </p>
      )}
    </div>
  );
}
