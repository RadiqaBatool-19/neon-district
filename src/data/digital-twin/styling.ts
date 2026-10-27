import type { ColorBy } from '../../stores/twinStore';
import type { TwinBuilding } from './buildTwinModel';
import { SIM_SCALES } from './simulatedMetrics';
import type { HeightSource } from './types';

/** Colour rules and legends for the twin's building layer. */

export const TYPE_COLORS: Record<string, string> = {
  apartments: '#93b4e0',
  residential: '#93b4e0',
  house: '#e3d6bf',
  commercial: '#b8a6dd',
  retail: '#e0a8c0',
  office: '#9fc7d6',
  mosque: '#a7d3b0',
  construction: '#f2c38b',
  yes: '#dfe3ea',
};
export const TYPE_FALLBACK = '#dfe3ea';

export const SOURCE_COLORS: Record<HeightSource, string> = {
  recorded: '#2563eb',
  estimated_from_levels: '#f59e0b',
  estimated_default: '#cbd5e1',
};

export const SOURCE_LABELS: Record<HeightSource, string> = {
  recorded: 'Recorded (OSM height)',
  estimated_from_levels: 'Estimated from levels',
  estimated_default: 'Estimated (type default)',
};

export const HEIGHT_RAMP = ['#eef2ff', '#a5b4fc', '#6366f1', '#3730a3', '#1e1b4b'];

export function typeLabel(key: string) {
  return key === 'yes' ? 'Unspecified (building=yes)' : key.charAt(0).toUpperCase() + key.slice(1);
}

export interface LegendSpec {
  title: string;
  simulated: boolean;
  kind: 'categorical' | 'ramp';
  items?: { color: string; label: string }[];
  stops?: string[];
  min?: string;
  max?: string;
  note?: string;
}

export function legendFor(colorBy: ColorBy, types: { key: string; count: number }[], maxHeight: number): LegendSpec {
  switch (colorBy) {
    case 'type':
      return { title: 'Building type (OSM building=*)', simulated: false, kind: 'categorical', items: types.map((t) => ({ color: TYPE_COLORS[t.key] ?? TYPE_FALLBACK, label: `${typeLabel(t.key)} · ${t.count}` })) };
    case 'height':
      return { title: 'Building height', simulated: false, kind: 'ramp', stops: HEIGHT_RAMP, min: '0 m', max: `${Math.ceil(maxHeight)} m`, note: 'Includes estimated heights — see height source.' };
    case 'heightSource':
      return { title: 'Height source', simulated: false, kind: 'categorical', items: (Object.keys(SOURCE_COLORS) as HeightSource[]).map((k) => ({ color: SOURCE_COLORS[k], label: SOURCE_LABELS[k] })) };
    default: {
      const s = SIM_SCALES[colorBy];
      return { title: `${s.label} (${s.unit})`, simulated: true, kind: 'ramp', stops: [...s.stops], min: String(s.min), max: `${s.max}+` };
    }
  }
}

export function metricValue(b: TwinBuilding, key: 'energy' | 'temperature' | 'air'): number {
  return key === 'energy' ? b.sim.energyIntensity : key === 'temperature' ? b.sim.roofTempC : b.sim.pm25;
}
