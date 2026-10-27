import { useEffect, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronsDown, ChevronsUp, CircleHelp, Footprints, MousePointer2, Orbit, Plane, RotateCcw, X } from 'lucide-react';
import { touchKeys, useCyberStore, type CameraMode } from '../../stores/cyberpunkStore';

const MODES: { value: CameraMode; label: string; icon: ReactNode; title: string }[] = [
  { value: 'orbit', label: 'Orbit', icon: <Orbit size={14} />, title: 'Orbit — cinematic overview (O)' },
  { value: 'fly', label: 'Fly', icon: <Plane size={14} />, title: 'Fly — drone camera, WASD + Q/E (F)' },
  { value: 'walk', label: 'Walk', icon: <Footprints size={14} />, title: 'Walk — first person at street level (G)' },
];

export function useCoarsePointer() {
  const [coarse, setCoarse] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true);
  useEffect(() => {
    const mq = window.matchMedia?.('(pointer: coarse)');
    if (!mq) return;
    const on = () => setCoarse(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return coarse;
}

/** Hold-to-move button for the touch pad. */
function PadButton({ k, label, children }: { k: string; label: string; children: ReactNode }) {
  const release = () => touchKeys.delete(k);
  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        touchKeys.add(k);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}

/** On-screen movement pad for touch devices in fly / walk modes. Drag the scene to look around. */
export function TouchPad({ mode }: { mode: CameraMode }) {
  useEffect(() => () => touchKeys.clear(), []);
  return (
    <div className="cp-panel cp-touchpad" aria-label="Movement">
      <div className="cp-touchpad__grid">
        <span />
        <PadButton k="w" label="Move forward"><ArrowUp size={18} /></PadButton>
        <span />
        <PadButton k="a" label="Move left"><ArrowLeft size={18} /></PadButton>
        <PadButton k="s" label="Move back"><ArrowDown size={18} /></PadButton>
        <PadButton k="d" label="Move right"><ArrowRight size={18} /></PadButton>
      </div>
      {mode === 'fly' && (
        <div className="cp-touchpad__lift">
          <PadButton k="e" label="Rise"><ChevronsUp size={18} /></PadButton>
          <PadButton k="q" label="Descend"><ChevronsDown size={18} /></PadButton>
        </div>
      )}
    </div>
  );
}

export function CameraBar({ helpOpen, onHelp }: { helpOpen: boolean; onHelp: () => void }) {
  const mode = useCyberStore((s) => s.cameraMode);
  const setMode = useCyberStore((s) => s.setCameraMode);
  const resetView = useCyberStore((s) => s.resetView);
  const speed = useCyberStore((s) => s.moveSpeed);
  const setSpeed = useCyberStore((s) => s.setMoveSpeed);
  const locked = useCyberStore((s) => s.pointerLocked);
  const requestLock = useCyberStore((s) => s.requestPointerLock);
  const coarse = useCoarsePointer();
  const firstPerson = mode !== 'orbit';

  return (
    <>
      {firstPerson && (
        <div className="cp-panel cp-movebar" role="group" aria-label={`${mode === 'walk' ? 'Walk' : 'Fly'} controls`}>
          <span className="cp-movebar__mode">{mode === 'walk' ? <Footprints size={13} /> : <Plane size={13} />} {mode === 'walk' ? 'Walking' : 'Flying'}</span>
          <label className="cp-movebar__speed">
            <span>Speed</span>
            <input type="range" min={0.25} max={3} step={0.05} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} aria-label="Movement speed" style={{ ['--pct' as string]: `${((speed - 0.25) / 2.75) * 100}%` }} />
            <output>{speed.toFixed(1)}×</output>
          </label>
          {!coarse && (
            <button type="button" className="cp-btn cp-btn--small" onClick={requestLock} disabled={locked} title="Look with the mouse without dragging. Press Esc to release.">
              <MousePointer2 size={13} /> Mouse look
            </button>
          )}
          <button type="button" className="cp-btn cp-btn--small cp-btn--ghost" onClick={() => setMode('orbit')} title="Back to orbit view (O)">
            <X size={13} /> Exit
          </button>
        </div>
      )}

      <div className="cp-viewbar" role="toolbar" aria-label="View">
        <button type="button" className="cp-btn" onClick={resetView} title="Reset view (R)">
          <RotateCcw size={14} /> <span className="cp-hide-sm">Reset view</span>
        </button>
        <div className="cp-seg cp-seg--icons" role="radiogroup" aria-label="Camera mode">
          {MODES.map((m) => (
            <button key={m.value} type="button" role="radio" aria-checked={mode === m.value} className={mode === m.value ? 'is-active' : ''} onClick={() => setMode(m.value)} title={m.title}>
              {m.icon} {m.label}
            </button>
          ))}
        </div>
        <button type="button" className="cp-icon-btn" onClick={onHelp} aria-label="Controls help" aria-expanded={helpOpen}>
          <CircleHelp size={16} />
        </button>
      </div>

      {firstPerson && coarse && <TouchPad mode={mode} />}

      {locked && (
        <>
          <div className="cp-crosshair" aria-hidden="true" />
          <div className="cp-locknote" role="status">
            Mouse look on · <kbd>Esc</kbd> to release
          </div>
        </>
      )}
    </>
  );
}
