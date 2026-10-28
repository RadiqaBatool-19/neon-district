import { useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';

/** Small primitives for the twin's light, GIS-style interface. */

const TIP_WIDTH = 240;

/**
 * ⓘ button with an explanation that opens on hover, keyboard focus or tap.
 * Rendered in a portal with fixed positioning so scrolling side panels never clip it.
 */
export function InfoTip({ children, label = 'More information' }: { children: ReactNode; label?: string }) {
  const id = useId();
  const ref = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; above: boolean } | null>(null);
  const pointer = useRef('');

  const show = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.min(Math.max(8, r.left + r.width / 2 - TIP_WIDTH / 2), window.innerWidth - TIP_WIDTH - 8);
    const above = r.bottom + 140 > window.innerHeight;
    setPos({ left, top: above ? r.top - 6 : r.bottom + 6, above });
  };
  const hide = () => setPos(null);

  return (
    <>
      <button
        ref={ref}
        type="button"
        className="tw-info"
        aria-label={label}
        aria-describedby={pos ? id : undefined}
        aria-expanded={pos !== null}
        // Hover only for mice and focus only for keyboards; a tap is handled by the click toggle alone.
        onPointerEnter={(e) => e.pointerType === 'mouse' && show()}
        onPointerLeave={(e) => e.pointerType === 'mouse' && hide()}
        onFocus={(e) => e.currentTarget.matches(':focus-visible') && show()}
        onBlur={hide}
        onPointerDown={(e) => (pointer.current = e.pointerType)}
        onClick={(e) => {
          e.preventDefault();
          // Mice already opened it on hover; touch and pen toggle it.
          if (pointer.current === 'mouse') return;
          if (pos) hide();
          else show();
        }}
        onKeyDown={(e) => e.key === 'Escape' && pos && (e.stopPropagation(), hide())}
      >
        <Info size={12} />
      </button>
      {pos &&
        createPortal(
          <div id={id} role="tooltip" className={`tw-tip${pos.above ? ' is-above' : ''}`} style={{ left: pos.left, top: pos.top, width: TIP_WIDTH }}>
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}

export function Panel({ title, icon, children, aside, className = '' }: { title: string; icon?: ReactNode; children: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <section className={`tw-card ${className}`}>
      <header className="tw-card__head">
        <h2>
          {icon}
          {title}
        </h2>
        {aside}
      </header>
      {children}
    </section>
  );
}

export function Check({ label, checked, onChange, disabled, swatch, count }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; swatch?: string; count?: number }) {
  return (
    <label className={`tw-check${disabled ? ' is-disabled' : ''}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {swatch && <span className="tw-swatch" style={{ background: swatch }} />}
      <span className="tw-check__label">{label}</span>
      {count !== undefined && <span className="tw-count">{count}</span>}
    </label>
  );
}

export function Seg<T extends string | number>({ label, value, options, onChange, disabled }: { label: string; value: T; options: { value: T; label: ReactNode; title?: string }[]; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <div className={`tw-seg${disabled ? ' is-disabled' : ''}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" role="radio" aria-checked={o.value === value} title={o.title} disabled={disabled} className={o.value === value ? 'is-active' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SimBadge({ children = 'Simulated' }: { children?: ReactNode }) {
  return <span className="tw-sim">{children}</span>;
}

export function SourceBadge({ source }: { source: 'recorded' | 'estimated_from_levels' | 'estimated_default' }) {
  const text = source === 'recorded' ? 'Recorded' : source === 'estimated_from_levels' ? 'Estimated · levels' : 'Estimated · default';
  return <span className={`tw-src tw-src--${source}`}>{text}</span>;
}

export function KV({ k, children, mono, info }: { k: ReactNode; children: ReactNode; mono?: boolean; info?: ReactNode }) {
  return (
    <div className="tw-kv">
      <dt>
        {k}
        {info && <InfoTip label={`About ${typeof k === 'string' ? k.toLowerCase() : 'this value'}`}>{info}</InfoTip>}
      </dt>
      <dd className={mono ? 'is-mono' : ''}>{children}</dd>
    </div>
  );
}
