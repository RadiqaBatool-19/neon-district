import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Info, Layers3 } from 'lucide-react';
import { Attribution, TwinHeader } from '../components/digital-twin/TwinHeader';
import { InspectorPanel } from '../components/digital-twin/InspectorPanel';
import { LayerPanel } from '../components/digital-twin/LayerPanel';
import { MapWidgets } from '../components/digital-twin/MapWidgets';
import { MeasureToolbar } from '../components/digital-twin/MeasureToolbar';
import { ErrorBoundary, FailureScreen } from '../components/shared/ErrorBoundary';
import { LoadingScreen } from '../components/shared/LoadingScreen';
import { buildTwinModel, type TwinModel } from '../data/digital-twin/buildTwinModel';
import { twinDataSource } from '../data/digital-twin/dataSource';
import type { TwinManifest } from '../data/digital-twin/types';
import { passesFilters } from '../data/digital-twin/filters';
import { useTwinStore } from '../stores/twinStore';
import { isWebGL2Available } from '../utils/webgl';
import '../styles/twin.css';

const TwinCanvas = lazy(() => import('../scenes/digital-twin/TwinCanvas'));

type LoadState = { status: 'loading'; progress: number; label: string } | { status: 'ready'; model: TwinModel } | { status: 'error'; message: string };

export default function DigitalTwinPage() {
  const [webgl] = useState(isWebGL2Available);
  const [manifest, setManifest] = useState<TwinManifest | null>(null);
  const [areaId, setAreaId] = useState<string | null>(null);
  const [state, setState] = useState<LoadState>({ status: 'loading', progress: 0, label: 'manifest' });
  const [attempt, setAttempt] = useState(0);
  const filters = useTwinStore((s) => s.filters);
  const selection = useTwinStore((s) => s.selection);
  // Narrow screens show one panel at a time; on desktop both are always visible (CSS ignores this).
  const [mobilePanel, setMobilePanel] = useState<'none' | 'layers' | 'info'>('none');

  useEffect(() => {
    if (selection) setMobilePanel('info');
  }, [selection]);

  useEffect(() => {
    document.title = 'Interactive 3D Digital Twin · Islamabad';
    return () => {
      useTwinStore.getState().reset();
      document.body.style.cursor = '';
    };
  }, []);

  // Load manifest → area → model. Aborts cleanly on unmount or area change.
  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        setState({ status: 'loading', progress: 0, label: 'manifest' });
        const m = manifest ?? (await twinDataSource.loadManifest(ctrl.signal));
        if (!manifest) setManifest(m);
        const entry = m.areas.find((a) => a.id === areaId) ?? m.areas.find((a) => a.status === 'available');
        if (!entry) throw new Error('The manifest lists no available areas.');
        if (entry.id !== areaId) setAreaId(entry.id);
        const data = await twinDataSource.loadArea(entry, ctrl.signal, (p, label) => setState({ status: 'loading', progress: 0.1 + p * 0.8, label }));
        setState({ status: 'loading', progress: 0.95, label: 'building 3D model' });
        const model = buildTwinModel(data, m);
        useTwinStore.getState().resetFilters(model.stats.maxHeight);
        setState({ status: 'ready', model });
      } catch (err) {
        if (ctrl.signal.aborted) return;
        setState({ status: 'error', message: err instanceof Error ? err.message : String(err) });
      }
    })();
    return () => ctrl.abort();
    // manifest is intentionally excluded: it is only fetched once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaId, attempt]);

  // Clear hover when the pointer leaves the canvas for a panel (the canvas emits no pointer-out then).
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!(e.target instanceof HTMLCanvasElement) && useTwinStore.getState().hovered !== null) useTwinStore.getState().setHovered(null);
    };
    window.addEventListener('pointermove', move);
    return () => window.removeEventListener('pointermove', move);
  }, []);

  const changeArea = useCallback((id: string) => {
    useTwinStore.getState().select(null);
    useTwinStore.getState().clearMeasure();
    setAreaId(id);
  }, []);

  const visibleCount = useMemo(
    () => (state.status === 'ready' ? state.model.buildings.filter((b) => b.supersededBy === null && passesFilters(b, filters)).length : 0),
    [state, filters],
  );

  if (!webgl) {
    return <FailureScreen variant="light" title="WebGL 2 is not available" message="The digital twin needs WebGL 2. Try a recent version of Chrome, Edge, Firefox or Safari with hardware acceleration enabled." />;
  }

  if (state.status === 'error') {
    return (
      <div className="tw-root">
        <div className="failure failure--light" role="alert">
          <div className="failure__card">
            <h1>Could not load the digital twin</h1>
            <p>{state.message}</p>
            <div className="failure__actions">
              <button type="button" onClick={() => setAttempt((a) => a + 1)}>
                Try again
              </button>
              <a href="/">Back to projects</a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tw-root">
      <ErrorBoundary variant="light" title="The digital twin failed to render">
        {state.status === 'ready' && manifest && (
          <>
            <Suspense fallback={null}>
              <TwinCanvas key={state.model.areaId} model={state.model} />
            </Suspense>
            <TwinHeader manifest={manifest} areaId={state.model.areaId} onAreaChange={changeArea} />
            <LayerPanel model={state.model} visibleCount={visibleCount} open={mobilePanel === 'layers'} />
            <InspectorPanel model={state.model} open={mobilePanel === 'info'} />
            <div className="tw-mobilebar" role="tablist" aria-label="Panels">
              {(
                [
                  ['layers', 'Layers', <Layers3 key="l" size={15} />],
                  ['info', 'Details', <Info key="i" size={15} />],
                ] as const
              ).map(([id, label, icon]) => (
                <button key={id} type="button" role="tab" aria-selected={mobilePanel === id} className={mobilePanel === id ? 'is-active' : ''} onClick={() => setMobilePanel((v) => (v === id ? 'none' : id))}>
                  {icon} {label}
                </button>
              ))}
            </div>
            <MeasureToolbar />
            <MapWidgets />
            <Attribution osmTimestamp={state.model.data.meta.osm_base_timestamp} hasDem={!!state.model.terrain} />
          </>
        )}
        {state.status === 'loading' && <LoadingScreen variant="twin" label="Loading digital twin" progress={state.progress} detail={`Loading ${state.label}…`} />}
      </ErrorBoundary>
    </div>
  );
}
