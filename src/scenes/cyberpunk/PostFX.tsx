import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Bloom, ChromaticAberration, EffectComposer, Noise, ToneMapping, Vignette } from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode, type BloomEffect } from 'postprocessing';
import { Vector2 } from 'three';
import type { QualityPreset } from '../../data/cyberpunk/config';
import { useCyberResources } from './resources';

const CA_OFFSET = new Vector2(0.00045, 0.0006);

/**
 * Post-processing chain. Bloom uses a high luminance threshold so only emissive
 * HDR values (windows, neon, beacons) glow; the dark architecture stays crisp.
 * The threshold follows time of day so a bright daytime sky never blooms.
 */
export function PostFX({ preset, reduced }: { preset: QualityPreset; reduced: boolean }) {
  const cinematic = preset.chromatic && !reduced;
  const { uniforms } = useCyberResources();
  const bloom = useRef<BloomEffect>(null);

  useFrame(() => {
    if (bloom.current) bloom.current.luminanceMaterial.threshold = uniforms.uBloomThreshold.value;
  });

  return (
    <EffectComposer multisampling={reduced ? 0 : preset.multisampling} enableNormalPass={false}>
      {/* The wrapper's ref type is mistyped as the class constructor; at runtime it is the effect instance. */}
      <Bloom ref={bloom as never} mipmapBlur intensity={reduced ? 0.7 : 0.95} luminanceThreshold={0.62} luminanceSmoothing={0.22} levels={reduced ? 5 : preset.bloomLevels} radius={0.78} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette offset={0.28} darkness={0.72} />
      {cinematic ? <ChromaticAberration offset={CA_OFFSET} radialModulation modulationOffset={0.4} /> : <></>}
      {!reduced ? <Noise premultiply blendFunction={BlendFunction.SCREEN} opacity={0.035} /> : <></>}
    </EffectComposer>
  );
}
