import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Thermometer, Wind, Zap } from 'lucide-react';
import { getCityPlan } from '../../scenes/cyberpunk/cityGenerator';
import { frameStats } from '../../utils/frameStats';
import { SimTag } from './controls';

/** Compact city-wide readout. Aggregates SIMULATED building values with a slow synthetic drift. */
export function MetricsPanel() {
  const base = useMemo(() => {
    const b = getCityPlan().buildings;
    const energy = b.reduce((a, x) => a + x.metrics.energyMWhDay, 0);
    const temp = b.reduce((a, x) => a + x.metrics.temperatureC, 0) / b.length;
    const aqi = b.reduce((a, x) => a + x.metrics.airQualityIndex, 0) / b.length;
    return { energy, temp, aqi, count: b.length };
  }, []);
  const [t, setT] = useState(0);
  const fpsRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const id = window.setInterval(() => setT((v) => v + 1), 2500);
    const fpsId = window.setInterval(() => {
      if (fpsRef.current) fpsRef.current.textContent = `${Math.round(frameStats.fps())}`;
    }, 500);
    return () => {
      window.clearInterval(id);
      window.clearInterval(fpsId);
    };
  }, []);

  const drift = (amp: number, f: number) => 1 + amp * Math.sin(t * f) + amp * 0.4 * Math.sin(t * f * 2.7 + 1);
  const load = 62 + 9 * Math.sin(t * 0.21) + 3 * Math.sin(t * 0.9);

  return (
    <div className="cp-panel cp-metrics" aria-label="City metrics (simulated)">
      <div className="cp-metrics__head">
        <span>City pulse</span>
        <SimTag compact />
      </div>
      <div className="cp-metrics__grid">
        <div>
          <Zap size={13} />
          <strong>{((base.energy * drift(0.03, 0.4)) / 1000).toFixed(2)}</strong>
          <small>GWh/day</small>
        </div>
        <div>
          <Activity size={13} />
          <strong>{load.toFixed(0)}%</strong>
          <small>grid load</small>
        </div>
        <div>
          <Thermometer size={13} />
          <strong>{(base.temp * drift(0.01, 0.3)).toFixed(1)}°</strong>
          <small>avg °C</small>
        </div>
        <div>
          <Wind size={13} />
          <strong>{Math.round(base.aqi * drift(0.04, 0.35))}</strong>
          <small>avg AQI</small>
        </div>
      </div>
      <div className="cp-metrics__foot">
        <span>{base.count} structures</span>
        <span>
          <span ref={fpsRef}>–</span> fps
        </span>
      </div>
    </div>
  );
}
