import { useEffect, useRef } from 'react';
import { Map as MapIcon, RotateCcw } from 'lucide-react';
import { twinView } from '../../scenes/digital-twin/viewState';
import { useTwinStore } from '../../stores/twinStore';

const NICE = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000];

/** Compass, scale bar and view buttons. Compass and scale update via DOM writes from the render loop. */
export function MapWidgets() {
  const needle = useRef<SVGGElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  const requestCamera = useTwinStore((s) => s.requestCamera);

  useEffect(
    () =>
      twinView.subscribe(({ azimuth, metersPerPixel }) => {
        if (needle.current) needle.current.setAttribute('transform', `rotate(${(azimuth * 180) / Math.PI} 24 24)`);
        const target = metersPerPixel * 110;
        const nice = NICE.reduce((best, n) => (n <= target ? n : best), NICE[0]);
        if (bar.current) bar.current.style.width = `${Math.max(16, nice / metersPerPixel)}px`;
        if (label.current) label.current.textContent = nice >= 1000 ? `${nice / 1000} km` : `${nice} m`;
      }),
    [],
  );

  return (
    <div className="tw-widgets">
      <div className="tw-scale" aria-label="Scale (approximate at view centre)">
        <div ref={bar} className="tw-scale__bar" />
        <span ref={label}>–</span>
      </div>
      <button type="button" className="tw-compass" onClick={() => requestCamera('reset')} title="North-up oblique view" aria-label="Reset to north-up view">
        <svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true">
          <circle cx="24" cy="24" r="22" fill="#fff" stroke="#d5dbe3" />
          <g ref={needle}>
            <path d="M24 7 L29 24 L24 22 L19 24 Z" fill="#dc2626" />
            <path d="M24 41 L29 24 L24 26 L19 24 Z" fill="#94a3b8" />
            <text x="24" y="6.4" textAnchor="middle" fontSize="6" fontWeight="700" fill="#334155">
              N
            </text>
          </g>
        </svg>
      </button>
      <div className="tw-viewbtns">
        <button type="button" className="tw-icon-btn" onClick={() => requestCamera('reset')} title="Reset view" aria-label="Reset view">
          <RotateCcw size={15} />
        </button>
        <button type="button" className="tw-icon-btn" onClick={() => requestCamera('top')} title="Top-down view" aria-label="Top-down view">
          <MapIcon size={15} />
        </button>
      </div>
    </div>
  );
}
