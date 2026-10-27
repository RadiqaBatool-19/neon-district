import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import { useCyberStore } from '../../stores/cyberpunkStore';
import { useCyberResources } from './resources';

// Kept in sync with the sky dome's horizon colour (see SkyDome).
const FOG_NIGHT = new THREE.Color('#2c1b40');
const FOG_DUSK = new THREE.Color('#5a3560');

/**
 * Scene lighting. Real-time lights are few on purpose: most of the city's light
 * is emissive (windows, signs, streetlights) and bloom.
 */
export function Lighting({ shadows }: { shadows: boolean }) {
  const hemi = useRef<THREE.HemisphereLight>(null);
  const moon = useRef<THREE.DirectionalLight>(null);
  const { uniforms } = useCyberResources();
  const scene = useThree((s) => s.scene);
  const state = useRef({ night: useCyberStore.getState().nightLevel, wet: 0.7 });

  // Smoothly follow the lighting / weather controls (no React re-renders).
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const s = useCyberStore.getState();
    uniforms.uTime.value += dt;
    const k = 1 - Math.exp(-dt * 2.5);
    state.current.night += (s.nightLevel - state.current.night) * k;
    state.current.wet += ((s.rain ? 0.4 + 0.6 * Math.min(1, s.rainIntensity * 1.6) : 0.3) - state.current.wet) * (1 - Math.exp(-dt * 0.8));
    const n = state.current.night;
    uniforms.uWindowLevel.value = 0.5 + 0.7 * n;
    uniforms.uAccentLevel.value = 0.6 + 0.6 * n;
    uniforms.uSignLevel.value = 0.55 + 0.6 * n;
    uniforms.uDusk.value = 1 - n;
    uniforms.uWetness.value = state.current.wet;
    if (hemi.current) hemi.current.intensity = 0.55 + (1 - n) * 1.2;
    if (moon.current) moon.current.intensity = 0.35 + (1 - n) * 0.9;
    const fog = scene.fog as THREE.FogExp2 | null;
    if (fog) {
      fog.color.copy(FOG_NIGHT).lerp(FOG_DUSK, 1 - n);
      fog.density = 0.00145 + (s.rain ? s.rainIntensity * 0.0009 : 0);
    }
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={['#4b4f9a', '#0a0612', 0.8]} />
      <directionalLight
        ref={moon}
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
      <pointLight position={[0, 14, 0]} color="#3ef0ff" intensity={9000} distance={160} decay={2} />
      <pointLight position={[-120, 30, 40]} color="#ff2bd6" intensity={7000} distance={170} decay={2} />
      <pointLight position={[110, 40, -90]} color="#2b7bff" intensity={6000} distance={160} decay={2} />
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
