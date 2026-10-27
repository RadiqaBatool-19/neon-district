import { DISTRICT_ORDER, type DistrictId } from './districts';

/**
 * SIMULATED city-level model for the fictional Neon District. Pure functions
 * only: the store holds the inputs (time, activity, events) and both the scene
 * and the UI derive what they need from here. Nothing in this module represents
 * a real sensor reading.
 */

export type CityEventKind = 'blackout' | 'pollution';

export interface CityEvent {
  id: number;
  kind: CityEventKind;
  district: DistrictId;
  /** performance.now() when triggered — used for the notification only. */
  startedAt: number;
}

export const EVENT_INFO: Record<CityEventKind, { label: string; verb: string; color: string; description: string }> = {
  blackout: {
    label: 'Power outage',
    verb: 'Blackout',
    color: '#ffb347',
    description: 'Simulated grid failure: windows, signage and street lights in the district go dark.',
  },
  pollution: {
    label: 'Pollution spike',
    verb: 'Pollution spike',
    color: '#c8e04a',
    description: 'Simulated emissions event: air-quality index rises sharply and the district is shrouded in haze.',
  },
};

/** Gaussian bump helper on a 24 h circle. */
function bump(hour: number, centre: number, width: number) {
  let d = Math.abs(hour - centre) % 24;
  if (d > 12) d = 24 - d;
  return Math.exp(-(d * d) / (2 * width * width));
}

/**
 * Typical activity (0..1) of each district through the day. Financial peaks in
 * office hours, the market in the evening, residential in the morning and
 * evening, industry runs shifts around the clock.
 */
export function districtProfile(id: DistrictId, hour: number): number {
  switch (id) {
    case 'financial':
      return 0.18 + 0.8 * bump(hour, 13, 3.6);
    case 'market':
      return 0.3 + 0.35 * bump(hour, 13, 3) + 0.65 * bump(hour, 21, 2.8);
    case 'plaza':
      return 0.3 + 0.45 * bump(hour, 14, 4) + 0.5 * bump(hour, 20.5, 2.5);
    case 'industrial':
      return 0.5 + 0.25 * bump(hour, 11, 4) + 0.1 * bump(hour, 23, 3);
    case 'residential':
      return 0.22 + 0.45 * bump(hour, 7.5, 1.6) + 0.7 * bump(hour, 20.5, 2.6);
  }
}

/** Base daily figures per district, aggregated from the SIMULATED building metrics. */
export interface DistrictBase {
  buildings: number;
  energyMWhDay: number;
  occupancyPct: number;
  aqi: number;
}

export interface DistrictReading {
  id: DistrictId;
  /** 0..1 — how busy the district is right now. */
  activity: number;
  /** 0..1 — 0 during a blackout. */
  power: number;
  /** 0..1 — strength of an active pollution spike. */
  pollution: number;
  /** Current demand, MW. */
  demandMW: number;
  occupancyPct: number;
  aqi: number;
  events: CityEventKind[];
}

/** City activity 0..1 maps to a multiplier around 1 at the default 0.5. */
export function activityScale(cityActivity: number) {
  return 0.45 + 1.1 * cityActivity;
}

export function districtActivity(id: DistrictId, hour: number, cityActivity: number) {
  return Math.min(1, districtProfile(id, hour) * activityScale(cityActivity));
}

export function readDistrict(id: DistrictId, base: DistrictBase, hour: number, cityActivity: number, events: readonly CityEvent[]): DistrictReading {
  const kinds = events.filter((e) => e.district === id).map((e) => e.kind);
  const blackout = kinds.includes('blackout');
  const spike = kinds.includes('pollution');
  const activity = districtActivity(id, hour, cityActivity);
  const power = blackout ? 0 : 1;
  // Average demand over the day is energy / 24; activity swings it ±45 %.
  const demandMW = (base.energyMWhDay / 24) * (0.55 + 0.9 * activity) * (blackout ? 0.06 : 1);
  const occupancyPct = Math.round(Math.min(99, base.occupancyPct * (0.35 + 0.85 * activity)));
  const aqi = Math.round(base.aqi * (0.75 + 0.45 * activity) + (spike ? 150 : 0));
  return { id, activity, power, pollution: spike ? 1 : 0, demandMW, occupancyPct, aqi, events: kinds };
}

export function readCity(bases: Record<DistrictId, DistrictBase>, hour: number, cityActivity: number, events: readonly CityEvent[]) {
  return DISTRICT_ORDER.map((id) => readDistrict(id, bases[id], hour, cityActivity, events));
}

/** 24 hourly samples of one district's simulated demand (MW), for the sparkline. */
export function demandCurve(id: DistrictId, base: DistrictBase, cityActivity: number, events: readonly CityEvent[]) {
  return Array.from({ length: 25 }, (_, h) => readDistrict(id, base, h, cityActivity, events).demandMW);
}

export function aggregateBases(buildings: readonly { district: DistrictId; metrics: { energyMWhDay: number; occupancyPct: number; airQualityIndex: number } }[]) {
  const out = Object.fromEntries(DISTRICT_ORDER.map((id) => [id, { buildings: 0, energyMWhDay: 0, occupancyPct: 0, aqi: 0 }])) as Record<DistrictId, DistrictBase>;
  for (const b of buildings) {
    const d = out[b.district];
    d.buildings++;
    d.energyMWhDay += b.metrics.energyMWhDay;
    d.occupancyPct += b.metrics.occupancyPct;
    d.aqi += b.metrics.airQualityIndex;
  }
  for (const id of DISTRICT_ORDER) {
    const d = out[id];
    if (d.buildings) {
      d.occupancyPct /= d.buildings;
      d.aqi /= d.buildings;
    } else {
      // The plaza has no procedural buildings besides the spire; give it a civic baseline.
      d.energyMWhDay = d.energyMWhDay || 40;
      d.occupancyPct = 60;
      d.aqi = 30;
    }
  }
  return out;
}

/** Index of each district in shader uniform arrays (index 5 = outside the city). */
export const DISTRICT_INDEX: Record<DistrictId, number> = Object.fromEntries(DISTRICT_ORDER.map((id, i) => [id, i])) as Record<DistrictId, number>;
export const OUTSIDE_INDEX = 5;
