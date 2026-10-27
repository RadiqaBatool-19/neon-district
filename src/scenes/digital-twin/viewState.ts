/**
 * Camera-derived values shared with DOM widgets (compass, scale bar). Written from
 * the render loop, read via listeners that update the DOM directly — no React
 * re-render per frame.
 */
type Listener = (v: Readonly<TwinViewState>) => void;

export interface TwinViewState {
  /** Camera azimuth (radians, 0 = looking north). */
  azimuth: number;
  /** Metres per CSS pixel at the orbit target. */
  metersPerPixel: number;
}

const state: TwinViewState = { azimuth: 0, metersPerPixel: 1 };
const listeners = new Set<Listener>();

export const twinView = {
  update(azimuth: number, metersPerPixel: number) {
    if (Math.abs(azimuth - state.azimuth) < 0.004 && Math.abs(metersPerPixel - state.metersPerPixel) / state.metersPerPixel < 0.01) return;
    state.azimuth = azimuth;
    state.metersPerPixel = metersPerPixel;
    listeners.forEach((l) => l(state));
  },
  subscribe(l: Listener) {
    listeners.add(l);
    l(state);
    return () => {
      listeners.delete(l);
    };
  },
};
