import { useState, type KeyboardEvent } from 'react';
import { Building2, Car, Gauge, Plane, Route, Signpost } from 'lucide-react';
import type { QualityLevel } from '../../data/cyberpunk/config';
import { LENS_SCALES, type DataLens } from '../../data/cyberpunk/simulatedMetrics';
import { useCyberStore, type Density } from '../../stores/cyberpunkStore';
import { cssGradient } from '../../utils/colorRamp';
import { Section, Segmented, SimTag, Slider, Toggle } from './controls';
import { EnvironmentPanel } from './EnvironmentPanel';
import { SimulationPanel } from './SimulationPanel';

const LENS_OPTIONS: { value: DataLens; label: string }[] = [
  { value: 'none', label: 'Off' },
  { value: 'energy', label: 'Energy' },
  { value: 'temperature', label: 'Temp' },
  { value: 'air', label: 'Air' },
];

const DENSITY_OPTIONS: { value: Density; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'heavy', label: 'Heavy' },
];

export function LensLegend({ lens }: { lens: Exclude<DataLens, 'none'> }) {
  const s = LENS_SCALES[lens];
  return (
    <div className="cp-legend">
      <div className="cp-legend__head">
        <span>
          {s.label} <em>({s.unit})</em>
        </span>
        <SimTag compact />
      </div>
      <div className="cp-legend__bar" style={{ background: cssGradient(s.stops) }} />
      <div className="cp-legend__ends">
        <span>{s.min}</span>
        <span>{s.max}+</span>
      </div>
    </div>
  );
}

/** City life: activity, traffic, layers and the data lens. */
function CityTab() {
  const layers = useCyberStore((s) => s.layers);
  const toggleLayer = useCyberStore((s) => s.toggleLayer);
  const lens = useCyberStore((s) => s.dataLens);
  const setLens = useCyberStore((s) => s.setDataLens);
  const activity = useCyberStore((s) => s.cityActivity);
  const setActivity = useCyberStore((s) => s.setCityActivity);
  const traffic = useCyberStore((s) => s.trafficDensity);
  const setTraffic = useCyberStore((s) => s.setTrafficDensity);
  const flyers = useCyberStore((s) => s.flyerDensity);
  const setFlyers = useCyberStore((s) => s.setFlyerDensity);

  return (
    <>
      <Section title="City activity" aside={<SimTag compact />}>
        <Slider label="City activity" value={activity} onChange={setActivity} left="Quiet" right="Bustling" />
        <p className="cp-hint">Drives lit windows and sign flicker per district, following each district's daily rhythm.</p>
        <div className="cp-field-label">Street traffic</div>
        <Segmented<Density> label="Street traffic density" value={traffic} options={DENSITY_OPTIONS} onChange={setTraffic} />
        <div className="cp-field-label">Air traffic</div>
        <Segmented<Density> label="Air traffic density" value={flyers} options={DENSITY_OPTIONS} onChange={setFlyers} />
      </Section>

      <Section title="Layers">
        <Toggle label="Buildings" icon={<Building2 size={14} />} checked={layers.buildings} onChange={() => toggleLayer('buildings')} />
        <Toggle label="Roads & highways" icon={<Route size={14} />} checked={layers.roads} onChange={() => toggleLayer('roads')} />
        <Toggle label="Street traffic" icon={<Car size={14} />} checked={layers.traffic} onChange={() => toggleLayer('traffic')} />
        <Toggle label="Air traffic" icon={<Plane size={14} />} checked={layers.flying} onChange={() => toggleLayer('flying')} />
        <Toggle label="Neon signage" icon={<Signpost size={14} />} checked={layers.signage} onChange={() => toggleLayer('signage')} />
      </Section>

      <Section title="Data lens" aside={<SimTag compact />}>
        <Segmented label="Data lens" value={lens} options={LENS_OPTIONS} onChange={setLens} />
        {lens !== 'none' && <LensLegend lens={lens} />}
      </Section>
    </>
  );
}

function DisplayTab() {
  const quality = useCyberStore((s) => s.quality);
  const setQuality = useCyberStore((s) => s.setQuality);
  const autoQuality = useCyberStore((s) => s.autoQuality);
  const reduced = useCyberStore((s) => s.reducedEffects);
  const setReduced = useCyberStore((s) => s.setReducedEffects);

  return (
    <Section title="Performance" aside={autoQuality ? <span className="cp-muted">auto</span> : undefined}>
      <Segmented<QualityLevel>
        label="Scene detail"
        value={quality}
        options={[
          { value: 'low', label: 'Low' },
          { value: 'medium', label: 'Medium' },
          { value: 'high', label: 'High' },
        ]}
        onChange={(q) => setQuality(q)}
      />
      <Toggle label="Reduced effects" icon={<Gauge size={14} />} checked={reduced} onChange={setReduced} hint="Halves traffic and rain, removes grain, aberration, shadows and lightning flashes" />
    </Section>
  );
}

const TABS = [
  { id: 'environment', label: 'Sky' },
  { id: 'city', label: 'City' },
  { id: 'simulation', label: 'Simulate' },
  { id: 'display', label: 'Display' },
] as const;
type TabId = (typeof TABS)[number]['id'];

/** Scene systems, grouped into tabs so the panel stays short. */
export function SystemsPanel() {
  const [tab, setTab] = useState<TabId>('environment');

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const i = TABS.findIndex((t) => t.id === tab);
    const next = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
    setTab(next.id);
    document.getElementById(`cp-tab-${next.id}`)?.focus();
  };

  return (
    <div className="cp-systems">
      <div className="cp-tabs" role="tablist" aria-label="Scene systems" onKeyDown={onKey}>
        {TABS.map((t) => (
          <button
            key={t.id}
            id={`cp-tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={`cp-tabpanel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            className={tab === t.id ? 'is-active' : ''}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`cp-tabpanel-${tab}`} aria-labelledby={`cp-tab-${tab}`}>
        {tab === 'environment' && <EnvironmentPanel />}
        {tab === 'city' && <CityTab />}
        {tab === 'simulation' && <SimulationPanel />}
        {tab === 'display' && <DisplayTab />}
      </div>
    </div>
  );
}
