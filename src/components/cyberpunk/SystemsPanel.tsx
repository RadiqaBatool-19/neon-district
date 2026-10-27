import { Building2, Car, CloudRain, Gauge, Plane, Route, Signpost, Sparkles } from 'lucide-react';
import type { QualityLevel } from '../../data/cyberpunk/config';
import { LENS_SCALES, type DataLens } from '../../data/cyberpunk/simulatedMetrics';
import { useCyberStore } from '../../stores/cyberpunkStore';
import { cssGradient } from '../../utils/colorRamp';
import { Section, Segmented, SimTag, Slider, Toggle } from './controls';

const LENS_OPTIONS: { value: DataLens; label: string }[] = [
  { value: 'none', label: 'Off' },
  { value: 'energy', label: 'Energy' },
  { value: 'temperature', label: 'Temp' },
  { value: 'air', label: 'Air' },
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

/** Scene systems: layers, data lens, atmosphere, lighting and performance. */
export function SystemsPanel() {
  const layers = useCyberStore((s) => s.layers);
  const toggleLayer = useCyberStore((s) => s.toggleLayer);
  const lens = useCyberStore((s) => s.dataLens);
  const setLens = useCyberStore((s) => s.setDataLens);
  const rain = useCyberStore((s) => s.rain);
  const setRain = useCyberStore((s) => s.setRain);
  const rainIntensity = useCyberStore((s) => s.rainIntensity);
  const setRainIntensity = useCyberStore((s) => s.setRainIntensity);
  const particles = useCyberStore((s) => s.particles);
  const setParticles = useCyberStore((s) => s.setParticles);
  const night = useCyberStore((s) => s.nightLevel);
  const setNight = useCyberStore((s) => s.setNightLevel);
  const quality = useCyberStore((s) => s.quality);
  const setQuality = useCyberStore((s) => s.setQuality);
  const autoQuality = useCyberStore((s) => s.autoQuality);
  const reduced = useCyberStore((s) => s.reducedEffects);
  const setReduced = useCyberStore((s) => s.setReducedEffects);

  return (
    <div className="cp-systems">
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

      <Section title="Atmosphere">
        <Toggle label="Rain" icon={<CloudRain size={14} />} checked={rain} onChange={setRain} />
        <Slider label="Rain intensity" value={rainIntensity} onChange={setRainIntensity} disabled={!rain} left="Drizzle" right="Storm" />
        <Toggle label="Drifting particles" icon={<Sparkles size={14} />} checked={particles} onChange={setParticles} />
        <div className="cp-field-label">Lighting</div>
        <Slider label="Lighting" value={night} onChange={setNight} left="Dusk" right="Deep night" />
      </Section>

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
        <Toggle label="Reduced effects" icon={<Gauge size={14} />} checked={reduced} onChange={setReduced} hint="Halves traffic and rain, removes grain, aberration and shadows" />
      </Section>
    </div>
  );
}
