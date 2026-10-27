import { createRng } from '../../utils/random';
import type { DistrictId } from './districts';

/**
 * SIMULATED building metrics for the fictional city. Generated deterministically
 * from each building's seed — these are not sensor readings of any kind.
 */
export interface SimulatedBuildingMetrics {
  energyMWhDay: number;
  temperatureC: number;
  airQualityIndex: number;
  occupancyPct: number;
  status: 'Operational' | 'At capacity' | 'Partially vacant' | 'Maintenance window';
}

const ENERGY_PER_M2: Record<DistrictId, number> = {
  plaza: 0.42,
  financial: 0.36,
  market: 0.3,
  industrial: 0.55,
  residential: 0.18,
};

const HEAT_OFFSET: Record<DistrictId, number> = {
  plaza: 1.2,
  financial: 0.8,
  market: 2.1,
  industrial: 3.4,
  residential: -0.6,
};

const AQI_BASE: Record<DistrictId, [number, number]> = {
  plaza: [22, 45],
  financial: [28, 55],
  market: [45, 90],
  industrial: [85, 165],
  residential: [18, 48],
};

export function simulateBuildingMetrics(seed: number, district: DistrictId, floors: number, footprintM2: number): SimulatedBuildingMetrics {
  const rng = createRng(seed ^ 0x9e3779b9);
  const floorArea = floors * footprintM2;
  const energyMWhDay = (floorArea * ENERGY_PER_M2[district] * rng.range(0.75, 1.25)) / 1000;
  const temperatureC = 21 + HEAT_OFFSET[district] + rng.range(-1.6, 1.6);
  const [a0, a1] = AQI_BASE[district];
  const airQualityIndex = Math.round(rng.range(a0, a1));
  const occupancyPct = Math.round(rng.range(district === 'industrial' ? 25 : 45, 99));
  const roll = rng.next();
  const status: SimulatedBuildingMetrics['status'] =
    roll < 0.06 ? 'Maintenance window' : occupancyPct > 94 ? 'At capacity' : occupancyPct < 55 ? 'Partially vacant' : 'Operational';
  return { energyMWhDay, temperatureC, airQualityIndex, occupancyPct, status };
}

export type DataLens = 'none' | 'energy' | 'temperature' | 'air';

export interface LensScale {
  label: string;
  unit: string;
  min: number;
  max: number;
  /** Colour stops low → high. */
  stops: string[];
}

export const LENS_SCALES: Record<Exclude<DataLens, 'none'>, LensScale> = {
  energy: { label: 'Energy use', unit: 'MWh/day', min: 0, max: 40, stops: ['#1b2a6b', '#2b7bff', '#3ef0ff', '#f6ff7a'] },
  temperature: { label: 'Surface temperature', unit: '°C', min: 18, max: 27, stops: ['#2b5bff', '#8b5cff', '#ff4f9a', '#ffb347'] },
  air: { label: 'Air quality index', unit: 'AQI', min: 15, max: 170, stops: ['#2bffb1', '#e8ff5a', '#ff9d3b', '#ff2b5a'] },
};

export function lensValue(lens: Exclude<DataLens, 'none'>, m: SimulatedBuildingMetrics): number {
  if (lens === 'energy') return m.energyMWhDay;
  if (lens === 'temperature') return m.temperatureC;
  return m.airQualityIndex;
}
