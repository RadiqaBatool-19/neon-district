import { Bloom, ChromaticAberration, EffectComposer, Noise, ToneMapping, Vignette } from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode } from 'postprocessing';
import { Vector2 } from 'three';
import type { QualityPreset } from '../../data/cyberpunk/config';

const CA_OFFSET = new Vector2(0.00045, 0.0006);

/**
 * Post-processing chain. Bloom uses a high luminance threshold so only emissive
 * HDR values (windows, neon, beacons) glow; the dark architecture stays crisp.
 */
export function PostFX({ preset, reduced }: { preset: QualityPreset; reduced: boolean }) {
  const cinematic = preset.chromatic && !reduced;
  return (
    <EffectComposer multisampling={reduced ? 0 : preset.multisampling} enableNormalPass={false}>
      <Bloom mipmapBlur intensity={reduced ? 0.7 : 0.95} luminanceThreshold={0.62} luminanceSmoothing={0.22} levels={reduced ? 5 : preset.bloomLevels} radius={0.78} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette offset={0.28} darkness={0.72} />
      {cinematic ? <ChromaticAberration offset={CA_OFFSET} radialModulation modulationOffset={0.4} /> : <></>}
      {!reduced ? <Noise premultiply blendFunction={BlendFunction.SCREEN} opacity={0.035} /> : <></>}
    </EffectComposer>
  );
}
