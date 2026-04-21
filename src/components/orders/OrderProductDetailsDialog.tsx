'use client';

import { useMemo, useState } from 'react';

type Props = {
  status: string;
  itemTitles: string[];
  productDetails?: string[];
  fallbackDetails?: string;
  buttonLabel: string;
  titleLabel: string;
  productLabel: string;
  closeLabel: string;
};

export function OrderProductDetailsDialog({
  status,
  itemTitles,
  productDetails,
  fallbackDetails,
  buttonLabel,
  titleLabel,
  productLabel,
  closeLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(0);

  const detailsByItem = useMemo(() => {
    const filled = itemTitles.map((_, idx) => productDetails?.[idx] ?? '');
    if (filled.some(Boolean)) return filled;
    if (fallbackDetails) filled[0] = fallbackDetails;
    return filled;
  }, [itemTitles, productDetails, fallbackDetails]);

  const isRefunded = status === 'refunded';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`mt-4 inline-flex rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${
          isRefunded
            ? 'border-edge bg-surface-elevated/70 text-muted opacity-70'
            : 'border-brand-orange/35 text-brand-orange hover:bg-brand-orange/10'
        }`}
      >
        {buttonLabel}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xl rounded-3xl border border-edge bg-surface p-5">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-foreground">{titleLabel}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-edge px-3 py-1 text-xs text-muted"
              >
                {closeLabel}
              </button>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              {itemTitles.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelected(idx)}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    selected === idx
                      ? 'border-brand-orange/40 bg-brand-orange/15 text-brand-orange'
                      : 'border-edge text-muted'
                  }`}
                >
                  {productLabel} {idx + 1}
                </button>
              ))}
            </div>

            <div className="rounded-2xl border border-edge bg-surface-elevated p-4">
              <p className="text-sm font-semibold text-foreground">{itemTitles[selected] ?? '-'}</p>
              <p className="mt-2 whitespace-pre-line text-sm text-muted">
                {detailsByItem[selected] || '-'}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
