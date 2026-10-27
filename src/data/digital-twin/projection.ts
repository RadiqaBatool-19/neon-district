import type { LonLat } from './types';

/**
 * Local tangent-plane projection around one fixed regional origin.
 *
 * Every area in the Islamabad–Rawalpindi region is projected against the SAME
 * origin, so extracts loaded later line up exactly. Scene axes: +x east,
 * +z south, +y up (metres). Scale factors use the WGS84 ellipsoid series at the
 * origin latitude; over a ~30 km region the distortion stays well under 0.5 %.
 * Reported distances and areas do not rely on this: they are computed
 * geodesically from lon/lat (see measure.ts).
 */
export class LocalProjection {
  readonly origin: LonLat;
  readonly mPerDegLon: number;
  readonly mPerDegLat: number;

  constructor(origin: LonLat) {
    this.origin = origin;
    const phi = (origin.lat * Math.PI) / 180;
    this.mPerDegLat = 111132.92 - 559.82 * Math.cos(2 * phi) + 1.175 * Math.cos(4 * phi);
    this.mPerDegLon = 111412.84 * Math.cos(phi) - 93.5 * Math.cos(3 * phi);
  }

  /** WGS84 → scene metres [x, z]. */
  project(lon: number, lat: number): [number, number] {
    return [(lon - this.origin.lon) * this.mPerDegLon, -(lat - this.origin.lat) * this.mPerDegLat];
  }

  /** Scene metres → WGS84. */
  unproject(x: number, z: number): LonLat {
    return { lon: this.origin.lon + x / this.mPerDegLon, lat: this.origin.lat - z / this.mPerDegLat };
  }
}
