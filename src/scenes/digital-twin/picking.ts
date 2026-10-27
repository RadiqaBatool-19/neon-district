import type * as THREE from 'three';
import { distanceToLines, type TwinModel } from '../../data/digital-twin/buildTwinModel';
import { useTwinStore, type MeasurePoint } from '../../stores/twinStore';

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

/** Shared click routing for ground and buildings. */
export function handleSceneClick(model: TwinModel, point: THREE.Vector3, buildingIndex: number | null) {
  const s = useTwinStore.getState();
  if (s.tool !== 'none') {
    s.addPoint(toMeasurePoint(model, point, s.exaggeration, buildingIndex));
    return;
  }
  if (buildingIndex !== null) {
    s.select({ kind: 'building', index: buildingIndex });
    return;
  }
  const road = s.layers.roads ? pickRoad(model, point) : null;
  s.select(road !== null ? { kind: 'road', index: road } : null);
}
