import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import { DISTRICT_INDEX, districtActivity, EVENT_INFO, OUTSIDE_INDEX } from '../../data/cyberpunk/citySimulation';
import { DISTRICT_ORDER } from '../../data/cyberpunk/districts';
import { WEATHER } from '../../data/cyberpunk/weather';
import { cityClock, TIME_SPEED_RATE, useCyberStore } from '../../stores/cyberpunkStore';
import { useCyberResources } from './resources';
import { celestialDirections, createEnvState, sampleTimeOfDay } from './timeOfDay';

const ZONE_COLORS = { blackout: new THREE.Color(EVENT_INFO.blackout.color), pollution: new THREE.Color(EVENT_INFO.pollution.color) };

/** Signed shortest difference b − a on a 24 h circle. */
function hourDelta(a: number, b: number) {
  return ((((b - a) % 24) + 36) % 24) - 12;
}

/** Desaturate and dim a sky colour in place for cloud cover. */
function overcast(c: THREE.Color, cloud: number, tmp: THREE.Color) {
  const lum = c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722;
  c.lerp(tmp.setRGB(lum, lum, lum * 1.05), cloud * 0.7).multiplyScalar(1 - cloud * cloud * 0.6);
}

/** Lightning strike envelope: a bright leader followed by two return strokes (t in seconds). */
function strike(t: number) {
  const p = (c: number, w: number) => Math.exp(-((t - c) * (t - c)) / (w * w));
  return p(0.03, 0.03) + 0.55 * p(0.16, 0.035) + 0.8 * p(0.34, 0.06);
}

/**
 * Scene lighting plus the environment driver: advances the clock, blends the
 * time-of-day keyframes, eases weather changes, fires lightning and pushes the
 * simulated district state into shared uniforms. All per-frame work mutates
 * preallocated objects; nothing here causes React renders.
 *
 * Real-time lights are few on purpose: most of the city's light is emissive
 * (windows, signs, streetlights) and bloom.
 */
export function Lighting({ shadows }: { shadows: boolean }) {
  const hemi = useRef<THREE.HemisphereLight>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const neon = useRef<THREE.Group>(null);
  const { uniforms } = useCyberResources();
  const scene = useThree((s) => s.scene);

  const live = useMemo(() => {
    const w = WEATHER[useCyberStore.getState().weather];
    return {
      env: createEnvState(),
      sunDir: new THREE.Vector3(),
      moonDir: new THREE.Vector3(),
      lightDir: new THREE.Vector3(),
      grey: new THREE.Color(),
      flashTint: new THREE.Color(0.25, 0.27, 0.36),
      // Smoothed weather.
      rain: w.rain,
      fog: w.fog,
      cloud: w.cloud,
      wet: w.wet,
      lightning: w.lightning ? 1 : 0,
      // Lightning timing (seconds of scene time).
      clock: 0,
      nextStrike: 3,
      strikeAt: -10,
      // Smoothed district state: activity, power, pollution, zone strength.
      district: DISTRICT_ORDER.map(() => ({ a: 0.5, p: 1, z: 0, zone: 0 })),
      zoneColor: DISTRICT_ORDER.map(() => new THREE.Color()),
      first: true,
    };
  }, []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const s = useCyberStore.getState();
    const L = live;
    uniforms.uTime.value += dt;
    L.clock += dt;

    // --- Clock: auto-advance the target, ease the displayed hour toward it.
    if (s.timeAuto) cityClock.target = (cityClock.target + TIME_SPEED_RATE[s.timeSpeed] * dt) % 24;
    const dh = hourDelta(cityClock.hour, cityClock.target);
    cityClock.hour = L.first || Math.abs(dh) < 0.002 ? cityClock.target : (cityClock.hour + dh * (1 - Math.exp(-dt * 1.6)) + 24) % 24;
    const env = sampleTimeOfDay(cityClock.hour, L.env);
    celestialDirections(cityClock.hour, L.sunDir, L.moonDir);

    // --- Weather: ease toward the preset (several seconds), scaled by the intensity slider.
    const w = WEATHER[s.weather];
    const scale = 0.4 + 1.2 * s.weatherIntensity;
    const kw = L.first ? 1 : 1 - Math.exp(-dt * 0.45);
    L.rain += (Math.min(1, w.rain * scale) - L.rain) * kw;
    L.fog += (w.fog * scale - L.fog) * kw;
    L.cloud += (w.cloud - L.cloud) * kw;
    L.wet += (w.wet - L.wet) * (L.first ? 1 : 1 - Math.exp(-dt * 0.25));
    L.lightning += ((w.lightning ? 1 : 0) - L.lightning) * kw;

    // --- Lightning.
    let flash = 0;
    if (L.lightning > 0.3 && s.lightningFlashes && !s.reducedEffects) {
      if (L.clock >= L.nextStrike) {
        L.strikeAt = L.clock;
        L.nextStrike = L.clock + 4 + Math.random() * 8;
      }
      const t = L.clock - L.strikeAt;
      if (t < 0.6) flash = strike(t) * L.lightning;
    }
    uniforms.uFlash.value = flash;

    // --- Sky and fog.
    const cloud = L.cloud;
    overcast(env.zenith, cloud, L.grey);
    overcast(env.mid, cloud, L.grey);
    overcast(env.horizon, cloud, L.grey);
    env.horizon.r += L.flashTint.r * flash * 0.5;
    env.horizon.g += L.flashTint.g * flash * 0.5;
    env.horizon.b += L.flashTint.b * flash * 0.5;
    uniforms.uZenith.value.copy(env.zenith);
    uniforms.uSkyMid.value.copy(env.mid);
    uniforms.uHorizon.value.copy(env.horizon);
    uniforms.uSunDir.value.copy(L.sunDir);
    uniforms.uSunColor.value.copy(env.sun);
    uniforms.uMoonDir.value.copy(L.moonDir);
    uniforms.uStars.value = env.stars;
    uniforms.uCloud.value = cloud;
    uniforms.uCityGlow.value = env.cityGlow;
    const fog = scene.fog as THREE.FogExp2 | null;
    if (fog) {
      fog.color.copy(env.horizon);
      fog.density = env.fog + L.fog;
    }

    // --- City light levels.
    const daylight = env.daylight * (1 - cloud * 0.35);
    uniforms.uDaylight.value = daylight;
    uniforms.uWindowLevel.value = env.window;
    uniforms.uLitScale.value = env.litScale;
    uniforms.uAccentLevel.value = env.accent;
    uniforms.uSignLevel.value = env.sign;
    // Overcast days switch the street lights on early.
    uniforms.uStreetLevel.value = Math.max(env.street, THREE.MathUtils.smoothstep(cloud, 0.6, 1) * 0.8 * env.daylight);
    uniforms.uSignGlow.value = env.sign * (1 - 0.85 * daylight);
    uniforms.uWetness.value = L.wet;
    uniforms.uRain.value = L.rain;
    uniforms.uBloomThreshold.value = env.bloomThreshold - cloud * 0.25 * env.daylight;

    // --- Lights: the directional light follows the sun by day and the moon by night.
    const sunUp = THREE.MathUtils.smoothstep(L.sunDir.y, -0.08, 0.12);
    L.lightDir.copy(L.moonDir).lerp(L.sunDir, sunUp).normalize();
    if (sun.current) {
      sun.current.position.copy(L.lightDir).multiplyScalar(600);
      sun.current.color.copy(env.sun);
      sun.current.intensity = env.sunIntensity * (1 - cloud * 0.7) + flash * 1.5;
    }
    if (hemi.current) {
      hemi.current.color.copy(env.hemiSky);
      hemi.current.groundColor.copy(env.hemiGround);
      hemi.current.intensity = env.hemiIntensity * (1 - cloud * 0.25) + flash * 2.5;
    }
    if (neon.current) neon.current.visible = daylight < 0.85;

    // --- Simulated district state → uniforms (events from the store, activity from the clock).
    const events = s.events;
    let avg = 0;
    const ka = 1 - Math.exp(-dt * 0.6);
    const kp = 1 - Math.exp(-dt * 1.1);
    for (let i = 0; i < DISTRICT_ORDER.length; i++) {
      const id = DISTRICT_ORDER[i];
      let blackout = false;
      let spike = false;
      let latest = -1;
      for (let e = 0; e < events.length; e++) {
        const ev = events[e];
        if (ev.district !== id) continue;
        if (ev.kind === 'blackout') blackout = true;
        else spike = true;
        if (ev.startedAt > latest) {
          latest = ev.startedAt;
          L.zoneColor[i].copy(ZONE_COLORS[ev.kind]);
        }
      }
      const d = L.district[i];
      const a = districtActivity(id, cityClock.hour, s.cityActivity);
      d.a = L.first ? a : d.a + (a - d.a) * ka;
      d.p += ((blackout ? 0 : 1) - d.p) * kp;
      d.z += ((spike ? 1 : 0) - d.z) * ka;
      d.zone += ((latest >= 0 ? 1 : 0) - d.zone) * kp;
      avg += d.a;
      const idx = DISTRICT_INDEX[id];
      uniforms.uDistrict.value[idx].set(d.a, d.p, d.z, 0);
      const zc = L.zoneColor[i];
      uniforms.uZone.value[idx].set(zc.r, zc.g, zc.b, d.zone);
    }
    uniforms.uDistrict.value[OUTSIDE_INDEX].set(avg / DISTRICT_ORDER.length, 1, 0, 0);
    L.first = false;
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={['#4b4f9a', '#0a0612', 0.8]} />
      <directionalLight
        ref={sun}
        position={[-260, 380, -420]}
        color="#9fb4ff"
        intensity={0.5}
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-320}
        shadow-camera-right={320}
        shadow-camera-top={320}
        shadow-camera-bottom={-320}
        shadow-camera-near={50}
        shadow-camera-far={1200}
        shadow-bias={-0.0004}
        shadow-normalBias={0.6}
      />
      <group ref={neon}>
        <pointLight position={[0, 14, 0]} color="#3ef0ff" intensity={9000} distance={160} decay={2} />
        <pointLight position={[-120, 30, 40]} color="#ff2bd6" intensity={7000} distance={170} decay={2} />
        <pointLight position={[110, 40, -90]} color="#2b7bff" intensity={6000} distance={160} decay={2} />
      </group>
      {/*
        Procedural environment for reflections on glass and the wet road. It is a
        static light rig rendered once, not a real-time reflection of the city.
      */}
      <Environment resolution={128} frames={1} background={false}>
        <color attach="background" args={['#05040b']} />
        <Lightformer form="rect" intensity={2.2} color="#ff2bd6" position={[-30, 4, -20]} scale={[40, 5, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={2.4} color="#3ef0ff" position={[30, 6, 10]} scale={[40, 6, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={1.4} color="#8b5cff" position={[0, 20, 30]} scale={[60, 8, 1]} target={[0, 0, 0]} />
        <Lightformer form="ring" intensity={1.2} color="#ffb347" position={[10, 3, -35]} scale={8} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={0.5} color="#2b3a8f" position={[0, 40, 0]} rotation-x={Math.PI / 2} scale={[80, 80, 1]} />
      </Environment>
    </>
  );
}
