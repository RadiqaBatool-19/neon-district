import * as THREE from 'three';
import { distanceToLines, type TwinModel } from '../../data/digital-twin/buildTwinModel';
import { useTwinStore, type MeasurePoint } from '../../stores/twinStore';

/**
 * Surface point under the pointer while a measure tool is active. Mutable on
 * purpose: written on every pointer move and read in the render loop by the
 * rubber-band preview, so moving the mouse never triggers a React re-render.
 */
export const measureCursor = {
  active: false,
  point: new THREE.Vector3(),
  building: null as number | null,
};

export function updateMeasureCursor(point: THREE.Vector3, buildingIndex: number | null) {
  if (useTwinStore.getState().tool === 'none') {
    measureCursor.active = false;
    return;
  }
  measureCursor.active = true;
  measureCursor.point.copy(point);
  measureCursor.building = buildingIndex;
}

export function clearMeasureCursor() {
  measureCursor.active = false;
}

/** Convert a picked world point (region metres) to a measurement point with lon/lat and elevation. */
export function toMeasurePoint(model: TwinModel, p: THREE.Vector3, exaggeration: number, buildingIndex: number | null): MeasurePoint {
  const ll = model.projection.unproject(p.x, p.z);
  let elevation: number | null = null;
  if (model.terrain) {
    const base = model.terrain.baseElevation;
    if (buildingIndex !== null) {
      const b = model.buildings[buildingIndex];
      elevation = base + b.baseY + (p.y - b.baseY * exaggeration);
    } else {
      elevation = base + p.y / exaggeration;
    }
  }
  return { x: p.x, y: p.y, z: p.z, lon: ll.lon, lat: ll.lat, elevation };
}

/** Ground click with no tool active: select the nearest road under the cursor, if any. */
export function pickRoad(model: TwinModel, p: THREE.Vector3): number | null {
  const lx = p.x - model.areaOffset[0];
  const lz = p.z - model.areaOffset[1];
  let best: number | null = null;
  let bestD = Infinity;
  for (const r of model.roads) {
    const d = distanceToLines(lx, lz, r.lines) - r.widthM / 2;
    if (d < Math.max(2.5, 0) && d < bestD) {
      bestD = d;
      best = r.index;
    }
  }
  return best;
}

/**
 * Shared click routing for ground and buildings. With a measure tool active,
 * clicks place points. In compare mode, or with Shift held, a building click
 * adds it to / removes it from the comparison and leaves the single selection
 * alone. Otherwise clicks inspect.
 */
export function handleSceneClick(model: TwinModel, point: THREE.Vector3, buildingIndex: number | null, shiftKey = false) {
  const s = useTwinStore.getState();
  if (s.tool !== 'none') {
    s.addPoint(toMeasurePoint(model, point, s.exaggeration, buildingIndex));
    return;
  }
  if (s.compareMode || shiftKey) {
    const b = buildingIndex !== null ? model.buildings[buildingIndex] : undefined;
    if (b) s.toggleCompare(String(b.props.osm_id));
    return;
  }
  if (buildingIndex !== null) {
    s.select({ kind: 'building', index: buildingIndex });
    return;
  }
  const road = s.layers.roads ? pickRoad(model, point) : null;
  s.select(road !== null ? { kind: 'road', index: road } : null);
}
