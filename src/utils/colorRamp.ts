import { Color } from 'three';

const cache = new Map<string, Color[]>();

/** Sample a multi-stop colour ramp at t ∈ [0, 1] into `target` (no allocations after first use). */
export function sampleRamp(stops: string[], t: number, target: Color): Color {
  const key = stops.join('|');
  let colors = cache.get(key);
  if (!colors) {
    colors = stops.map((s) => new Color(s));
    cache.set(key, colors);
  }
  const x = Math.min(1, Math.max(0, t)) * (colors.length - 1);
  const i = Math.min(colors.length - 2, Math.floor(x));
  return target.copy(colors[i]).lerp(colors[i + 1], x - i);
}

export function cssGradient(stops: string[], direction = '90deg'): string {
  return `linear-gradient(${direction}, ${stops.join(', ')})`;
}
