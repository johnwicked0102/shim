import type { SVGProps } from 'react';

interface BikeProps extends SVGProps<SVGSVGElement> {
  /** Spin the wheels (decorative). */
  spinning?: boolean;
  fast?: boolean;
  title?: string;
}

function Wheel({ cx, cy, spinning, fast }: { cx: number; cy: number; spinning?: boolean; fast?: boolean }) {
  const spin = spinning ? (fast ? 'animate-wheel-fast' : 'animate-wheel') : '';
  return (
    <g>
      <circle cx={cx} cy={cy} r={10.5} fill="none" stroke="currentColor" strokeWidth={3.2} />
      <g className={spin} style={{ transformOrigin: `${cx}px ${cy}px`, transformBox: 'view-box' }}>
        <path
          d={`M${cx} ${cy - 8}V${cy + 8}M${cx - 8} ${cy}H${cx + 8}M${cx - 5.7} ${cy - 5.7}L${cx + 5.7} ${cy + 5.7}M${cx - 5.7} ${cy + 5.7}L${cx + 5.7} ${cy - 5.7}`}
          stroke="currentColor"
          strokeWidth={1.1}
          strokeLinecap="round"
          opacity={0.55}
        />
      </g>
      <circle cx={cx} cy={cy} r={2.2} fill="currentColor" />
    </g>
  );
}

/** Shim's original bicycle mark. Inherits colour from `currentColor`. */
export function Bike({ spinning, fast, title, ...rest }: BikeProps) {
  return (
    <svg viewBox="0 0 64 64" role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} {...rest}>
      {title && <title>{title}</title>}
      <Wheel cx={16} cy={42} spinning={spinning} fast={fast} />
      <Wheel cx={48} cy={42} spinning={spinning} fast={fast} />
      <g fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
        {/* frame */}
        <path d="M16 42 L30 42 L24 25 Z" />
        <path d="M24 25 H42 L30 42" />
        <path d="M42 25 L48 42" />
        {/* handlebar */}
        <path d="M42 25 L40 18.5 H45.5" />
        {/* saddle */}
        <path d="M20 21.5 H28" strokeWidth={3.8} />
        <path d="M24 21.5 V25" />
      </g>
      {/* pedal */}
      <circle cx={30} cy={42} r={2.6} fill="currentColor" />
    </svg>
  );
}

/** The Shim wordmark: bicycle badge + rounded wordmark. */
export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <Bike className="h-12 w-12 shrink-0 text-ink dark:text-cream" />
      {!compact && (
        <span className="leading-none">
          {/* The dot over the "i" is a little peach wheel. */}
          <span className="block text-[1.45rem] font-extrabold tracking-tight" role="img" aria-label="Shim">
            <span aria-hidden>
              Sh
              <span className="relative inline-block">
                {'ı'}
                <span className="absolute left-1/2 top-[0.02em] h-[0.26em] w-[0.26em] -translate-x-1/2 rounded-full border-[0.07em] border-peach-deep bg-peach" />
              </span>
              m
            </span>
          </span>
          <span className="mt-0.5 hidden text-[0.7rem] font-semibold text-muted sm:block">Small Lists, Smooth Rides.</span>
        </span>
      )}
    </span>
  );
}
