export type LoadingVariant = 'cyber' | 'twin' | 'neutral';

interface LoadingScreenProps {
  variant: LoadingVariant;
  label: string;
  /** 0–1. Omit for an indeterminate bar. */
  progress?: number;
  detail?: string;
}

export function LoadingScreen({ variant, label, progress, detail }: LoadingScreenProps) {
  const determinate = typeof progress === 'number';
  return (
    <div className={`loading loading--${variant}`} role="status" aria-live="polite">
      <div className="loading__inner">
        <div className="loading__label">{label}</div>
        <div className={`loading__bar ${determinate ? '' : 'loading__bar--indeterminate'}`}>
          <span style={determinate ? { transform: `scaleX(${Math.max(0.02, progress!)})` } : undefined} />
        </div>
        {detail && <div className="loading__detail">{detail}</div>}
      </div>
    </div>
  );
}
