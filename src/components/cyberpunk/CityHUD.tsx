import { useEffect, useRef, useState } from 'react';
import { CircleHelp, Move3d, Orbit, RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import { DISTRICTS } from '../../data/cyberpunk/districts';
import { getCityPlan } from '../../scenes/cyberpunk/cityGenerator';
import { useCyberStore } from '../../stores/cyberpunkStore';
import { isTypingTarget } from '../../utils/webgl';
import { SiteNav } from '../shared/SiteNav';
import { BuildingInfoPanel } from './BuildingInfoPanel';
import { DistrictRail } from './DistrictRail';
import { MetricsPanel } from './MetricsPanel';
import { LensLegend, SystemsPanel } from './SystemsPanel';

/** Follows the pointer via direct DOM writes; re-renders only when the hovered building changes. */
function HoverTooltip() {
  const hovered = useCyberStore((s) => s.hoveredId);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (ref.current) ref.current.style.transform = `translate(${e.clientX + 14}px, ${e.clientY + 16}px)`;
      // The canvas gets no pointer-out when the pointer moves onto a HUD panel, so clear hover here.
      if (!(e.target instanceof HTMLCanvasElement) && useCyberStore.getState().hoveredId !== null) useCyberStore.getState().setHovered(null);
    };
    window.addEventListener('pointermove', move);
    return () => window.removeEventListener('pointermove', move);
  }, []);

  useEffect(() => {
    document.body.style.cursor = hovered !== null ? 'pointer' : '';
    return () => {
      document.body.style.cursor = '';
    };
  }, [hovered]);

  const b = hovered !== null ? getCityPlan().buildings[hovered] : null;
  return (
    <div ref={ref} className={`cp-tooltip${b ? ' is-visible' : ''}`} aria-hidden="true">
      {b && (
        <>
          <strong>{b.name}</strong>
          <span style={{ color: DISTRICTS[b.district].accent }}>{DISTRICTS[b.district].name}</span>
        </>
      )}
    </div>
  );
}

function HelpCard({ onClose }: { onClose: () => void }) {
  return (
    <div className="cp-panel cp-help" role="dialog" aria-label="Controls">
      <header>
        <span>Controls</span>
        <button type="button" className="cp-icon-btn" onClick={onClose} aria-label="Close help">
          <X size={14} />
        </button>
      </header>
      <ul>
        <li><kbd>Drag</kbd> orbit</li>
        <li><kbd>Right-drag</kbd> pan</li>
        <li><kbd>Wheel</kbd> zoom to cursor</li>
        <li><kbd>W A S D</kbd> move · <kbd>Q E</kbd> altitude</li>
        <li><kbd>Shift</kbd> move faster</li>
        <li><kbd>Click</kbd> inspect building · <kbd>Esc</kbd> close</li>
        <li><kbd>R</kbd> reset view · <kbd>F</kbd> free / orbit</li>
        <li><kbd>Pinch</kbd> zoom · <kbd>Two-finger drag</kbd> pan</li>
      </ul>
    </div>
  );
}

export function CityHUD({ visible }: { visible: boolean }) {
  const selectedId = useCyberStore((s) => s.selectedId);
  const lens = useCyberStore((s) => s.dataLens);
  const cameraMode = useCyberStore((s) => s.cameraMode);
  const setCameraMode = useCyberStore((s) => s.setCameraMode);
  const resetView = useCyberStore((s) => s.resetView);
  const [systemsOpen, setSystemsOpen] = useState(() => typeof window === 'undefined' || window.innerWidth > 900);
  const [helpOpen, setHelpOpen] = useState(false);

  // Keyboard shortcuts.
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      const s = useCyberStore.getState();
      if (e.key === 'Escape') {
        if (s.selectedId !== null) s.select(null);
        else setHelpOpen(false);
      } else if (e.key === 'r' || e.key === 'R') s.resetView();
      else if (e.key === 'f' || e.key === 'F') s.setCameraMode(s.cameraMode === 'free' ? 'orbit' : 'free');
      else if (e.key === '?') setHelpOpen((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible]);

  const showSystems = systemsOpen && selectedId === null;

  return (
    <div className={`cp-hud${visible ? ' is-visible' : ''}`}>
      <header className="cp-topbar">
        <div className="cp-brand">
          <span className="cp-wordmark">
            NEON <b>DISTRICT</b>
          </span>
          <span className="cp-simbadge" title="All metrics in this experience are synthetic">
            <i /> Simulation
          </span>
        </div>
        <SiteNav variant="dark" className="cp-sitenav" />
        <button
          type="button"
          className={`cp-icon-btn cp-systems-toggle${showSystems ? ' is-active' : ''}`}
          onClick={() => {
            if (selectedId !== null) useCyberStore.getState().select(null);
            setSystemsOpen((v) => !v || selectedId !== null);
          }}
          aria-expanded={showSystems}
          aria-label="Scene systems"
        >
          <SlidersHorizontal size={16} />
        </button>
      </header>

      <DistrictRail />

      {selectedId !== null ? (
        <BuildingInfoPanel />
      ) : (
        showSystems && (
          <aside className="cp-panel cp-systems-panel" aria-label="Scene systems">
            <SystemsPanel />
          </aside>
        )
      )}

      {!showSystems && lens !== 'none' && (
        <div className="cp-panel cp-floating-legend">
          <LensLegend lens={lens} />
        </div>
      )}

      <MetricsPanel />

      <div className="cp-viewbar" role="toolbar" aria-label="View">
        <button type="button" className="cp-btn" onClick={resetView} title="Reset view (R)">
          <RotateCcw size={14} /> Reset view
        </button>
        <div className="cp-seg cp-seg--icons" role="radiogroup" aria-label="Camera mode">
          <button type="button" role="radio" aria-checked={cameraMode === 'orbit'} className={cameraMode === 'orbit' ? 'is-active' : ''} onClick={() => setCameraMode('orbit')} title="Orbit — cinematic limits">
            <Orbit size={14} /> Orbit
          </button>
          <button type="button" role="radio" aria-checked={cameraMode === 'free'} className={cameraMode === 'free' ? 'is-active' : ''} onClick={() => setCameraMode('free')} title="Free exploration — fly to street level (F)">
            <Move3d size={14} /> Free
          </button>
        </div>
        <button type="button" className="cp-icon-btn" onClick={() => setHelpOpen((v) => !v)} aria-label="Controls help" aria-expanded={helpOpen}>
          <CircleHelp size={16} />
        </button>
      </div>

      {helpOpen && <HelpCard onClose={() => setHelpOpen(false)} />}
      <HoverTooltip />
    </div>
  );
}
