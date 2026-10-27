import { useEffect, useRef } from 'react';
import { Activity, Clock, Users, Wind, Zap } from 'lucide-react';
import { WEATHER } from '../../data/cyberpunk/weather';
import { formatHour } from '../../scenes/cyberpunk/timeOfDay';
import { useCyberStore } from '../../stores/cyberpunkStore';
import { frameStats } from '../../utils/frameStats';
import { SimTag } from './controls';
import { useCityReadings } from './SimulationPanel';

/** Compact city-wide readout, aggregated from the SIMULATED district model. */
export function MetricsPanel() {
  const { readings, hour, events } = useCityReadings(1000);
  const weather = useCyberStore((s) => s.weather);
  const fpsRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const fpsId = window.setInterval(() => {
      if (fpsRef.current) fpsRef.current.textContent = `${Math.round(frameStats.fps())}`;
    }, 500);
    return () => window.clearInterval(fpsId);
  }, []);

  const demand = readings.reduce((a, r) => a + r.demandMW, 0);
  const activity = readings.reduce((a, r) => a + r.activity, 0) / readings.length;
  const occupancy = readings.reduce((a, r) => a + r.occupancyPct, 0) / readings.length;
  const aqi = readings.reduce((a, r) => a + r.aqi, 0) / readings.length;

  return (
    <div className="cp-panel cp-metrics" aria-label="City metrics (simulated)">
      <div className="cp-metrics__head">
        <span>City pulse</span>
        <SimTag compact />
      </div>
      <div className="cp-metrics__grid">
        <div>
          <Zap size={13} />
          <strong>{demand.toFixed(0)}</strong>
          <small>MW demand</small>
        </div>
        <div>
          <Activity size={13} />
          <strong>{Math.round(activity * 100)}%</strong>
          <small>activity</small>
        </div>
        <div>
          <Users size={13} />
          <strong>{Math.round(occupancy)}%</strong>
          <small>occupancy</small>
        </div>
        <div>
          <Wind size={13} />
          <strong>{Math.round(aqi)}</strong>
          <small>avg AQI</small>
        </div>
      </div>
      <div className="cp-metrics__foot">
        <span>
          <Clock size={10} /> {formatHour(hour)} · {WEATHER[weather].label}
          {events.length > 0 && <b className="cp-metrics__alert"> · {events.length} event{events.length > 1 ? 's' : ''}</b>}
        </span>
        <span className="cp-metrics__fps">
          <span ref={fpsRef}>–</span> fps
        </span>
      </div>
    </div>
  );
}
