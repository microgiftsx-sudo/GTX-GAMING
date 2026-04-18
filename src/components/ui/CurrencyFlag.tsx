import React from 'react';

export type CurrencyCode = 'IQD' | 'USD' | 'EUR';

type FlagSvgProps = { className?: string };

/**
 * Iraq — red / white / black + green Kufic «الله أكبر» on the white stripe
 * (Yemen uses the same tricolor without this script).
 */
function FlagIraq({ className }: FlagSvgProps) {
  return (
    <svg
      viewBox="0 0 30 20"
      className={className}
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="30" height="6.67" fill="#CE1126" />
      <rect y="6.67" width="30" height="6.67" fill="#FFFFFF" />
      <rect y="13.34" width="30" height="6.66" fill="#000000" />
      {/* Takbīr: foreignObject + flex centers Arabic reliably (SVG <text> + RTL often mis-anchors). */}
      <foreignObject x="0" y="6.67" width="30" height="6.67">
        <div
          className="flex h-full w-full items-center justify-center p-0 font-bold leading-none text-[#007A3D] [font-family:var(--font-tajawal),Tahoma,sans-serif]"
          style={{
            direction: 'rtl',
            unicodeBidi: 'isolate',
            fontSize: '3.7px',
            lineHeight: 1,
            textAlign: 'center',
          }}
          lang="ar"
          // XHTML namespace for foreignObject (React omits xmlns on DOM)
          {...({ xmlns: 'http://www.w3.org/1999/xhtml' } as object)}
        >
          الله أكبر
        </div>
      </foreignObject>
    </svg>
  );
}

/** USA — 13 stripes + simplified blue canton with star dots. */
function FlagUsa({ className }: FlagSvgProps) {
  const sh = 30 / 13;
  const cantonH = 7 * sh;
  return (
    <svg
      viewBox="0 0 57 30"
      className={className}
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      {Array.from({ length: 13 }).map((_, i) => (
        <rect
          key={i}
          y={i * sh}
          width="57"
          height={sh}
          fill={i % 2 === 0 ? '#B22234' : '#FFFFFF'}
        />
      ))}
      <rect width="24" height={cantonH} fill="#3C3B6E" />
      {[
        [3, 3],
        [6, 3],
        [9, 3],
        [4.5, 5.5],
        [7.5, 5.5],
        [3, 8],
        [6, 8],
        [9, 8],
      ].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="0.9" fill="#FFFFFF" />
      ))}
    </svg>
  );
}

/** European Union — blue field + ring of yellow stars. */
function FlagEu({ className }: FlagSvgProps) {
  const stars = Array.from({ length: 12 }, (_, i) => {
    const a = (i * Math.PI * 2) / 12 - Math.PI / 2;
    const cx = 30 + 11 * Math.cos(a);
    const cy = 20 + 11 * Math.sin(a);
    return (
      <path
        key={i}
        fill="#FFCC00"
        d="M0,-2.2 L0.65,-0.68 L2.2,-0.68 L0.95,0.35 L1.4,1.85 L0,0.9 L-1.4,1.85 L-0.95,0.35 L-2.2,-0.68 L-0.65,-0.68 Z"
        transform={`translate(${cx},${cy}) scale(0.55)`}
      />
    );
  });
  return (
    <svg
      viewBox="0 0 60 40"
      className={className}
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="60" height="40" fill="#003399" />
      {stars}
    </svg>
  );
}

const FLAGS: Record<CurrencyCode, React.FC<FlagSvgProps>> = {
  IQD: FlagIraq,
  USD: FlagUsa,
  EUR: FlagEu,
};

type Props = {
  code: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
};

const sizeClass: Record<NonNullable<Props['size']>, string> = {
  sm: 'h-3.5 w-[1.4rem] sm:h-4 sm:w-6',
  md: 'h-4 w-6',
  lg: 'h-5 w-7',
};

export default function CurrencyFlag({ code, className = '', size = 'md' }: Props) {
  const Flag = FLAGS[code as CurrencyCode];
  if (!Flag) {
    return (
      <span
        className={`inline-flex h-4 w-6 shrink-0 items-center justify-center rounded border border-edge bg-white/10 text-[10px] font-bold text-muted ${className}`}
        aria-hidden
      >
        ?
      </span>
    );
  }
  return (
    <Flag
      className={`shrink-0 overflow-hidden rounded-[2px] shadow-sm ring-1 ring-black/20 ${sizeClass[size]} ${className}`}
    />
  );
}
