import { CloudFog, CloudLightning, CloudRain, CloudSun, Moon, Pause, Play, Sparkles, Sun, Sunrise, Sunset, Zap } from 'lucide-react';
import type { ReactNode } from 'react';
import { WEATHER, WEATHER_ORDER, type WeatherPreset } from '../../data/cyberpunk/weather';
import { formatHour, TIME_PRESETS } from '../../scenes/cyberpunk/timeOfDay';
import { useCyberStore, type TimeSpeed } from '../../stores/cyberpunkStore';
import { Section, Segmented, Slider, Toggle } from './controls';
import { useCityClock } from './useCityClock';

const PRESET_ICONS: Record<(typeof TIME_PRESETS)[number]['id'], ReactNode> = {
  dawn: <Sunrise size={14} />,
  day: <Sun size={14} />,
  sunset: <Sunset size={14} />,
  blue: <Sparkles size={14} />,
  night: <Moon size={14} />,
};

const WEATHER_ICONS: Record<WeatherPreset, ReactNode> = {
  clear: <CloudSun size={15} />,
  lightRain: <CloudRain size={15} />,
  heavyRain: <CloudRain size={15} strokeWidth={2.6} />,
  fog: <CloudFog size={15} />,
  thunderstorm: <CloudLightning size={15} />,
};

/** Which preset the current hour is closest to, for highlighting. */
function nearestPreset(hour: number) {
  let best: string | null = null;
  let bestD = 0.75;
  for (const p of TIME_PRESETS) {
    let d = Math.abs(hour - p.hour) % 24;
    d = Math.min(d, 24 - d);
    if (d < bestD) {
      bestD = d;
      best = p.id;
    }
  }
  return best;
}

export function TimeSection() {
  const target = useCityClock(200, 'target');
  const hour = useCityClock(200, 'hour');
  const auto = useCyberStore((s) => s.timeAuto);
  const setAuto = useCyberStore((s) => s.setTimeAuto);
  const speed = useCyberStore((s) => s.timeSpeed);
  const setSpeed = useCyberStore((s) => s.setTimeSpeed);
  const setTime = useCyberStore((s) => s.setTime);
  const active = nearestPreset(target);

  return (
    <Section title="Time of day" aside={<span className="cp-clock">{formatHour(hour)}</span>}>
      <div className="cp-presets" role="group" aria-label="Time presets">
        {TIME_PRESETS.map((p) => (
          <button key={p.id} type="button" className={active === p.id ? 'is-active' : ''} aria-pressed={active === p.id} onClick={() => setTime(p.hour)} title={`${p.label} · ${formatHour(p.hour)}`}>
            {PRESET_ICONS[p.id]}
            <span>{p.label}</span>
          </button>
        ))}
      </div>
      <Slider label="Time of day" value={target} min={0} max={23.99} step={0.05} onChange={setTime} left="00:00" right="24:00" />
      <div className="cp-row">
        <button type="button" className={`cp-btn cp-btn--small${auto ? ' is-on' : ''}`} onClick={() => setAuto(!auto)} aria-pressed={auto}>
          {auto ? <Pause size={13} /> : <Play size={13} />} {auto ? 'Pause cycle' : 'Auto cycle'}
        </button>
        <Segmented<TimeSpeed>
          label="Cycle speed"
          value={speed}
          options={[
            { value: 'slow', label: '24m' },
            { value: 'normal', label: '6m' },
            { value: 'fast', label: '90s' },
          ]}
          onChange={setSpeed}
        />
      </div>
      <p className="cp-hint">Cycle speed is the real time for one full simulated day.</p>
    </Section>
  );
}

export function WeatherSection() {
  const weather = useCyberStore((s) => s.weather);
  const setWeather = useCyberStore((s) => s.setWeather);
  const intensity = useCyberStore((s) => s.weatherIntensity);
  const setIntensity = useCyberStore((s) => s.setWeatherIntensity);
  const flashes = useCyberStore((s) => s.lightningFlashes);
  const setFlashes = useCyberStore((s) => s.setLightningFlashes);
  const particles = useCyberStore((s) => s.particles);
  const setParticles = useCyberStore((s) => s.setParticles);

  return (
    <Section title="Weather">
      <div className="cp-weather" role="radiogroup" aria-label="Weather preset">
        {WEATHER_ORDER.map((w) => (
          <button key={w} type="button" role="radio" aria-checked={weather === w} className={weather === w ? 'is-active' : ''} onClick={() => setWeather(w)}>
            {WEATHER_ICONS[w]}
            <span>{WEATHER[w].label}</span>
          </button>
        ))}
      </div>
      <div className="cp-field-label">Intensity</div>
      <Slider label="Weather intensity" value={intensity} onChange={setIntensity} left="Gentle" right="Severe" disabled={weather === 'clear'} />
      {weather === 'thunderstorm' && (
        <Toggle label="Lightning flashes" icon={<Zap size={14} />} checked={flashes} onChange={setFlashes} hint="Brief bright flashes. Off by default when your system asks for reduced motion." />
      )}
      <Toggle label="Drifting particles" icon={<Sparkles size={14} />} checked={particles} onChange={setParticles} />
    </Section>
  );
}

export function EnvironmentPanel() {
  return (
    <>
      <TimeSection />
      <WeatherSection />
    </>
  );
}
