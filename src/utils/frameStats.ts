/**
 * Rolling frame-time sampler shared between a scene (writer) and a HUD readout
 * (reader). Mutable on purpose: updating React state every frame would re-render.
 */
const SIZE = 60;
const samples = new Float32Array(SIZE);
let index = 0;
let filled = 0;

export const frameStats = {
  push(dt: number) {
    samples[index] = dt;
    index = (index + 1) % SIZE;
    filled = Math.min(SIZE, filled + 1);
  },
  fps(): number {
    if (!filled) return 0;
    let sum = 0;
    for (let i = 0; i < filled; i++) sum += samples[i];
    return sum > 0 ? filled / sum : 0;
  },
  reset() {
    index = 0;
    filled = 0;
  },
};
