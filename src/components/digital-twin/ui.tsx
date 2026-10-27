import type { ReactNode } from 'react';

/** Small primitives for the twin's light, GIS-style interface. */

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

export function KV({ k, children, mono }: { k: ReactNode; children: ReactNode; mono?: boolean }) {
  return (
    <div className="tw-kv">
      <dt>{k}</dt>
      <dd className={mono ? 'is-mono' : ''}>{children}</dd>
    </div>
  );
}
