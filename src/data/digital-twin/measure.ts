import type { MeasurePoint } from '../../stores/twinStore';

/**
 * Measurements on the WGS84 ellipsoid, from lon/lat — independent of the scene's
 * local projection. Distances use Vincenty's inverse formula; areas use a local
 * ellipsoidal tangent plane at the polygon centroid (error ≪ 0.01 % at the
 * sub-kilometre scale of an area extract). Checked against QGIS
 * QgsDistanceArea (EPSG:7030) and planar UTM 43N during development.
 */

const A = 6378137;
const F = 1 / 298.257223563;
const B = A * (1 - F);
const rad = (d: number) => (d * Math.PI) / 180;

/** Ellipsoidal distance (m) between two lon/lat points (Vincenty inverse). */
export function vincentyDistance(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const L = rad(lon2 - lon1);
  const U1 = Math.atan((1 - F) * Math.tan(rad(lat1)));
  const U2 = Math.atan((1 - F) * Math.tan(rad(lat2)));
  const sinU1 = Math.sin(U1);
  const cosU1 = Math.cos(U1);
  const sinU2 = Math.sin(U2);
  const cosU2 = Math.cos(U2);
  let lambda = L;
  let sinSigma = 0;
  let cosSigma = 1;
  let sigma = 0;
  let cos2Alpha = 1;
  let cos2SigmaM = 0;
  for (let i = 0; i < 200; i++) {
    const sinLambda = Math.sin(lambda);
    const cosLambda = Math.cos(lambda);
    sinSigma = Math.hypot(cosU2 * sinLambda, cosU1 * sinU2 - sinU1 * cosU2 * cosLambda);
    if (sinSigma === 0) return 0;
    cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosLambda;
    sigma = Math.atan2(sinSigma, cosSigma);
    const sinAlpha = (cosU1 * cosU2 * sinLambda) / sinSigma;
    cos2Alpha = 1 - sinAlpha * sinAlpha;
    cos2SigmaM = cos2Alpha !== 0 ? cosSigma - (2 * sinU1 * sinU2) / cos2Alpha : 0;
    const C = (F / 16) * cos2Alpha * (4 + F * (4 - 3 * cos2Alpha));
    const prev = lambda;
    lambda = L + (1 - C) * F * sinAlpha * (sigma + C * sinSigma * (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM)));
    if (Math.abs(lambda - prev) < 1e-12) break;
  }
  const u2 = (cos2Alpha * (A * A - B * B)) / (B * B);
  const Acoef = 1 + (u2 / 16384) * (4096 + u2 * (-768 + u2 * (320 - 175 * u2)));
  const Bcoef = (u2 / 1024) * (256 + u2 * (-128 + u2 * (74 - 47 * u2)));
  const deltaSigma =
    Bcoef * sinSigma * (cos2SigmaM + (Bcoef / 4) * (cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM) - (Bcoef / 6) * cos2SigmaM * (-3 + 4 * sinSigma * sinSigma) * (-3 + 4 * cos2SigmaM * cos2SigmaM)));
  return B * Acoef * (sigma - deltaSigma);
}

export interface DistanceResult {
  segmentsM: number[];
  totalM: number;
  elevationDeltaM: number | null;
  slopeDistanceM: number | null;
}

export function measureDistance(points: MeasurePoint[]): DistanceResult | null {
  if (points.length < 2) return null;
  const segmentsM: number[] = [];
  let slope = 0;
  let hasElev = true;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const d = vincentyDistance(a.lon, a.lat, b.lon, b.lat);
    segmentsM.push(d);
    if (a.elevation === null || b.elevation === null) hasElev = false;
    else slope += Math.hypot(d, b.elevation - a.elevation);
  }
  const first = points[0].elevation;
  const last = points[points.length - 1].elevation;
  return {
    segmentsM,
    totalM: segmentsM.reduce((x, y) => x + y, 0),
    elevationDeltaM: first !== null && last !== null ? last - first : null,
    slopeDistanceM: hasElev ? slope : null,
  };
}

export interface AreaResult {
  areaM2: number;
  perimeterM: number;
}

export function measureArea(points: MeasurePoint[]): AreaResult | null {
  if (points.length < 3) return null;
  const lat0 = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const lon0 = points.reduce((s, p) => s + p.lon, 0) / points.length;
  const phi = rad(lat0);
  // Meridional and prime-vertical radii of curvature at the centroid.
  const e2 = F * (2 - F);
  const w = Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
  const M = (A * (1 - e2)) / w ** 3;
  const N = A / w;
  const xy = points.map((p) => [rad(p.lon - lon0) * N * Math.cos(phi), rad(p.lat - lat0) * M]);
  let twice = 0;
  for (let i = 0; i < xy.length; i++) {
    const [x1, y1] = xy[i];
    const [x2, y2] = xy[(i + 1) % xy.length];
    twice += x1 * y2 - x2 * y1;
  }
  let perimeterM = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    perimeterM += vincentyDistance(a.lon, a.lat, b.lon, b.lat);
  }
  return { areaM2: Math.abs(twice) / 2, perimeterM };
}

export function formatLength(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${m.toFixed(m < 10 ? 2 : 1)} m`;
}

export function formatArea(m2: number): string {
  return m2 >= 100000 ? `${(m2 / 1e6).toFixed(3)} km²` : `${Math.round(m2).toLocaleString()} m²`;
}

export function formatLonLat(lon: number, lat: number): string {
  return `${lat.toFixed(6)}° N, ${lon.toFixed(6)}° E`;
}
