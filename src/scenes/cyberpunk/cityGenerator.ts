import { CITY, HALF_GRID, PITCH } from '../../data/cyberpunk/config';
import { DISTRICTS, type DistrictId } from '../../data/cyberpunk/districts';
import { simulateBuildingMetrics, type SimulatedBuildingMetrics } from '../../data/cyberpunk/simulatedMetrics';
import { createRng, type Rng } from '../../utils/random';

/**
 * Pure, deterministic city generator. Produces plain data only — no Three.js
 * objects — so it can be unit-tested, cached, or moved into a worker later.
 */

export type PartShape = 'box' | 'oct' | 'cyl' | 'spire';

/** Facade window style: 0 punched grid, 1 glass ribbon, 2 small residential, 3 bare metal. */
export type FacadeStyle = 0 | 1 | 2 | 3;

export interface BuildingPart {
  shape: PartShape;
  /** Base centre. */
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  rx: number;
  ry: number;
  rz: number;
  buildingId: number;
  style: FacadeStyle;
  /** Top part of the building: receives the crown accent band. */
  crown: boolean;
}

export interface CityBuilding {
  id: number;
  name: string;
  type: string;
  district: DistrictId;
  height: number;
  floors: number;
  /** Footprint bounds (for camera framing). */
  x: number;
  z: number;
  w: number;
  d: number;
  seed: number;
  windowWidth: number;
  floorHeight: number;
  litRatio: number;
  hero: boolean;
  metrics: SimulatedBuildingMetrics;
}

export type RoofPropKind = 'ac' | 'tank' | 'antenna' | 'dish' | 'helipad';

export interface RoofProp {
  kind: RoofPropKind;
  x: number;
  y: number;
  z: number;
  s: number;
  h: number;
}

export type SignStyle = 'blade' | 'billboard' | 'band';

export interface SignDef {
  style: SignStyle;
  x: number;
  y: number;
  z: number;
  rotY: number;
  w: number;
  h: number;
  word: number;
  color: string;
  /** 0 steady, 1 occasional flicker, 2 animated chase. */
  anim: 0 | 1 | 2;
  seed: number;
}

export interface StreetLight {
  x: number;
  z: number;
  /** Direction the arm points (radians). */
  rot: number;
}

export interface BlockDef {
  ix: number;
  iz: number;
  x: number;
  z: number;
  district: DistrictId;
}

export interface CityPlan {
  blocks: BlockDef[];
  buildings: CityBuilding[];
  parts: BuildingPart[];
  roofProps: RoofProp[];
  beacons: { x: number; y: number; z: number }[];
  signs: SignDef[];
  streetLights: StreetLight[];
  districtCenters: Record<DistrictId, { x: number; z: number; maxHeight: number }>;
}

export const HORIZONTAL_WORDS = ['NEXUS', 'KAIRO', 'SYNTH', 'VANTA', 'ORBITAL', 'MIRAI', 'RAMEN', 'HOTEL', 'NOVA', 'HYPERLINK', 'LUX', 'ZERO-G', 'ARCADE', 'SOMA'] as const;
export const VERTICAL_WORDS = ['BAR', 'NOODL', 'CYBER', 'OPEN', 'TECH', 'KIRA', 'HOTEL', 'VOID'] as const;

const SIGN_COLORS = ['#3ef0ff', '#ff2bd6', '#8b5cff', '#ff4f9a', '#2b7bff', '#ffb347', '#7dffb2'];

const NAME_PARTS: Record<DistrictId, [string[], string[]]> = {
  plaza: [['Aurora'], ['Spire']],
  financial: [
    ['Helix', 'Aurum', 'Meridian', 'Vantage', 'Obsidian', 'Zenith', 'Argent', 'Paragon', 'Sable', 'Quantum', 'Halcyon', 'Cobalt', 'Lattice', 'Prism'],
    ['Tower', 'Exchange', 'Center', 'Spire', 'Capital', 'One', 'Trust Building'],
  ],
  market: [
    ['Kiyo', 'Lumen', 'Hanabi', 'Neko', 'Pulse', 'Ozone', 'Glitch', 'Saki', 'Momo', 'Static', 'Velvet', 'Koi'],
    ['Arcade', 'Market Hall', 'Block', 'Galleria', 'Stacks', 'Bazaar', 'Night Market'],
  ],
  industrial: [
    ['Forge', 'Ferro', 'Kinetic', 'Voltaic', 'Cobalt', 'Tesla', 'Anvil', 'Gantry', 'Carbon'],
    ['Works', 'Fabricator', 'Plant', 'Depot', 'Foundry', 'Power Station', 'Logistics Hub'],
  ],
  residential: [
    ['Willow', 'Cedar', 'Harbor', 'Aster', 'Linden', 'Marlow', 'Juniper', 'Hollow', 'Rowan'],
    ['Residences', 'Court', 'Heights', 'Commons', 'Terrace', 'House'],
  ],
};

const TYPES: Record<DistrictId, string[]> = {
  plaza: ['Civic landmark · observation tower'],
  financial: ['Office tower', 'Corporate headquarters', 'Mixed-use tower', 'Trading floor & offices'],
  market: ['Retail & dining', 'Mixed-use market block', 'Entertainment complex', 'Micro-apartments over retail'],
  industrial: ['Fabrication plant', 'Logistics depot', 'Energy substation', 'Data & cooling facility'],
  residential: ['Apartment block', 'Residential tower', 'Co-living complex', 'Townhouse terrace'],
};

function districtFor(ix: number, iz: number): DistrictId {
  const dx = ix - HALF_GRID;
  const dz = iz - HALF_GRID;
  if (dx === 0 && dz === 0) return 'plaza';
  const r = Math.max(Math.abs(dx), Math.abs(dz));
  if (r === 1) return dx === -1 ? 'market' : 'financial';
  // Sectors (screen space: -z is north).
  const ang = Math.atan2(dz, dx);
  const q = Math.PI / 4;
  if (ang > -3 * q && ang <= -q) return 'financial';
  if (ang > -q && ang <= q) return 'industrial';
  if (ang > q && ang <= 3 * q) return 'residential';
  return 'market';
}

/** Split [-half, half] into n segments separated by gaps; returns [centre, size][]. */
function splitSpan(half: number, n: number, gap: number, rng: Rng): [number, number][] {
  const total = half * 2 - gap * (n - 1);
  const weights = Array.from({ length: n }, () => rng.range(0.7, 1.3));
  const sum = weights.reduce((a, b) => a + b, 0);
  let cursor = -half;
  return weights.map((w) => {
    const size = (w / sum) * total;
    const c = cursor + size / 2;
    cursor += size + gap;
    return [c, size];
  });
}

export function generateCity(seed = CITY.seed): CityPlan {
  const rng = createRng(seed);
  const plan: CityPlan = {
    blocks: [],
    buildings: [],
    parts: [],
    roofProps: [],
    beacons: [],
    signs: [],
    streetLights: [],
    districtCenters: {} as CityPlan['districtCenters'],
  };
  const usedNames = new Set<string>();
  const inner = CITY.blockSize / 2 - CITY.sidewalk;

  const nameFor = (district: DistrictId) => {
    const [a, b] = NAME_PARTS[district];
    for (let tries = 0; tries < 20; tries++) {
      const n = `${rng.pick(a)} ${rng.pick(b)}`;
      if (!usedNames.has(n)) {
        usedNames.add(n);
        return n;
      }
    }
    const n = `${rng.pick(a)} ${rng.pick(b)} ${rng.int(2, 9)}`;
    usedNames.add(n);
    return n;
  };

  const addPart = (p: Omit<BuildingPart, 'rx' | 'ry' | 'rz' | 'crown'> & Partial<Pick<BuildingPart, 'rx' | 'ry' | 'rz' | 'crown'>>) => {
    plan.parts.push({ rx: 0, ry: 0, rz: 0, crown: false, ...p });
  };

  const addRoof = (x: number, y: number, z: number, w: number, d: number, tall: boolean, district: DistrictId, brng: Rng) => {
    const area = w * d;
    const acCount = Math.min(10, Math.floor(area / 90) + brng.int(0, 2));
    for (let i = 0; i < acCount; i++) {
      plan.roofProps.push({ kind: 'ac', x: x + brng.range(-w / 2 + 1.5, w / 2 - 1.5), y, z: z + brng.range(-d / 2 + 1.5, d / 2 - 1.5), s: brng.range(1.6, 3.2), h: brng.range(1, 2) });
    }
    if (district !== 'financial' && brng.chance(0.45)) {
      plan.roofProps.push({ kind: 'tank', x: x + brng.range(-w / 3, w / 3), y, z: z + brng.range(-d / 3, d / 3), s: brng.range(2, 3.2), h: brng.range(3, 5) });
    }
    if (tall) {
      if (brng.chance(0.55)) {
        const ah = brng.range(10, 28);
        const ax = x + brng.range(-w / 4, w / 4);
        const az = z + brng.range(-d / 4, d / 4);
        plan.roofProps.push({ kind: 'antenna', x: ax, y, z: az, s: brng.range(0.25, 0.45), h: ah });
        plan.beacons.push({ x: ax, y: y + ah, z: az });
      }
      if (district === 'financial' && w > 18 && d > 18 && brng.chance(0.3)) {
        plan.roofProps.push({ kind: 'helipad', x, y, z, s: Math.min(w, d) * 0.7, h: 0.6 });
      }
      // Aviation beacons at roof corners.
      plan.beacons.push({ x: x - w / 2 + 0.4, y: y + 0.6, z: z - d / 2 + 0.4 }, { x: x + w / 2 - 0.4, y: y + 0.6, z: z + d / 2 - 0.4 });
    } else if (brng.chance(0.25)) {
      plan.roofProps.push({ kind: 'dish', x: x + brng.range(-w / 3, w / 3), y, z: z + brng.range(-d / 3, d / 3), s: brng.range(1.2, 2.2), h: 1.5 });
    }
  };

  /** Blade signs projecting from facades toward the street. */
  const addBlades = (cx: number, cz: number, w: number, d: number, baseY: number, topY: number, brng: Rng, count: number) => {
    for (let i = 0; i < count; i++) {
      const face = brng.int(0, 3);
      const bw = brng.range(1.6, 2.6);
      // Aspect kept between 3.5:1 and 6:1 so stacked letters fit the atlas column.
      const bh = Math.min(topY - baseY - 4, Math.max(bw * 3.5, Math.min(bw * 6, brng.range(6, 15))));
      if (bh < 4) continue;
      const y = baseY + brng.range(4, Math.max(4.5, topY - baseY - bh - 1)) + bh / 2;
      const along = brng.range(-0.38, 0.38);
      let x = cx;
      let z = cz;
      let rotY = 0;
      if (face === 0) { x = cx + w / 2 + bw / 2 + 0.25; z = cz + along * d; rotY = 0; }
      else if (face === 1) { x = cx - w / 2 - bw / 2 - 0.25; z = cz + along * d; rotY = 0; }
      else if (face === 2) { z = cz + d / 2 + bw / 2 + 0.25; x = cx + along * w; rotY = Math.PI / 2; }
      else { z = cz - d / 2 - bw / 2 - 0.25; x = cx + along * w; rotY = Math.PI / 2; }
      plan.signs.push({ style: 'blade', x, y, z, rotY, w: bw, h: bh, word: brng.int(0, VERTICAL_WORDS.length - 1), color: brng.pick(SIGN_COLORS), anim: brng.chance(0.15) ? 1 : brng.chance(0.15) ? 2 : 0, seed: brng.int(0, 9999) });
    }
  };

  const addBillboard = (cx: number, cz: number, w: number, d: number, roofY: number, brng: Rng, color?: string) => {
    const face = brng.int(0, 3);
    const bw = Math.min(face < 2 ? d : w, brng.range(10, 18));
    const bh = bw * brng.range(0.3, 0.42);
    const rotY = [Math.PI / 2, -Math.PI / 2, 0, Math.PI][face];
    const off = 0.5;
    const x = face === 0 ? cx + w / 2 - off : face === 1 ? cx - w / 2 + off : cx;
    const z = face === 2 ? cz + d / 2 - off : face === 3 ? cz - d / 2 + off : cz;
    plan.signs.push({ style: 'billboard', x, y: roofY + bh / 2 + 1.2, z, rotY, w: bw, h: bh, word: brng.int(0, HORIZONTAL_WORDS.length - 1), color: color ?? brng.pick(SIGN_COLORS), anim: brng.chance(0.3) ? 2 : 0, seed: brng.int(0, 9999) });
  };

  const addBand = (cx: number, cz: number, w: number, d: number, y: number, brng: Rng, color: string) => {
    const face = brng.int(0, 3);
    const bw = (face < 2 ? d : w) * 0.7;
    const bh = Math.min(4, bw * 0.22);
    const rotY = [Math.PI / 2, -Math.PI / 2, 0, Math.PI][face];
    const x = face === 0 ? cx + w / 2 + 0.15 : face === 1 ? cx - w / 2 - 0.15 : cx;
    const z = face === 2 ? cz + d / 2 + 0.15 : face === 3 ? cz - d / 2 - 0.15 : cz;
    plan.signs.push({ style: 'band', x, y, z, rotY, w: bw, h: bh, word: brng.int(0, HORIZONTAL_WORDS.length - 1), color, anim: 0, seed: brng.int(0, 9999) });
  };

  const makeBuilding = (district: DistrictId, cx: number, cz: number, lw: number, ld: number, ring: number) => {
    const id = plan.buildings.length;
    const bseed = rng.int(1, 2 ** 30);
    const brng = createRng(bseed);
    const def = DISTRICTS[district];
    const falloff = Math.max(0.35, 1 - ((ring - 1) / HALF_GRID) * 0.75);
    let H = brng.range(def.height[0], def.height[1]) * falloff;
    const w = lw * brng.range(0.82, 0.96);
    const d = ld * brng.range(0.82, 0.96);
    let style: FacadeStyle = 0;
    let windowWidth = 2.6;
    let floorHeight: number = CITY.floorHeight;
    let topW = w;
    let topD = d;
    let topX = cx;
    let topZ = cz;
    let topY = 0;
    const startParts = plan.parts.length;

    if (district === 'financial') {
      style = brng.chance(0.55) ? 1 : 0;
      windowWidth = brng.range(1.5, 2.1);
      floorHeight = 3.9;
      const arche = brng.pick(['tiered', 'oct', 'podiumTower', 'twin', 'slab'] as const);
      if (arche === 'tiered') {
        const h1 = Math.min(18, H * 0.12);
        const h2 = H * 0.56;
        const h3 = H - h1 - h2;
        addPart({ shape: 'box', x: cx, y: 0, z: cz, w, h: h1, d, buildingId: id, style: 0 });
        addPart({ shape: 'box', x: cx, y: h1, z: cz, w: w * 0.82, h: h2, d: d * 0.82, buildingId: id, style });
        addPart({ shape: 'box', x: cx, y: h1 + h2, z: cz, w: w * 0.6, h: h3, d: d * 0.6, buildingId: id, style, crown: true });
        topW = w * 0.6; topD = d * 0.6; topY = H;
      } else if (arche === 'oct') {
        const dia = Math.min(w, d) * 0.92;
        const h1 = H * 0.84;
        addPart({ shape: 'oct', x: cx, y: 0, z: cz, w: dia, h: h1, d: dia, buildingId: id, style });
        addPart({ shape: 'oct', x: cx, y: h1, z: cz, w: dia * 0.72, h: H - h1, d: dia * 0.72, buildingId: id, style, crown: true });
        topW = topD = dia * 0.5; topY = H;
      } else if (arche === 'podiumTower') {
        const ph = brng.range(10, 16);
        addPart({ shape: 'box', x: cx, y: 0, z: cz, w, h: ph, d, buildingId: id, style: 0 });
        const tw = w * brng.range(0.45, 0.6);
        const td = d * brng.range(0.45, 0.6);
        topX = cx + brng.range(-1, 1) * (w - tw) * 0.4;
        topZ = cz + brng.range(-1, 1) * (d - td) * 0.4;
        addPart({ shape: 'box', x: topX, y: ph, z: topZ, w: tw, h: H - ph, d: td, buildingId: id, style, crown: true });
        topW = tw; topD = td; topY = H;
      } else if (arche === 'twin') {
        const tw = w * 0.38;
        const ph = brng.range(8, 12);
        addPart({ shape: 'box', x: cx, y: 0, z: cz, w, h: ph, d, buildingId: id, style: 0 });
        const h2 = H * brng.range(0.72, 0.88);
        addPart({ shape: 'box', x: cx - w / 2 + tw / 2, y: ph, z: cz, w: tw, h: H - ph, d: d * 0.8, buildingId: id, style, crown: true });
        addPart({ shape: 'box', x: cx + w / 2 - tw / 2, y: ph, z: cz, w: tw, h: h2 - ph, d: d * 0.8, buildingId: id, style, crown: true });
        addPart({ shape: 'box', x: cx, y: h2 * 0.62, z: cz, w: w - tw * 2 + 0.4, h: 5, d: d * 0.3, buildingId: id, style: 1 });
        topX = cx - w / 2 + tw / 2; topW = tw; topD = d * 0.8; topY = H;
      } else {
        const sd = d * brng.range(0.42, 0.55);
        addPart({ shape: 'box', x: cx, y: 0, z: cz, w, h: H, d: sd, buildingId: id, style, crown: true });
        addPart({ shape: 'box', x: cx, y: 0, z: cz + (d - sd) / 2 * (brng.chance(0.5) ? 1 : -1), w: w * 0.5, h: H * 0.35, d: d - sd, buildingId: id, style: 0 });
        topD = sd; topY = H;
      }
      if (brng.chance(0.4)) addBand(topX, topZ, topW, topD, H - 6, brng, brng.pick(['#3ef0ff', '#8b5cff', '#2b7bff', '#e8f4ff']));
    } else if (district === 'market') {
      style = 0;
      windowWidth = brng.range(2.2, 3.2);
      floorHeight = 3.2;
      const base = brng.range(7, 12);
      addPart({ shape: 'box', x: cx, y: 0, z: cz, w, h: base, d, buildingId: id, style: 0 });
      let y = base;
      let cw = w * 0.92;
      let cd = d * 0.92;
      let ox = cx;
      let oz = cz;
      const tiers = brng.int(1, 3);
      for (let t = 0; t < tiers; t++) {
        const remaining = H - y;
        if (remaining < 6) break;
        const th = t === tiers - 1 ? remaining : remaining * brng.range(0.35, 0.6);
        cw = Math.max(6, cw * brng.range(0.75, 1.05));
        cd = Math.max(6, cd * brng.range(0.75, 1.05));
        ox = cx + brng.range(-1.6, 1.6);
        oz = cz + brng.range(-1.6, 1.6);
        addPart({ shape: 'box', x: ox, y, z: oz, w: cw, h: th, d: cd, buildingId: id, style, crown: t === tiers - 1 });
        y += th;
      }
      H = y;
      topX = ox; topZ = oz; topW = cw; topD = cd; topY = H;
      addBlades(cx, cz, w, d, 2, Math.min(H, 40), brng, brng.int(1, 3));
      if (brng.chance(0.45)) addBillboard(topX, topZ, topW, topD, H, brng);
    } else if (district === 'industrial') {
      style = 2;
      windowWidth = 4.2;
      floorHeight = 5.2;
      const sh = Math.max(8, H * 0.5);
      addPart({ shape: 'box', x: cx, y: 0, z: cz, w, h: sh, d, buildingId: id, style: 2, crown: true });
      addPart({ shape: 'box', x: cx, y: sh, z: cz, w: w * 0.28, h: 2.6, d: d * 0.85, buildingId: id, style: 3 });
      // Chimney.
      const chH = brng.range(22, 42) * Math.max(0.6, falloff);
      const chx = cx + (w / 2 - 3) * (brng.chance(0.5) ? 1 : -1);
      const chz = cz + (d / 2 - 3) * (brng.chance(0.5) ? 1 : -1);
      addPart({ shape: 'cyl', x: chx, y: 0, z: chz, w: 2.6, h: chH, d: 2.6, buildingId: id, style: 3, crown: true });
      plan.beacons.push({ x: chx, y: chH + 0.4, z: chz });
      // Tanks and pipe runs.
      if (brng.chance(0.6)) {
        const tx = cx - (w / 2 - 5) * (chx > cx ? 1 : -1);
        addPart({ shape: 'cyl', x: tx, y: sh, z: cz, w: 7, h: brng.range(5, 9), d: 7, buildingId: id, style: 3 });
      }
      const pipeY = sh * brng.range(0.55, 0.85);
      addPart({ shape: 'cyl', x: cx, y: pipeY, z: cz + d / 2 + 0.9, w: 1.1, h: w * 0.9, d: 1.1, rz: Math.PI / 2, buildingId: id, style: 3 });
      H = Math.max(sh + 2.6, chH);
      topY = sh + 2.6;
      topW = w; topD = d;
    } else {
      style = 2;
      windowWidth = brng.range(2.4, 3.0);
      floorHeight = 3.0;
      const arche = brng.pick(['block', 'block', 'tower', 'stepped'] as const);
      if (arche === 'tower' && ring <= 3) {
        const tw = Math.min(w, d) * 0.7;
        addPart({ shape: 'box', x: cx, y: 0, z: cz, w: tw, h: H * 1.4, d: tw * brng.range(0.8, 1.1), buildingId: id, style, crown: true });
        H *= 1.4;
        topW = tw; topD = tw;
      } else if (arche === 'stepped') {
        const h1 = H * 0.6;
        addPart({ shape: 'box', x: cx, y: 0, z: cz, w, h: h1, d, buildingId: id, style });
        addPart({ shape: 'box', x: cx - w * 0.15, y: h1, z: cz, w: w * 0.65, h: H - h1, d: d * 0.9, buildingId: id, style, crown: true });
        topX = cx - w * 0.15; topW = w * 0.65; topD = d * 0.9;
      } else {
        H = Math.min(H, 26);
        addPart({ shape: 'box', x: cx, y: 0, z: cz, w, h: H, d, buildingId: id, style, crown: true });
      }
      topY = H;
      if (brng.chance(0.18)) addBillboard(topX, topZ, topW, topD, H, brng);
    }

    if (topY === 0) topY = H;
    addRoof(topX, topY, topZ, topW, topD, H > 70, district, brng);

    const floors = Math.max(1, Math.round(H / floorHeight));
    const footprint = w * d;
    const building: CityBuilding = {
      id,
      name: nameFor(district),
      type: brng.pick(TYPES[district]),
      district,
      height: H,
      floors,
      x: cx,
      z: cz,
      w,
      d,
      seed: bseed,
      windowWidth,
      floorHeight,
      litRatio: brng.range(def.litRatio[0], def.litRatio[1]),
      hero: false,
      metrics: simulateBuildingMetrics(bseed, district, floors, footprint),
    };
    plan.buildings.push(building);
    // Guard against archetypes that produced no parts.
    if (plan.parts.length === startParts) plan.buildings.pop();
  };

  const districtAcc: Record<string, { x: number; z: number; n: number; maxH: number }> = {};

  for (let iz = 0; iz < CITY.gridSize; iz++) {
    for (let ix = 0; ix < CITY.gridSize; ix++) {
      const x = (ix - HALF_GRID) * PITCH;
      const z = (iz - HALF_GRID) * PITCH;
      const district = districtFor(ix, iz);
      const ring = Math.max(Math.abs(ix - HALF_GRID), Math.abs(iz - HALF_GRID));
      plan.blocks.push({ ix, iz, x, z, district });

      // Street lights: two per block edge, set back on the sidewalk.
      const e = CITY.blockSize / 2 - 1.2;
      for (const t of [-0.5, 0.5]) {
        const o = t * CITY.blockSize * 0.6;
        plan.streetLights.push({ x: x + o, z: z - e, rot: -Math.PI / 2 }, { x: x + o, z: z + e, rot: Math.PI / 2 }, { x: x - e, z: z + o, rot: Math.PI }, { x: x + e, z: z + o, rot: 0 });
      }

      if (district === 'plaza') continue;

      const nx = district === 'market' ? rng.int(2, 3) : district === 'residential' ? 2 : district === 'financial' ? rng.int(1, 2) : rng.int(1, 2);
      const nz = district === 'market' ? rng.int(2, 3) : district === 'residential' ? rng.int(1, 2) : 1;
      const gap = district === 'market' ? 1.5 : 4;
      const xs = splitSpan(inner, nx, gap, rng);
      const zs = splitSpan(inner, nz, gap, rng);
      for (const [lx, lw] of xs) {
        for (const [lz, ld] of zs) {
          // Leave the occasional pocket park in residential blocks.
          if (district === 'residential' && rng.chance(0.08)) continue;
          makeBuilding(district, x + lx, z + lz, lw, ld, ring);
        }
      }

      const acc = (districtAcc[district] ??= { x: 0, z: 0, n: 0, maxH: 0 });
      acc.x += x;
      acc.z += z;
      acc.n++;
    }
  }

  // Hero landmark: the Aurora Spire, at the exact centre of the plaza.
  {
    const id = plan.buildings.length;
    const H = 268;
    plan.parts.push({ shape: 'spire', x: 0, y: 0, z: 0, w: 24, h: H, d: 24, rx: 0, ry: 0, rz: 0, buildingId: id, style: 1, crown: true });
    plan.beacons.push({ x: 0, y: H + 34, z: 0 });
    plan.roofProps.push({ kind: 'antenna', x: 0, y: H, z: 0, s: 0.8, h: 34 });
    plan.buildings.push({
      id,
      name: 'Aurora Spire',
      type: TYPES.plaza[0],
      district: 'plaza',
      height: H + 34,
      floors: Math.round(H / 4.2),
      x: 0,
      z: 0,
      w: 24,
      d: 24,
      seed: 777,
      windowWidth: 2,
      floorHeight: 4.2,
      litRatio: 0.72,
      hero: true,
      metrics: simulateBuildingMetrics(777, 'plaza', Math.round(H / 4.2), 24 * 24 * 0.6),
    });
  }

  for (const b of plan.buildings) {
    const acc = districtAcc[b.district];
    if (acc) acc.maxH = Math.max(acc.maxH, b.height);
  }
  for (const id of Object.keys(DISTRICTS) as DistrictId[]) {
    const acc = districtAcc[id];
    plan.districtCenters[id] = acc ? { x: acc.x / acc.n, z: acc.z / acc.n, maxHeight: acc.maxH } : { x: 0, z: 0, maxHeight: 290 };
  }
  plan.districtCenters.plaza = { x: 0, z: 0, maxHeight: 300 };

  return plan;
}

let cached: CityPlan | null = null;
/** The plan is immutable, so it is generated once per session. */
export function getCityPlan(): CityPlan {
  if (!cached) cached = generateCity();
  return cached;
}
