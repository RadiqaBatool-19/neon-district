import { useEffect, useMemo, useState } from 'react';
import { CloudHail, RotateCcw, ZapOff } from 'lucide-react';
import { aggregateBases, demandCurve, EVENT_INFO, readCity, type CityEventKind, type DistrictReading } from '../../data/cyberpunk/citySimulation';
import { DISTRICTS, type DistrictId } from '../../data/cyberpunk/districts';
import { getCityPlan } from '../../scenes/cyberpunk/cityGenerator';
import { cityClock, useCyberStore } from '../../stores/cyberpunkStore';
import { Section, Segmented, SimTag } from './controls';

type Metric = 'activity' | 'demandMW' | 'occupancyPct' | 'aqi';

const METRICS: Record<Metric, { label: string; short: string; unit: string; format: (v: number) => string }> = {
  activity: { label: 'Activity', short: 'Activity', unit: '%', format: (v) => `${Math.round(v * 100)}` },
  demandMW: { label: 'Energy demand', short: 'Energy', unit: 'MW', format: (v) => (v >= 100 ? v.toFixed(0) : v.toFixed(1)) },
  occupancyPct: { label: 'Occupancy', short: 'Occup.', unit: '%', format: (v) => `${Math.round(v)}` },
  aqi: { label: 'Air quality index', short: 'AQI', unit: 'AQI', format: (v) => `${Math.round(v)}` },
};

export function useDistrictBases() {
  return useMemo(() => aggregateBases(getCityPlan().buildings), []);
}

/** Simulated district readings, refreshed once a second from the live clock. */
export function useCityReadings(intervalMs = 1000) {
  const bases = useDistrictBases();
  const activity = useCyberStore((s) => s.cityActivity);
  const events = useCyberStore((s) => s.events);
  const [hour, setHour] = useState(cityClock.hour);
  useEffect(() => {
    const id = window.setInterval(() => setHour(cityClock.hour), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  const readings = useMemo(() => readCity(bases, hour, activity, events), [bases, hour, activity, events]);
  return { readings, bases, hour, activity, events };
}

function Sparkline({ values, hour, color }: { values: number[]; hour: number; color: string }) {
  const w = 240;
  const h = 46;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => `${((i / 24) * w).toFixed(1)},${(h - 4 - (v / max) * (h - 10)).toFixed(1)}`).join(' ');
  const x = (hour / 24) * w;
  return (
    <svg className="cp-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label="Simulated energy demand over 24 hours">
      <polyline points={`0,${h} ${pts} ${w},${h}`} fill={color} fillOpacity={0.12} stroke="none" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      <line x1={x} x2={x} y1={0} y2={h} stroke="#e6edf9" strokeOpacity={0.6} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function CompareBars({ readings, metric, focus, onFocus }: { readings: DistrictReading[]; metric: Metric; focus: DistrictId; onFocus: (id: DistrictId) => void }) {
  const m = METRICS[metric];
  const max = Math.max(...readings.map((r) => r[metric]), metric === 'activity' ? 1 : 0.0001);
  return (
    <ul className="cp-bars" aria-label={`${m.label} by district (simulated)`}>
      {readings.map((r) => {
        const d = DISTRICTS[r.id];
        return (
          <li key={r.id}>
            <button type="button" className={focus === r.id ? 'is-active' : ''} onClick={() => onFocus(r.id)} style={{ ['--accent' as string]: d.accent }} aria-pressed={focus === r.id}>
              <span className="cp-bars__name">
                {d.name.replace(' District', '')}
                {r.events.includes('blackout') && <ZapOff size={11} aria-label="Blackout" />}
                {r.events.includes('pollution') && <CloudHail size={11} aria-label="Pollution spike" />}
              </span>
              <span className="cp-bars__track">
                <span style={{ width: `${Math.max(2, (r[metric] / max) * 100)}%` }} />
              </span>
              <strong>
                {m.format(r[metric])}
                <small>{m.unit}</small>
              </strong>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** District analytics, comparison and simulated events. Every figure here is synthetic. */
export function SimulationPanel() {
  const { readings, bases, hour, activity, events } = useCityReadings();
  const [metric, setMetric] = useState<Metric>('demandMW');
  const [focus, setFocus] = useState<DistrictId>(() => useCyberStore.getState().activeDistrict ?? 'market');
  const trigger = useCyberStore((s) => s.triggerEvent);
  const clearEvent = useCyberStore((s) => s.clearEvent);
  const clearEvents = useCyberStore((s) => s.clearEvents);
  const fly = useCyberStore((s) => s.flyToDistrict);

  const reading = readings.find((r) => r.id === focus)!;
  const curve = useMemo(() => demandCurve(focus, bases[focus], activity, events), [focus, bases, activity, events]);
  const d = DISTRICTS[focus];
  const has = (kind: CityEventKind) => events.some((e) => e.district === focus && e.kind === kind);

  return (
    <>
      <Section title="District comparison" aside={<SimTag compact />}>
        <Segmented<Metric>
          label="Compare metric"
          value={metric}
          options={(Object.keys(METRICS) as Metric[]).map((k) => ({ value: k, label: METRICS[k].short }))}
          onChange={setMetric}
        />
        <CompareBars readings={readings} metric={metric} focus={focus} onFocus={setFocus} />
      </Section>

      <Section title={d.name} aside={<button type="button" className="cp-link" onClick={() => fly(focus)}>Fly there</button>}>
        <dl className="cp-mini-stats">
          <div>
            <dt>Activity</dt>
            <dd>{Math.round(reading.activity * 100)}%</dd>
          </div>
          <div>
            <dt>Demand</dt>
            <dd>{METRICS.demandMW.format(reading.demandMW)} MW</dd>
          </div>
          <div>
            <dt>Occupancy</dt>
            <dd>{reading.occupancyPct}%</dd>
          </div>
          <div>
            <dt>AQI</dt>
            <dd>{reading.aqi}</dd>
          </div>
        </dl>
        <div className="cp-field-label">Energy demand · 24 h profile</div>
        <Sparkline values={curve} hour={hour} color={d.accent} />
        <div className="cp-spark__axis">
          <span>00</span>
          <span>06</span>
          <span>12</span>
          <span>18</span>
          <span>24</span>
        </div>

        <div className="cp-field-label">Simulate an event</div>
        <div className="cp-row cp-row--wrap">
          <button type="button" className={`cp-btn cp-btn--small cp-btn--warn${has('blackout') ? ' is-on' : ''}`} onClick={() => trigger('blackout', focus)}>
            <ZapOff size={13} /> {has('blackout') ? 'Restart blackout' : 'Blackout'}
          </button>
          <button type="button" className={`cp-btn cp-btn--small cp-btn--haze${has('pollution') ? ' is-on' : ''}`} onClick={() => trigger('pollution', focus)}>
            <CloudHail size={13} /> {has('pollution') ? 'Restart spike' : 'Pollution spike'}
          </button>
        </div>
      </Section>

      <Section title="Active events" aside={events.length > 1 ? <button type="button" className="cp-link" onClick={clearEvents}>Reset all</button> : undefined}>
        {events.length === 0 ? (
          <p className="cp-hint">No events. Pick a district above and trigger a simulated blackout or pollution spike.</p>
        ) : (
          <ul className="cp-events">
            {events.map((e) => (
              <li key={e.id} style={{ ['--accent' as string]: EVENT_INFO[e.kind].color }}>
                <i />
                <span>
                  <strong>{EVENT_INFO[e.kind].label}</strong>
                  <small>{DISTRICTS[e.district].name}</small>
                </span>
                <button type="button" className="cp-btn cp-btn--small cp-btn--ghost" onClick={() => clearEvent(e.id)}>
                  <RotateCcw size={12} /> Reset
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="cp-fineprint">Synthetic model of a fictional city: activity curves, demand and air quality are illustrative, not sensor data.</p>
      </Section>
    </>
  );
}
