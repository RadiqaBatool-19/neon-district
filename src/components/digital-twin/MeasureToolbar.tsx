import { useEffect } from 'react';
import { Columns3, LocateFixed, MousePointer2, Ruler, SquareDashed, Trash2 } from 'lucide-react';
import { formatArea, formatLength, formatLonLat, measureArea, measureDistance } from '../../data/digital-twin/measure';
import { MAX_COMPARE, useTwinStore, type MeasureTool } from '../../stores/twinStore';
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
  const compareMode = useTwinStore((s) => s.compareMode);
  const setCompareMode = useTwinStore((s) => s.setCompareMode);
  const compareCount = useTwinStore((s) => s.compareIds.length);
  const compareOpen = useTwinStore((s) => s.compareOpen);
  const setCompareOpen = useTwinStore((s) => s.setCompareOpen);
  const clearCompare = useTwinStore((s) => s.clearCompare);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const s = useTwinStore.getState();
      if (e.key === 'Escape') {
        if (s.points.length) s.clearMeasure();
        else if (s.tool !== 'none') s.setTool('none');
        else if (s.compareOpen) s.setCompareOpen(false);
        else if (s.selection) s.select(null);
        // Leaves compare mode but keeps the compared buildings.
        else if (s.compareMode) s.setCompareMode(false);
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
        {TOOLS.map((t) => {
          // Compare mode is a variant of Inspect: Inspect is not "active" while it is on.
          const active = tool === t.id && !(t.id === 'none' && compareMode);
          return (
            <button key={t.id} type="button" className={active ? 'is-active' : ''} aria-pressed={active} onClick={() => (t.id === 'none' ? setCompareMode(false) : setTool(t.id))} title={t.hint}>
              {t.icon}
              <span>{t.label}</span>
            </button>
          );
        })}
        <span className="tw-toolbar__sep" aria-hidden="true" />
        <button
          type="button"
          className={`tw-compare-btn${compareMode ? ' is-active is-compare' : ''}`}
          aria-pressed={compareMode}
          aria-label={`Compare mode${compareCount ? `, ${compareCount} selected` : ''}`}
          onClick={() => setCompareMode(!compareMode)}
          title="Compare mode: click buildings to add or remove them (Shift+click also works while inspecting)"
        >
          <Columns3 size={15} />
          <span>Compare</span>
          {compareCount > 0 && <b className="tw-toolbar__badge">{compareCount}</b>}
        </button>
      </div>
      {tool === 'none' && (compareMode || compareCount > 0) && (
        <div className="tw-toolbar__result tw-toolbar__compare">
          <span className={compareMode ? '' : 'tw-muted'}>
            {compareMode ? (
              <>
                Click buildings to add or remove · <b>{compareCount}</b>/{MAX_COMPARE} selected
              </>
            ) : (
              <>
                <b>{compareCount}</b> building{compareCount === 1 ? '' : 's'} in comparison · Shift+click to add more
              </>
            )}
          </span>
          <div className="tw-toolbar__actions">
            {compareCount > 0 && (
              <button type="button" className="tw-btn tw-btn--small" onClick={() => setCompareOpen(!compareOpen)} aria-expanded={compareOpen}>
                {compareOpen ? 'Hide table' : 'Open table'}
              </button>
            )}
            {compareCount > 0 && (
              <button type="button" className="tw-icon-btn" onClick={clearCompare} aria-label="Clear comparison" title="Clear comparison">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
      )}
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
