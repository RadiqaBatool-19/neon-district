import { Crosshair, X } from 'lucide-react';
import { DISTRICTS } from '../../data/cyberpunk/districts';
import { getCityPlan } from '../../scenes/cyberpunk/cityGenerator';
import { useCyberStore } from '../../stores/cyberpunkStore';
import { SimTag } from './controls';

function aqiLabel(aqi: number) {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy (sensitive)';
  return 'Unhealthy';
}

const STATUS_CLASS: Record<string, string> = {
  Operational: 'ok',
  'At capacity': 'warn',
  'Partially vacant': 'muted',
  'Maintenance window': 'alert',
};

export function BuildingInfoPanel() {
  const selectedId = useCyberStore((s) => s.selectedId);
  const select = useCyberStore((s) => s.select);
  if (selectedId === null) return null;
  const b = getCityPlan().buildings[selectedId];
  if (!b) return null;
  const d = DISTRICTS[b.district];
  const m = b.metrics;

  return (
    <aside className="cp-panel cp-building" aria-label={`${b.name} details`}>
      <header className="cp-building__head">
        <div>
          <div className="cp-building__district" style={{ ['--accent' as string]: d.accent }}>
            <i /> {d.name}
          </div>
          <h2>{b.name}</h2>
          <div className="cp-building__type">{b.type}</div>
        </div>
        <button type="button" className="cp-icon-btn" onClick={() => select(null)} aria-label="Close building panel">
          <X size={16} />
        </button>
      </header>

      <dl className="cp-stats">
        <div>
          <dt>Height</dt>
          <dd>
            {Math.round(b.height)}
            <small>m</small>
          </dd>
        </div>
        <div>
          <dt>Floors</dt>
          <dd>{b.floors}</dd>
        </div>
        <div>
          <dt>Footprint</dt>
          <dd>
            {Math.round(b.w * b.d).toLocaleString()}
            <small>m²</small>
          </dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd className={`cp-status cp-status--${STATUS_CLASS[m.status]}`}>
            <i /> {m.status}
          </dd>
        </div>
      </dl>

      <div className="cp-building__sim">
        <div className="cp-building__simhead">
          <span>Live metrics</span>
          <SimTag />
        </div>
        <ul className="cp-metrics-list">
          <li>
            <span>Energy use</span>
            <strong>
              {m.energyMWhDay.toFixed(1)} <small>MWh/day</small>
            </strong>
            <meter min={0} max={40} value={m.energyMWhDay} />
          </li>
          <li>
            <span>Surface temp.</span>
            <strong>
              {m.temperatureC.toFixed(1)} <small>°C</small>
            </strong>
            <meter min={16} max={28} value={m.temperatureC} />
          </li>
          <li>
            <span>Air quality</span>
            <strong>
              {m.airQualityIndex} <small>AQI · {aqiLabel(m.airQualityIndex)}</small>
            </strong>
            <meter min={0} max={200} low={50} high={100} optimum={0} value={m.airQualityIndex} />
          </li>
          <li>
            <span>Occupancy</span>
            <strong>
              {m.occupancyPct} <small>%</small>
            </strong>
            <meter min={0} max={100} value={m.occupancyPct} />
          </li>
        </ul>
        <p className="cp-fineprint">Synthetic values generated for this fictional city. They are not sensor readings.</p>
      </div>

      <div className="cp-building__actions">
        <button type="button" className="cp-btn" onClick={() => select(b.id)}>
          <Crosshair size={14} /> Focus
        </button>
        <button type="button" className="cp-btn cp-btn--ghost" onClick={() => select(null)}>
          Deselect <kbd>Esc</kbd>
        </button>
      </div>
    </aside>
  );
}
