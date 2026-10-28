import type { Position } from 'geojson';
import type { TwinModel } from './buildTwinModel';
import { vincentyDistance } from './measure';
import type { BuildingProps } from './types';

/**
 * Structured facts about one building, split by provenance:
 * - `source`: values exactly as tagged in OpenStreetMap (null = not tagged);
 * - `derived`: values computed by the pipeline or the app, each with its method;
 * - synthetic metrics live on `TwinBuilding.sim` and are never mixed in here.
 *
 * Pure data, so the inspector, a comparison table and CSV / GeoJSON export can
 * all present the same values. Missing values stay `null` — never estimated.
 */

export interface Fact {
  key: string;
  label: string;
  /** Formatted value, or null when the source has no value. */
  value: string | null;
  /** Raw value for export (number in the stated unit, or the tag string). */
  raw: string | number | null;
  unit?: string;
  /** How the value was obtained (derived facts only). */
  method?: string;
  /** True when the value rests on an estimated (not recorded) height. */
  estimated?: boolean;
}

export interface BuildingFacts {
  source: Fact[];
  derived: Fact[];
}

export const NOT_AVAILABLE = 'Not available';

const tag = (p: BuildingProps, k: string): string | null => {
  const v = p[k];
  return v === null || v === undefined || v === '' ? null : String(v);
};

const fact = (key: string, label: string, raw: string | number | null, value: string | null = raw === null ? null : String(raw), extra: Partial<Fact> = {}): Fact => ({ key, label, raw, value, ...extra });

/** Postal address from addr:* tags, or null if none are tagged. */
export function addressOf(p: BuildingProps): string | null {
  const parts = [[tag(p, 'addr:housenumber'), tag(p, 'addr:street')].filter(Boolean).join(' '), tag(p, 'addr:city'), tag(p, 'addr:postcode')].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

/** Use tags (amenity, shop, office, …) as `key=value` pairs, or null if none. */
export function useOf(p: BuildingProps): string | null {
  const uses = ['amenity', 'shop', 'office', 'tourism', 'leisure', 'building:use'].map((k) => (tag(p, k) ? `${k}=${tag(p, k)}` : null)).filter(Boolean);
  return uses.length ? uses.join(' · ') : null;
}

function ringPerimeter(ring: Position[]) {
  let m = 0;
  for (let i = 1; i < ring.length; i++) m += vincentyDistance(ring[i - 1][0], ring[i - 1][1], ring[i][0], ring[i][1]);
  return m;
}

const HEIGHT_METHOD = {
  recorded: 'OSM height tag',
  estimated_from_levels: 'Estimated: building:levels × 3.0 m',
  estimated_default: 'Estimated: default for the building type',
} as const;

export function buildingFacts(model: TwinModel, index: number): BuildingFacts {
  const b = model.buildings[index];
  const p = b.props;
  const feature = model.data.buildings.features[index];
  const outerRings = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates[0]] : feature.geometry.coordinates.map((poly) => poly[0]);
  const perimeter = outerRings.reduce((s, r) => s + ringPerimeter(r), 0);
  const centroid = model.projection.unproject(b.centroid[0] + model.areaOffset[0], b.centroid[1] + model.areaOffset[1]);
  const levels = tag(p, 'building:levels');
  const ground = model.terrain ? model.terrain.baseElevation + b.baseY : null;
  const volume = b.footprintArea * (b.height - b.minHeight);
  // The model falls back to a placeholder distance when the extract has no major road; never show that.
  const hasMajorRoad = model.roads.some((r) => r.cls === 'major' || r.cls === 'transit');
  const roadDist = hasMajorRoad && Number.isFinite(b.distToMajorRoad) ? Math.round(b.distToMajorRoad) : null;

  const source: Fact[] = [
    fact('building', 'Building type', tag(p, 'building'), undefined, { method: 'OSM tag building=*' }),
    fact('name', 'Name', tag(p, 'name')),
    ...(tag(p, 'name:en') ? [fact('name:en', 'Name (English)', tag(p, 'name:en'))] : []),
    fact('address', 'Address', addressOf(p), undefined, { method: 'OSM addr:* tags' }),
    fact('use', 'Use', useOf(p), undefined, { method: 'OSM amenity, shop, office, tourism, leisure or building:use tags' }),
    fact('operator', 'Operator', tag(p, 'operator')),
    fact('height', 'Height tag', tag(p, 'height'), undefined, { method: 'OSM tag height=* (metres unless a unit is given)' }),
    fact('building:levels', 'Levels', levels, undefined, { method: 'OSM tag building:levels=* (floors above ground)' }),
    fact('min_height', 'Min. height', tag(p, 'min_height'), undefined, { method: 'OSM tag min_height=* (height of the lowest part above ground)' }),
  ];

  const derived: Fact[] = [
    fact('height_m', 'Height used in 3D', +b.height.toFixed(1), `${b.height.toFixed(1)} m`, { unit: 'm', method: HEIGHT_METHOD[b.source], estimated: b.source !== 'recorded' }),
    fact('height_source', 'Height source', b.source, b.source.replace(/_/g, ' '), { method: 'Pipeline rule (meta.json)' }),
    fact('footprint_area_m2', 'Footprint area', +b.footprintArea.toFixed(1), `${Math.round(b.footprintArea).toLocaleString()} m²`, { unit: 'm²', method: 'QGIS, planar in EPSG:32643 (UTM 43N)' }),
    fact('perimeter_m', 'Perimeter', +perimeter.toFixed(1), `${perimeter.toFixed(1)} m`, { unit: 'm', method: 'Ellipsoidal (Vincenty, WGS84), outer ring' }),
    fact(
      'volume_m3',
      'Volume',
      Math.round(volume),
      `${Math.round(volume).toLocaleString()} m³`,
      { unit: 'm³', method: b.source === 'recorded' ? 'Footprint × recorded height' : 'Uses an estimated height — indicative only', estimated: b.source !== 'recorded' },
    ),
    fact('ground_elevation_m', 'Ground elevation', ground === null ? null : +ground.toFixed(1), ground === null ? null : `${ground.toFixed(1)} m ASL`, {
      unit: 'm ASL',
      method: 'Copernicus DEM GLO-30 (surface model), lowest sample under the footprint',
    }),
    fact('centroid', 'Centroid', `${centroid.lat.toFixed(6)}, ${centroid.lon.toFixed(6)}`, `${centroid.lat.toFixed(6)}, ${centroid.lon.toFixed(6)}`, { method: 'Vertex mean of the outer ring, WGS84' }),
    fact('dist_major_road_m', 'Nearest major road', roadDist, roadDist === null ? null : `${roadDist} m`, {
      unit: 'm',
      method: 'Centroid to the nearest primary / secondary road centreline in this extract',
    }),
  ];

  return { source, derived };
}

/** Numeric derived facts where a min / max across buildings can be meaningful. */
const COMPARABLE = new Set(['height_m', 'footprint_area_m2', 'perimeter_m', 'volume_m3', 'ground_elevation_m', 'dist_major_road_m']);

export interface CompareRow {
  key: string;
  label: string;
  group: 'source' | 'derived';
  /** One cell per compared building; null for a building that is not loaded. */
  cells: (Fact | null)[];
  /** Shared method when every building uses the same one; otherwise shown per cell. */
  method: string | null;
  /**
   * Min / max to highlight, or null when the comparison would mislead: fewer
   * than two values, a missing value, or any value resting on an estimate.
   */
  extremes: { min: number; max: number } | null;
}

/**
 * Rows for a side-by-side comparison, built from the same facts as the
 * inspector. Rows follow the order of the first loaded building, plus any
 * conditional rows (e.g. name:en) another building adds.
 */
export function compareRows(list: (BuildingFacts | null)[]): CompareRow[] {
  const rows: CompareRow[] = [];
  for (const group of ['source', 'derived'] as const) {
    const order: { key: string; label: string }[] = [];
    for (const f of list) for (const x of f?.[group] ?? []) if (!order.some((o) => o.key === x.key)) order.push({ key: x.key, label: x.label });
    for (const { key, label } of order) {
      const cells = list.map((f) => (f ? f[group].find((x) => x.key === key) ?? { key, label, raw: null, value: null } : null));
      const loaded = cells.filter((c): c is Fact => c !== null);
      const methods = new Set(loaded.map((c) => c.method ?? ''));
      let extremes: CompareRow['extremes'] = null;
      if (COMPARABLE.has(key) && loaded.length >= 2 && loaded.every((c) => typeof c.raw === 'number' && !c.estimated)) {
        const nums = loaded.map((c) => c.raw as number);
        const min = Math.min(...nums);
        const max = Math.max(...nums);
        if (max > min) extremes = { min, max };
      }
      // The volume label varies with each building's height source; the row needs a neutral one.
      const rowLabel = key === 'volume_m3' ? 'Volume' : label;
      rows.push({ key, label: rowLabel, group, cells, method: methods.size === 1 ? [...methods][0] || null : null, extremes });
    }
  }
  return rows;
}
