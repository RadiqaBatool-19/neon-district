import { MapPin } from 'lucide-react';
import { DISTRICT_ORDER, DISTRICTS } from '../../data/cyberpunk/districts';
import { useCyberStore } from '../../stores/cyberpunkStore';

/** District camera presets. */
export function DistrictRail() {
  const active = useCyberStore((s) => s.activeDistrict);
  const fly = useCyberStore((s) => s.flyToDistrict);
  const reset = useCyberStore((s) => s.resetView);

  return (
    <nav className="cp-panel cp-districts" aria-label="Districts">
      <div className="cp-districts__head">
        <MapPin size={13} /> Districts
      </div>
      <button type="button" className={`cp-district${active === null ? ' is-active' : ''}`} onClick={reset}>
        <i style={{ background: '#e8f4ff' }} />
        <span>
          <strong>Overview</strong>
          <small>Cinematic aerial</small>
        </span>
      </button>
      {DISTRICT_ORDER.map((id) => {
        const d = DISTRICTS[id];
        return (
          <button key={id} type="button" className={`cp-district${active === id ? ' is-active' : ''}`} onClick={() => fly(id)} style={{ ['--accent' as string]: d.accent }}>
            <i />
            <span>
              <strong>{d.name}</strong>
              <small>{d.tagline}</small>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
