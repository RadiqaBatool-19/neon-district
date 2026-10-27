import type { TwinFilters } from '../../stores/twinStore';
import type { TwinBuilding } from './buildTwinModel';

/** True if a building passes the active attribute filters (type, height range, height source). */
export function passesFilters(b: TwinBuilding, f: TwinFilters) {
  return (f.types === null || f.types.includes(b.typeKey)) && b.height >= f.heightMin && b.height <= f.heightMax + 0.01 && f.sources[b.source];
}
