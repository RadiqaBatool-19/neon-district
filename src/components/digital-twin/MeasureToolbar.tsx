import { useEffect } from 'react';
import { LocateFixed, MousePointer2, Ruler, SquareDashed, Trash2 } from 'lucide-react';
import { formatArea, formatLength, formatLonLat, measureArea, measureDistance } from '../../data/digital-twin/measure';
import { useTwinStore, type MeasureTool } from '../../stores/twinStore';
import { isTypingTarget } from '../../utils/webgl';

const TOOLS: { id: MeasureTool; label: string; icon: JSX.Element; hint: string }[] = [
  { id: 'none', label: 'Inspect', icon: <MousePointer2 size={15} />, hint: 'Click buildings or roads to inspect' },
  { id: 'distance', label: 'Distance', icon: <Ruler size={15} />, hint: 'Click points along a path' },
  { id: 'area', label: 'Area', icon: <SquareDashed size={15} />, hint: 'Click vertices · Finish or Enter to close' },
  { id: 'probe', label: 'Point', icon: <LocateFixed size={15} />, hint: 'Click to read coordinates & elevation' },
];

function Result() {
  const tool = useTwinStore((s) => s.tool);
  const points = useTwinStore((s) => s.points);
  const closed = useTwinStore((s) => s.closed);

  if (tool === 'distance') {
    const d = measureDistance(points);
    if (!d) return <span className="tw-muted">{points.length ? 'Click the next point' : 'Click the first point'}</span>;
    return (
      <span>
        <b>{formatLength(d.totalM)}</b> horizontal (ellipsoidal)
        {d.slopeDistanceM !== null && <> · {formatLength(d.slopeDistanceM)} along surface</>}
        {d.elevationDeltaM !== null && <> · Δh {d.elevationDeltaM >= 0 ? '+' : ''}{d.elevationDeltaM.toFixed(1)} m</>}
      </span>
    );
  }
  if (tool === 'area') {
    const a = measureArea(points);
    if (!a) return <span className="tw-muted">{3 - points.length} more point{points.length === 2 ? '' : 's'} needed</span>;
    return (
      <span>
        <b>{formatArea(a.areaM2)}</b> · perimeter {formatLength(a.perimeterM)} {!closed && <span className="tw-muted">(open — finish to close)</span>}
      </span>
    );
  }
  if (tool === 'probe') {
    const p = points[0];
    if (!p) return <span className="tw-muted">Click anywhere on the model</span>;
    return (
      <span className="tw-mono">
        {formatLonLat(p.lon, p.lat)}
        {p.elevation !== null && <> · {p.elevation.toFixed(1)} m ASL</>}
      </span>
    );
  }
  return null;
}

export function MeasureToolbar() {
  const tool = useTwinStore((s) => s.tool);
  const setTool = useTwinStore((s) => s.setTool);
  const points = useTwinStore((s) => s.points);
  const closed = useTwinStore((s) => s.closed);
  const clear = useTwinStore((s) => s.clearMeasure);
  const close = useTwinStore((s) => s.closeShape);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const s = useTwinStore.getState();
      if (e.key === 'Escape') {
        if (s.points.length) s.clearMeasure();
        else if (s.tool !== 'none') s.setTool('none');
        else s.select(null);
      } else if (e.key === 'Enter' && s.tool === 'area') s.closeShape();
      else if (e.key === 'm' || e.key === 'M') s.setTool(s.tool === 'distance' ? 'none' : 'distance');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const current = TOOLS.find((t) => t.id === tool)!;

  return (
    <div className="tw-toolbar" role="toolbar" aria-label="Tools">
      <div className="tw-toolbar__tools">
        {TOOLS.map((t) => (
          <button key={t.id} type="button" className={tool === t.id ? 'is-active' : ''} aria-pressed={tool === t.id} onClick={() => setTool(t.id)} title={t.hint}>
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>
      {tool !== 'none' && (
        <div className="tw-toolbar__result">
          <Result />
          <div className="tw-toolbar__actions">
            {tool === 'area' && points.length >= 3 && !closed && (
              <button type="button" className="tw-btn tw-btn--small" onClick={close}>
                Finish
              </button>
            )}
            {points.length > 0 && (
              <button type="button" className="tw-icon-btn" onClick={clear} aria-label="Clear measurement">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
      )}
      {tool !== 'none' && points.length === 0 && <div className="tw-toolbar__hint">{current.hint}</div>}
    </div>
  );
}
