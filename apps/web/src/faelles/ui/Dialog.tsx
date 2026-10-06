import { useEffect, useId, useRef, type ReactNode } from 'react';

/** Modal dialog bygget på <dialog>: showModal giver fokusfælde, og Esc lukker. */
export function Dialog({
  aaben,
  titel,
  onLuk,
  children,
}: {
  aaben: boolean;
  titel: string;
  onLuk: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titelId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    // jsdom (komponenttests) mangler showModal/close, så der faldes tilbage til open-attributten.
    if (aaben && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    } else if (!aaben && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
  }, [aaben]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titelId}
      onClose={onLuk}
      className="m-auto w-full max-w-2xl rounded-lg p-0 shadow-xl backdrop:bg-black/40"
    >
      <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
        <h2 id={titelId} className="text-lg font-semibold">
          {titel}
        </h2>
        <button
          type="button"
          onClick={onLuk}
          aria-label="Luk"
          className="rounded px-2 text-2xl leading-none text-stone-700 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-emerald-700"
        >
          ×
        </button>
      </div>
      <div className="px-6 py-4">{children}</div>
    </dialog>
  );
}
