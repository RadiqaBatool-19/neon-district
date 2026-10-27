import * as THREE from 'three';

/**
 * Time-of-day keyframes for the cyberpunk city. Each keyframe is a complete
 * lighting "look"; `sampleTimeOfDay` blends the two around a given hour into a
 * preallocated state object, so the per-frame update allocates nothing.
 *
 * The night keyframes reproduce the original (pre-time-of-day) night look.
 */

interface Keyframe {
  hour: number;
  zenith: THREE.Color;
  mid: THREE.Color;
  horizon: THREE.Color;
  sun: THREE.Color;
  sunIntensity: number;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiIntensity: number;
  window: number;
  litScale: number;
  accent: number;
  sign: number;
  street: number;
  daylight: number;
  fog: number;
  stars: number;
  cityGlow: number;
  bloomThreshold: number;
}

const lin = (r: number, g: number, b: number) => new THREE.Color().setRGB(r, g, b, THREE.LinearSRGBColorSpace);
const hex = (h: string) => new THREE.Color(h);

const NIGHT: Omit<Keyframe, 'hour'> = {
  zenith: lin(0.008, 0.01, 0.0295),
  mid: lin(0.0375, 0.0215, 0.0775),
  horizon: lin(0.0444, 0.0172, 0.0677),
  sun: hex('#9fb4ff'),
  sunIntensity: 0.575,
  hemiSky: hex('#4b4f9a'),
  hemiGround: hex('#0a0612'),
  hemiIntensity: 0.85,
  window: 1.025,
  litScale: 1,
  accent: 1.05,
  sign: 1,
  street: 1,
  daylight: 0,
  fog: 0.00145,
  stars: 1,
  cityGlow: 1,
  bloomThreshold: 0.62,
};

const KEYS: Keyframe[] = [
  { hour: 0, ...NIGHT },
  {
    hour: 4.6,
    ...NIGHT,
    zenith: lin(0.006, 0.009, 0.03),
    mid: lin(0.025, 0.022, 0.07),
    horizon: lin(0.04, 0.026, 0.075),
    litScale: 0.8,
    stars: 0.8,
  },
  {
    hour: 6.2,
    zenith: hex('#34508f'),
    mid: hex('#8a7aa8'),
    horizon: hex('#d9967a'),
    sun: hex('#ffb27a'),
    sunIntensity: 1.6,
    hemiSky: hex('#9db0d8'),
    hemiGround: hex('#2a2030'),
    hemiIntensity: 1.0,
    window: 0.65,
    litScale: 0.6,
    accent: 0.85,
    sign: 0.9,
    street: 0.35,
    daylight: 0.45,
    fog: 0.0015,
    stars: 0.05,
    cityGlow: 0.25,
    bloomThreshold: 0.85,
  },
  {
    hour: 8.5,
    zenith: hex('#4a7fc4'),
    mid: hex('#8fb2dc'),
    horizon: hex('#adc2d8'),
    sun: hex('#fff0d8'),
    sunIntensity: 2.6,
    hemiSky: hex('#b8d0f0'),
    hemiGround: hex('#3a3a44'),
    hemiIntensity: 1.4,
    window: 0.3,
    litScale: 0.35,
    accent: 0.85,
    sign: 1.15,
    street: 0,
    daylight: 1,
    fog: 0.0008,
    stars: 0,
    cityGlow: 0,
    bloomThreshold: 1.15,
  },
  {
    hour: 13,
    zenith: hex('#2c64b8'),
    mid: hex('#84aedc'),
    horizon: hex('#a4bcd4'),
    sun: hex('#fff8ec'),
    sunIntensity: 3.0,
    hemiSky: hex('#bcd4f2'),
    hemiGround: hex('#3c3c46'),
    hemiIntensity: 1.55,
    window: 0.28,
    litScale: 0.32,
    accent: 0.85,
    sign: 1.15,
    street: 0,
    daylight: 1,
    fog: 0.00065,
    stars: 0,
    cityGlow: 0,
    bloomThreshold: 1.2,
  },
  {
    hour: 16.6,
    zenith: hex('#4878c0'),
    mid: hex('#9ab4d6'),
    horizon: hex('#c4bdb6'),
    sun: hex('#ffe4bc'),
    sunIntensity: 2.4,
    hemiSky: hex('#c0cce6'),
    hemiGround: hex('#3e3a40'),
    hemiIntensity: 1.35,
    window: 0.35,
    litScale: 0.4,
    accent: 0.85,
    sign: 1.15,
    street: 0,
    daylight: 0.95,
    fog: 0.00075,
    stars: 0,
    cityGlow: 0,
    bloomThreshold: 1.1,
  },
  {
    hour: 18.3,
    zenith: hex('#2c3a7a'),
    mid: hex('#a0608a'),
    horizon: hex('#ff8a5a'),
    sun: hex('#ff8040'),
    sunIntensity: 1.6,
    hemiSky: hex('#b08ab8'),
    hemiGround: hex('#2a1a26'),
    hemiIntensity: 1.0,
    window: 0.8,
    litScale: 0.7,
    accent: 1.0,
    sign: 1.0,
    street: 0.7,
    daylight: 0.45,
    fog: 0.0013,
    stars: 0,
    cityGlow: 0.3,
    bloomThreshold: 0.85,
  },
  {
    hour: 19.4,
    zenith: hex('#102458'),
    mid: hex('#3a3a86'),
    horizon: hex('#6a4a8a'),
    sun: hex('#8aa0ff'),
    sunIntensity: 0.6,
    hemiSky: hex('#5a64b0'),
    hemiGround: hex('#120a1c'),
    hemiIntensity: 1.0,
    window: 1.05,
    litScale: 0.95,
    accent: 1.12,
    sign: 1.1,
    street: 1,
    daylight: 0.12,
    fog: 0.0015,
    stars: 0.3,
    cityGlow: 0.8,
    bloomThreshold: 0.66,
  },
  { hour: 21.5, ...NIGHT },
  { hour: 24, ...NIGHT },
];

export interface EnvState {
  zenith: THREE.Color;
  mid: THREE.Color;
  horizon: THREE.Color;
  sun: THREE.Color;
  sunIntensity: number;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiIntensity: number;
  window: number;
  litScale: number;
  accent: number;
  sign: number;
  street: number;
  daylight: number;
  fog: number;
  stars: number;
  cityGlow: number;
  bloomThreshold: number;
}

export function createEnvState(): EnvState {
  return {
    zenith: new THREE.Color(),
    mid: new THREE.Color(),
    horizon: new THREE.Color(),
    sun: new THREE.Color(),
    sunIntensity: 0,
    hemiSky: new THREE.Color(),
    hemiGround: new THREE.Color(),
    hemiIntensity: 0,
    window: 0,
    litScale: 0,
    accent: 0,
    sign: 0,
    street: 0,
    daylight: 0,
    fog: 0,
    stars: 0,
    cityGlow: 0,
    bloomThreshold: 0,
  };
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Blend the keyframes around `hour` (0..24) into `out`. */
export function sampleTimeOfDay(hour: number, out: EnvState): EnvState {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].hour <= h) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = smooth((h - a.hour) / (b.hour - a.hour));
  out.zenith.copy(a.zenith).lerp(b.zenith, t);
  out.mid.copy(a.mid).lerp(b.mid, t);
  out.horizon.copy(a.horizon).lerp(b.horizon, t);
  out.sun.copy(a.sun).lerp(b.sun, t);
  out.hemiSky.copy(a.hemiSky).lerp(b.hemiSky, t);
  out.hemiGround.copy(a.hemiGround).lerp(b.hemiGround, t);
  out.sunIntensity = a.sunIntensity + (b.sunIntensity - a.sunIntensity) * t;
  out.hemiIntensity = a.hemiIntensity + (b.hemiIntensity - a.hemiIntensity) * t;
  out.window = a.window + (b.window - a.window) * t;
  out.litScale = a.litScale + (b.litScale - a.litScale) * t;
  out.accent = a.accent + (b.accent - a.accent) * t;
  out.sign = a.sign + (b.sign - a.sign) * t;
  out.street = a.street + (b.street - a.street) * t;
  out.daylight = a.daylight + (b.daylight - a.daylight) * t;
  out.fog = a.fog + (b.fog - a.fog) * t;
  out.stars = a.stars + (b.stars - a.stars) * t;
  out.cityGlow = a.cityGlow + (b.cityGlow - a.cityGlow) * t;
  out.bloomThreshold = a.bloomThreshold + (b.bloomThreshold - a.bloomThreshold) * t;
  return out;
}

/**
 * Sun and moon directions for an hour. Sunrise at 06:00 in the east (+x),
 * sunset at 18:00 in the west, arcing through the southern sky (−z, behind the
 * default view). The moon runs opposite.
 */
export function celestialDirections(hour: number, sun: THREE.Vector3, moon: THREE.Vector3) {
  const a = ((hour - 6) / 12) * Math.PI;
  sun.set(Math.cos(a), Math.sin(a) * 0.9, -0.55).normalize();
  const m = a + Math.PI;
  moon.set(Math.cos(m) * 0.7, Math.max(0.12, Math.sin(m) * 0.8), -0.75).normalize();
}

export const TIME_PRESETS = [
  { id: 'dawn', label: 'Dawn', hour: 6.2 },
  { id: 'day', label: 'Day', hour: 13 },
  { id: 'sunset', label: 'Sunset', hour: 18.3 },
  { id: 'blue', label: 'Blue hour', hour: 19.4 },
  { id: 'night', label: 'Night', hour: 23 },
] as const;

export function formatHour(hour: number) {
  const h = ((hour % 24) + 24) % 24;
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
