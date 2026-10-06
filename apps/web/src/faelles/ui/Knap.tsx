import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primaer' | 'sekundaer' | 'fare';

const stil: Record<Variant, string> = {
  primaer: 'bg-emerald-800 text-white hover:bg-emerald-900',
  sekundaer: 'border border-stone-400 bg-white text-stone-900 hover:bg-stone-100',
  fare: 'bg-red-700 text-white hover:bg-red-800',
};

export function Knap({
  variant = 'primaer',
  className = '',
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type={type}
      className={`rounded px-4 py-2 text-base font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 ${stil[variant]} ${className}`}
      {...rest}
    />
  );
}
