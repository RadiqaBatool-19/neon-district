import { useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { QUALITY } from '../../data/cyberpunk/config';
import { DENSITY_FACTOR, useCyberStore } from '../../stores/cyberpunkStore';
import { frameStats } from '../../utils/frameStats';
import { DriftParticles, Rain, SkyDome } from './Atmosphere';
import { BuildingInstances } from './BuildingInstances';
import { CameraRig, DEFAULT_VIEW } from './CameraRig';
import { DistantSkyline } from './DistantSkyline';
import { Highways } from './Highways';
import { Lighting } from './Lighting';
import { NeonSigns } from './NeonSigns';
import { Plaza } from './Plaza';
import { PostFX } from './PostFX';
import { CyberResourcesProvider } from './resources';
import { RoofProps } from './RoofProps';
import { StreetLevel } from './StreetLevel';
import { FlyingVehicles, Traffic } from './Traffic';

/** 'normal' density (0.65 of the buffer) matches the preset's original vehicle counts. */
const HEAVY_HEADROOM = 1 / DENSITY_FACTOR.normal;

/** Compiles shaders up-front, then reports ready after a couple of rendered frames. */
function ReadySignal({ onReady }: { onReady: () => void }) {
  const { gl, scene, camera } = useThree();
  const state = useRef({ frames: 0, compiled: false, done: false });
  useFrame(() => {
    const s = state.current;
    if (s.done) return;
    if (!s.compiled) {
      gl.compile(scene, camera);
      s.compiled = true;
    }
    if (++s.frames >= 3) {
      s.done = true;
      onReady();
    }
  });
  return null;
}

/** Lightweight FPS sampling for the HUD (written to a mutable object, not React state). */
function FrameMeter() {
  useFrame((_, dt) => frameStats.push(dt));
  return null;
}

function SceneContent({ onReady }: { onReady: () => void }) {
  const quality = useCyberStore((s) => s.quality);
  const reduced = useCyberStore((s) => s.reducedEffects);
  const layers = useCyberStore((s) => s.layers);
  const particles = useCyberStore((s) => s.particles);
  const preset = QUALITY[quality];
  // Vehicle buffers are sized for heavy traffic; the density controls pick how many are drawn.
  const carCap = Math.round((reduced ? 0.5 : 1) * preset.cars * HEAVY_HEADROOM);
  const flyerCap = Math.round((reduced ? 0.5 : 1) * preset.flyers * HEAVY_HEADROOM);

  const stepDown = () => {
    const s = useCyberStore.getState();
    if (!s.autoQuality) return;
    if (s.quality === 'high') s.setQuality('medium', true);
    else if (s.quality === 'medium') s.setQuality('low', true);
  };

  return (
    <>
      <SkyDome />
      <Lighting shadows={preset.shadows && !reduced} />
      <StreetLevel visible={layers.roads} />
      <BuildingInstances visible={layers.buildings} />
      <RoofProps visible={layers.buildings} detail={reduced ? Math.min(0.5, preset.roofDetail) : preset.roofDetail} />
      <NeonSigns visible={layers.signage && layers.buildings} streetGlow={preset.streetGlowDecals && layers.roads} />
      <Plaza />
      <DistantSkyline count={quality === 'low' ? 320 : 520} />
      <Highways visible={layers.roads} />
      <Traffic cars={carCap} highwayCars={Math.round(preset.highwayCars * HEAVY_HEADROOM)} visible={layers.traffic && layers.roads} />
      <FlyingVehicles count={flyerCap} visible={layers.flying} />
      <Rain count={reduced ? Math.round(preset.rainDrops * 0.4) : preset.rainDrops} />
      <DriftParticles count={preset.particles} visible={particles && !reduced} />
      <CameraRig />
      <PostFX preset={preset} reduced={reduced} />
      <PerformanceMonitor flipflops={2} onDecline={stepDown} />
      <FrameMeter />
      <ReadySignal onReady={onReady} />
    </>
  );
}

export default function CityCanvas({ onReady }: { onReady: () => void }) {
  const quality = useCyberStore((s) => s.quality);
  const reduced = useCyberStore((s) => s.reducedEffects);
  const preset = QUALITY[quality];

  return (
    <Canvas
      className="cp-canvas"
      flat
      dpr={preset.dpr}
      shadows={preset.shadows && !reduced}
      gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
      camera={{ fov: 42, near: 1, far: 7000, position: DEFAULT_VIEW.pos.toArray() }}
      onCreated={({ gl, scene, camera }) => {
        // Dev-only handle for profiling from the browser console.
        if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__nd = { gl, scene, camera, store: useCyberStore };
      }}
      onPointerMissed={(e) => {
        if (e.type === 'click' && useCyberStore.getState().selectedId !== null) useCyberStore.getState().select(null);
      }}
    >
      <fogExp2 attach="fog" args={['#2c1b40', 0.00145]} />
      <CyberResourcesProvider>
        <SceneContent onReady={onReady} />
      </CyberResourcesProvider>
    </Canvas>
  );
}
