import type { ReactNode } from 'react';

/** Small accessible primitives shared by the cyberpunk panels. */

export function Toggle({ label, icon, checked, onChange, hint }: { label: string; icon?: ReactNode; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="cp-toggle" title={hint}>
      {icon && <span className="cp-toggle__icon">{icon}</span>}
      <span className="cp-toggle__label">{label}</span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="cp-toggle__track" aria-hidden="true">
        <span />
      </span>
    </label>
  );
}

export function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="cp-seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className={value === o.value ? 'is-active' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Slider({ label, value, min = 0, max = 1, step = 0.01, onChange, left, right, disabled }: { label: string; value: number; min?: number; max?: number; step?: number; onChange: (v: number) => void; left?: string; right?: string; disabled?: boolean }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className={`cp-slider${disabled ? ' is-disabled' : ''}`}>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        style={{ ['--pct' as string]: `${pct}%` }}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {(left || right) && (
        <div className="cp-slider__ends">
          <span>{left}</span>
          <span>{right}</span>
        </div>
      )}
    </div>
  );
}

export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="cp-section">
      <header>
        <h3>{title}</h3>
        {aside}
      </header>
      {children}
    </section>
  );
}

export function SimTag({ compact }: { compact?: boolean }) {
  return <span className={`cp-simtag${compact ? ' cp-simtag--compact' : ''}`}>Simulated</span>;
}
