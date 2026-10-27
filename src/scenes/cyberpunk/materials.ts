import * as THREE from 'three';
import { CITY, PITCH, CITY_HALF_EXTENT } from '../../data/cyberpunk/config';

/**
 * Shared shader uniforms for one mounted cyberpunk scene. A single object is
 * referenced by every material, so one write per frame animates the whole city.
 */
export function createCyberUniforms() {
  return {
    uTime: { value: 0 },
    /** Window emissive multiplier (lighting state). */
    uWindowLevel: { value: 1 },
    /** Crown / accent emissive multiplier. */
    uAccentLevel: { value: 1 },
    /** Sign emissive multiplier. */
    uSignLevel: { value: 1 },
    /** Rain wetness 0..1 — drives road roughness. */
    uWetness: { value: 0.7 },
    /** Fraction of rain streaks drawn (weather, smoothed). */
    uRain: { value: 0.3 },
    /** 0 = night, 1 = full daylight — lifts the albedo of the dark night materials. */
    uDaylight: { value: 0 },
    /** Scales how many windows are lit (fewer by day). */
    uLitScale: { value: 1 },
    /** Street-light level (0 by day). */
    uStreetLevel: { value: 1 },
    /** Glow-decal level under signs. */
    uSignGlow: { value: 1 },
    /**
     * Per-district live state, indexed by DISTRICT_INDEX (5 = outside the grid):
     * x activity 0..1, y power 0..1 (0 = blackout), z pollution 0..1, w unused.
     */
    uDistrict: { value: Array.from({ length: 6 }, () => new THREE.Vector4(0.5, 1, 0, 0)) },
    /** Per-district event zone highlight: rgb colour, a strength. */
    uZone: { value: Array.from({ length: 6 }, () => new THREE.Vector4(0, 0, 0, 0)) },
    // Sky. All colours are linear; the horizon colour doubles as the fog colour.
    uZenith: { value: new THREE.Color() },
    uSkyMid: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, -1, 0) },
    uSunColor: { value: new THREE.Color() },
    uMoonDir: { value: new THREE.Vector3(0, 1, 0) },
    uStars: { value: 1 },
    uCloud: { value: 0.5 },
    /** City light-pollution glow above the skyline (night only). */
    uCityGlow: { value: 1 },
    /** Lightning flash 0..1+. */
    uFlash: { value: 0 },
    /** Not a shader uniform: bloom luminance threshold, raised by day so the bright sky does not bloom. */
    uBloomThreshold: { value: 0.62 },
  };
}

export type CyberUniforms = ReturnType<typeof createCyberUniforms>;

/** Live district state lookup, shared by every material that reacts to simulated events. */
const DISTRICT_GLSL = /* glsl */ `
uniform vec4 uDistrict[6];
vec4 cyDistrict(float idx) { return uDistrict[int(clamp(idx + 0.5, 0.0, 5.0))]; }
// Power with a brief stutter while it changes, so outages flicker out instead of fading.
float cyPower(vec4 st, float seed, float time) {
  float p = st.y;
  float trans = 4.0 * p * (1.0 - p);
  float stutter = step(0.35, fract(sin(floor(time * 13.0) * 12.9898 + seed * 78.233) * 43758.5453));
  return mix(p, min(1.0, p * stutter * 1.4), trans);
}
`;

const HASH_GLSL = /* glsl */ `
float cyHash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float cyNoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(cyHash12(i), cyHash12(i + vec2(1.0, 0.0)), u.x), mix(cyHash12(i + vec2(0.0, 1.0)), cyHash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
`;

/**
 * Procedural facade: window grids, lit/unlit patterns, flicker, crown accents,
 * hover/selection highlight and data-lens overlays — all from per-instance
 * attributes, so every building shares this one material.
 *
 * Per-instance attributes:
 *   aTint    rgb lit-window colour, a = lit ratio
 *   aParams  x seed, y style (0 grid, 1 ribbon, 2 small, 3 metal), z window width (m), w floor height (m)
 *   aAccent  rgb crown colour, a = strength (0 for non-crown parts)
 *   aOverlay rgb data-lens colour, a = strength
 *   aState   x hover, y selected
 */
export function createFacadeMaterial(uniforms: CyberUniforms) {
  const mat = new THREE.MeshStandardMaterial({ color: '#0b0e18', roughness: 0.62, metalness: 0.55, envMapIntensity: 0.9 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uWindowLevel = uniforms.uWindowLevel;
    shader.uniforms.uAccentLevel = uniforms.uAccentLevel;
    shader.uniforms.uLitScale = uniforms.uLitScale;
    shader.uniforms.uDaylight = uniforms.uDaylight;
    shader.uniforms.uDistrict = uniforms.uDistrict;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        attribute vec4 aTint; attribute vec4 aParams; attribute vec4 aAccent; attribute vec4 aOverlay; attribute vec2 aState; attribute float aDistrict;
        varying vec3 vFWorld; varying vec3 vFNormal; varying vec4 vTint; varying vec4 vParams; varying vec4 vAccent; varying vec4 vOverlay; varying vec2 vState;
        varying float vLocalY; varying float vPartH; varying float vDistrict;`,
      )
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `#include <begin_vertex>
        #ifdef USE_INSTANCING
          mat4 fIm = instanceMatrix;
        #else
          mat4 fIm = mat4(1.0);
        #endif
        vFWorld = (modelMatrix * fIm * vec4(transformed, 1.0)).xyz;
        // Inverse-transpose for non-uniform instance scale (tall, thin towers would otherwise tilt normals toward Y).
        vec3 fScale = vec3(length(fIm[0].xyz), length(fIm[1].xyz), length(fIm[2].xyz));
        vFNormal = normalize(mat3(modelMatrix) * mat3(fIm) * (normal / (fScale * fScale)));
        vLocalY = position.y;
        vPartH = length(fIm[1].xyz);
        vTint = aTint; vParams = aParams; vAccent = aAccent; vOverlay = aOverlay; vState = aState; vDistrict = aDistrict;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        uniform float uTime; uniform float uWindowLevel; uniform float uAccentLevel; uniform float uLitScale; uniform float uDaylight;
        varying vec3 vFWorld; varying vec3 vFNormal; varying vec4 vTint; varying vec4 vParams; varying vec4 vAccent; varying vec4 vOverlay; varying vec2 vState;
        varying float vLocalY; varying float vPartH; varying float vDistrict;
        ${DISTRICT_GLSL}
        ${HASH_GLSL}`,
      )
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
        vec3 fN = normalize(vFNormal);
        float fRoof = step(0.75, abs(fN.y));
        vec2 fc = abs(fN.x) > abs(fN.z) ? vec2(vFWorld.z, vFWorld.y) : vec2(vFWorld.x, vFWorld.y);
        float fStyle = vParams.y;
        float isRibbon = step(0.5, fStyle) * step(fStyle, 1.5);
        float isMetal = step(2.5, fStyle);
        vec2 cell = fc / vec2(vParams.z, vParams.w);
        vec2 cid = floor(cell);
        vec2 cf = fract(cell);
        vec2 fw = fwidth(cell);
        vec2 margin = fStyle < 0.5 ? vec2(0.14, 0.24) : (fStyle < 1.5 ? vec2(0.0, 0.16) : vec2(0.27, 0.3));
        vec2 lo = smoothstep(margin - fw, margin + fw, cf);
        vec2 hi = 1.0 - smoothstep(1.0 - margin - fw, 1.0 - margin + fw, cf);
        float winMask = mix(lo.x * hi.x, 1.0, isRibbon) * lo.y * hi.y;
        winMask *= (1.0 - fRoof) * (1.0 - isMetal);
        float faceSeed = dot(floor(fN.xz * 1.5 + 0.5), vec2(3.1, 7.7));
        vec2 litCell = isRibbon > 0.5 ? vec2(floor(cell.x / 3.0), cid.y) : cid;
        float rnd = cyHash12(litCell + vec2(vParams.x * 0.0131, faceSeed));
        // About one window in eight re-rolls every 30-60 s, so the pattern slowly lives.
        float slowRnd = cyHash12(litCell + vec2(floor(uTime * 0.025 + rnd * 9.0) * 13.7, faceSeed));
        rnd = mix(rnd, slowRnd, step(0.875, cyHash12(litCell * 2.31 + 0.7)));
        float floorRnd = cyHash12(vec2(cid.y * 1.7, vParams.x * 0.0071 + faceSeed));
        vec4 fDist = cyDistrict(vDistrict);
        float fPower = cyPower(fDist, vParams.x * 0.001, uTime);
        float litRatio = clamp(vTint.a * uLitScale * mix(0.45, 1.4, fDist.x), 0.0, 0.95);
        float lit = step(rnd, litRatio) * step(0.12, floorRnd);
        float warm = step(0.74, cyHash12(litCell * 1.31 + 4.7));
        vec3 winCol = mix(vTint.rgb, vec3(1.0, 0.72, 0.46), warm * 0.85);
        float inten = mix(0.3, 1.0, cyHash12(litCell + 11.3));
        float flick = step(0.993, cyHash12(litCell * 0.71 + vParams.x * 0.001));
        inten *= 1.0 - flick * (0.5 + 0.5 * sin(uTime * (5.0 + rnd * 23.0)));
        float far = smoothstep(0.3, 0.85, max(fw.x, fw.y));
        float coverage = mix((1.0 - 2.0 * margin.x) * (1.0 - 2.0 * margin.y), 1.0 - 2.0 * margin.y, isRibbon);
        float glow = mix(winMask * lit * inten, coverage * litRatio * 0.55, far) * (1.0 - fRoof) * (1.0 - isMetal);
        vec3 fWindowEmissive = winCol * glow * uWindowLevel * fPower;
        // Daylight lifts the dark night albedo so towers read as concrete, metal and sky-tinted glass.
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 3.0 + vec3(0.05, 0.055, 0.065), uDaylight);
        vec3 glassCol = mix(vec3(0.015, 0.02, 0.032), vec3(0.03, 0.05, 0.08), uDaylight);
        diffuseColor.rgb = mix(diffuseColor.rgb, glassCol, winMask * (1.0 - far));
        float seam = isMetal * (1.0 - fRoof) * smoothstep(0.44, 0.5, abs(fract(fc.y / 1.4) - 0.5));
        diffuseColor.rgb += vec3(0.03) * seam + vec3(0.012, 0.012, 0.016) * fRoof * cyNoise(vFWorld.xz * 0.6);
        diffuseColor.rgb = mix(diffuseColor.rgb, vOverlay.rgb * 0.16, vOverlay.a);
        // Pollution spike: a sickly haze over the district.
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.07, 0.065, 0.02) * (1.0 + uDaylight * 3.0), fDist.z * 0.55);`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.14, winMask * (1.0 - far) * (0.4 + 0.6 * isRibbon));
        roughnessFactor = mix(roughnessFactor, 0.4, isMetal);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        /* glsl */ `#include <emissivemap_fragment>
        float topDist = (1.0 - vLocalY) * vPartH;
        float crown = smoothstep(1.3, 0.9, topDist) * smoothstep(0.0, 0.25, topDist);
        crown += 0.55 * (1.0 - smoothstep(0.0, 0.12, abs(topDist - 3.4) - 0.14));
        crown *= vAccent.a * (1.0 - fRoof);
        vec3 fView = normalize(vViewPosition);
        float fres = pow(1.0 - clamp(abs(dot(normal, fView)), 0.0, 1.0), 2.5);
        vec3 selCol = vec3(0.25, 0.95, 1.0);
        float hl = max(vState.x * 0.6, vState.y);
        totalEmissiveRadiance += fWindowEmissive * (1.0 - vOverlay.a * 0.8);
        totalEmissiveRadiance += vAccent.rgb * crown * 2.4 * uAccentLevel * fPower;
        float hazeBand = 0.5 + 0.5 * sin(vFWorld.y * 0.06 - uTime * 0.7 + vFWorld.x * 0.02);
        totalEmissiveRadiance += vec3(0.16, 0.15, 0.03) * fDist.z * (0.25 + 0.35 * hazeBand);
        totalEmissiveRadiance += vOverlay.rgb * vOverlay.a * (0.32 + 0.6 * fres + 0.35 * winMask);
        totalEmissiveRadiance += selCol * hl * (0.02 + fres * 1.0);
        // Thin scan line sweeping up the selected building.
        float scan = smoothstep(0.47, 0.5, abs(fract(vFWorld.y * 0.015 - uTime * 0.22) - 0.5));
        totalEmissiveRadiance += selCol * vState.y * scan * 1.6;`,
      );
  };
  return mat;
}

/**
 * Wet asphalt with procedural lane markings and crosswalks. Puddle-like patches
 * lower the roughness so the procedural environment map shows as a sheen.
 * This is an environment-reflection approximation, not a true scene reflection.
 */
export function createGroundMaterial(uniforms: CyberUniforms) {
  const mat = new THREE.MeshStandardMaterial({ color: '#07080d', roughness: 0.6, metalness: 0.3, envMapIntensity: 1.1 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWetness = uniforms.uWetness;
    shader.uniforms.uDaylight = uniforms.uDaylight;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGWorld;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        uniform float uWetness; uniform float uDaylight;
        varying vec3 vGWorld;
        ${HASH_GLSL}
        const float PITCH = ${PITCH.toFixed(1)};
        const float HB = ${(CITY.blockSize / 2).toFixed(1)};
        const float EXTENT = ${CITY_HALF_EXTENT.toFixed(1)};`,
      )
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
        vec2 gp = vGWorld.xz;
        vec2 loc = mod(gp + PITCH * 0.5, PITCH) - PITCH * 0.5;
        vec2 ga = abs(loc);
        float sX = step(HB, ga.x);
        float sZ = step(HB, ga.y);
        float inter = sX * sZ;
        float inCity = 1.0 - smoothstep(EXTENT - 8.0, EXTENT + 30.0, max(abs(gp.x), abs(gp.y)));
        vec2 dC = PITCH * 0.5 - ga;
        vec2 gfw = fwidth(gp) * 1.5;
        float cX = (1.0 - smoothstep(0.12, 0.12 + gfw.x, dC.x)) * sX * (1.0 - inter) * step(0.45, fract(gp.y / 7.0));
        float cZ = (1.0 - smoothstep(0.12, 0.12 + gfw.y, dC.y)) * sZ * (1.0 - inter) * step(0.45, fract(gp.x / 7.0));
        float eX = (1.0 - smoothstep(0.07, 0.07 + gfw.x, abs(dC.x - 6.4))) * sX * (1.0 - inter);
        float eZ = (1.0 - smoothstep(0.07, 0.07 + gfw.y, abs(dC.y - 6.4))) * sZ * (1.0 - inter);
        float zebraA = inter * step(ga.y, HB + 3.2) * step(0.5, fract(loc.x / 1.1)) * step(HB + 0.6, ga.x);
        float zebraB = inter * step(ga.x, HB + 3.2) * step(0.5, fract(loc.y / 1.1)) * step(HB + 0.6, ga.y);
        float marks = clamp(cX + cZ + (eX + eZ) * 0.6 + (zebraA + zebraB) * 0.7, 0.0, 1.0) * inCity;
        float wear = 0.55 + 0.45 * cyNoise(gp * 0.35);
        marks *= wear;
        float puddle = smoothstep(0.52, 0.72, cyNoise(gp * 0.045) * 0.65 + cyNoise(gp * 0.21) * 0.35);
        float gWet = clamp(uWetness * (0.35 + 0.65 * puddle), 0.0, 1.0);
        float grit = cyNoise(gp * 2.3) * 0.5 + cyNoise(gp * 9.0) * 0.5;
        diffuseColor.rgb *= mix(1.15, 0.55, gWet) * (0.8 + 0.4 * grit) * (1.0 + 6.0 * uDaylight);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.32, 0.34, 0.38), marks * 0.6);
        diffuseColor.rgb *= mix(0.35, 1.0, inCity);`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `#include <roughnessmap_fragment>
        roughnessFactor = mix(0.78, 0.05, gWet);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        /* glsl */ `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(0.5, 0.56, 0.65) * marks * 0.05;`,
      );
  };
  return mat;
}

/** Unlit neon sign material sampling the procedural text atlas. */
export function createSignMaterial(uniforms: CyberUniforms, atlas: THREE.Texture) {
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog]),
    vertexShader: /* glsl */ `
      #include <common>
      #include <fog_pars_vertex>
      attribute vec4 aUv; attribute vec3 aColor; attribute vec3 aAnim; attribute float aDistrict;
      varying vec2 vUv; varying vec4 vRect; varying vec3 vColor; varying vec3 vAnim; varying float vDistrict;
      void main() {
        vUv = uv; vDistrict = aDistrict;
        vRect = aUv;
        vColor = aColor; vAnim = aAnim;
        vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uAtlas; uniform float uTime; uniform float uSignLevel;
      #include <common>
      #include <fog_pars_fragment>
      ${DISTRICT_GLSL}
      varying vec2 vUv; varying vec4 vRect; varying vec3 vColor; varying vec3 vAnim; varying float vDistrict;
      float h11(float n) { return fract(sin(n) * 43758.5453); }
      void main() {
        // Un-mirror text on the back face of double-sided signs.
        vec2 suv = gl_FrontFacing ? vUv : vec2(1.0 - vUv.x, vUv.y);
        float text = texture2D(uAtlas, mix(vRect.xy, vRect.zw, suv)).r;
        vec2 e = min(vUv, 1.0 - vUv);
        float edge = min(e.x, e.y);
        float frame = 1.0 - smoothstep(0.018, 0.028, edge);
        float inner = (1.0 - smoothstep(0.05, 0.058, edge)) * (1.0 - frame) * 0.25;
        float on = 1.0;
        if (vAnim.x > 0.5 && vAnim.x < 1.5) {
          float t = floor(uTime * 9.0 + vAnim.y);
          on = 1.0 - step(0.86, h11(t)) * 0.85;
        }
        float chase = 0.0;
        if (vAnim.x > 1.5) {
          chase = step(0.82, fract(vUv.x * 5.0 - uTime * 0.6 + vAnim.y)) * 0.35;
          text *= 0.75 + 0.25 * sin(uTime * 2.4 + vAnim.y);
        }
        // Occasional brown-out flicker on any sign, more often in busy districts.
        vec4 st = cyDistrict(vDistrict);
        on *= 1.0 - step(0.993 - st.x * 0.012, h11(floor(uTime * 7.0) * 1.37 + vAnim.y * 17.0)) * 0.75;
        // Billboards and bands breathe slowly.
        on *= 1.0 - 0.12 * (0.5 + 0.5 * sin(uTime * 0.9 + vAnim.y * 3.0)) * vAnim.z;
        on *= cyPower(st, vAnim.y, uTime);
        vec3 col = vColor * (text * 2.6 + frame * 1.7 + inner + chase + 0.05) * on * uSignLevel;
        col += vec3(0.008, 0.008, 0.014);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
    side: THREE.DoubleSide,
    fog: true,
  });
  // Bind shared uniforms by reference so one per-frame write animates every sign.
  mat.uniforms.uAtlas = { value: atlas };
  mat.uniforms.uTime = uniforms.uTime;
  mat.uniforms.uSignLevel = uniforms.uSignLevel;
  mat.uniforms.uDistrict = uniforms.uDistrict;
  return mat;
}

/** Tiny emissive points (aviation beacons) that blink with per-instance phase. */
export function createBeaconMaterial(uniforms: CyberUniforms) {
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff2b3a').multiplyScalar(6), toneMapped: false });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime;
        varying float vBlink;`)
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float ph = fract(sin(dot(instanceMatrix[3].xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        #else
          float ph = 0.0;
        #endif
        float cyc = fract(uTime * 0.55 + ph);
        vBlink = smoothstep(0.0, 0.04, cyc) * (1.0 - smoothstep(0.12, 0.3, cyc));
        transformed *= 0.6 + 0.6 * vBlink;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying float vBlink;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb *= 0.08 + vBlink;`);
  };
  return mat;
}

/**
 * Soft additive radial glow used for light pools and fake wet-street sign
 * reflections. `level` is a shared uniform (street lights or sign glow) and the
 * per-instance district index lets outages switch the pools off.
 */
export function createGlowDecalMaterial(uniforms: CyberUniforms, level: { value: number }) {
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog]),
    vertexShader: /* glsl */ `
      #include <common>
      #include <fog_pars_vertex>
      attribute vec4 aColor; attribute float aDistrict;
      varying vec2 vUv; varying vec4 vColor; varying float vDistrict;
      void main() {
        vUv = uv; vColor = aColor; vDistrict = aDistrict;
        vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform float uLevel; uniform float uTime;
      #include <common>
      #include <fog_pars_fragment>
      ${DISTRICT_GLSL}
      varying vec2 vUv; varying vec4 vColor; varying float vDistrict;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        float g = pow(max(0.0, 1.0 - r), 2.2);
        float pw = cyPower(cyDistrict(vDistrict), vColor.r * 7.0, uTime);
        gl_FragColor = vec4(vColor.rgb * g * vColor.a * uLevel * pw, 1.0);
        // Additive glow: fade it out with fog instead of mixing toward the fog colour.
        #if defined(USE_FOG) && defined(FOG_EXP2)
          gl_FragColor.rgb *= exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
        #endif
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: true,
  });
  mat.uniforms.uLevel = level;
  mat.uniforms.uTime = uniforms.uTime;
  mat.uniforms.uDistrict = uniforms.uDistrict;
  return mat;
}

/** Street-lamp heads: unlit, switched by time of day and by district power. */
export function createLampMaterial(uniforms: CyberUniforms) {
  const mat = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      attribute float aDistrict;
      varying float vDistrict;
      void main() {
        vDistrict = aDistrict;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uLevel; uniform float uTime;
      ${DISTRICT_GLSL}
      varying float vDistrict;
      void main() {
        float pw = cyPower(cyDistrict(vDistrict), 0.3, uTime);
        vec3 off = vec3(0.05, 0.055, 0.065);
        vec3 on = vec3(0.81, 0.94, 1.0) * 3.2;
        gl_FragColor = vec4(mix(off, on, clamp(uLevel * pw, 0.0, 1.0)), 1.0);
      }`,
  });
  mat.uniforms.uLevel = uniforms.uStreetLevel;
  mat.uniforms.uTime = uniforms.uTime;
  mat.uniforms.uDistrict = uniforms.uDistrict;
  return mat;
}

/**
 * Event zones: a pulsing outline over every block of a district with an active
 * simulated event. Colour and strength come from `uZone[district]`.
 */
export function createZoneMaterial(uniforms: CyberUniforms) {
  const mat = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      attribute float aDistrict;
      varying vec2 vUv; varying float vDistrict;
      void main() {
        vUv = uv; vDistrict = aDistrict;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec4 uZone[6]; uniform float uTime;
      varying vec2 vUv; varying float vDistrict;
      void main() {
        vec4 z = uZone[int(clamp(vDistrict + 0.5, 0.0, 5.0))];
        if (z.a < 0.001) discard;
        vec2 e = min(vUv, 1.0 - vUv);
        float d = min(e.x, e.y);
        float edge = 1.0 - smoothstep(0.0, 0.03, d);
        float pulse = 0.6 + 0.4 * sin(uTime * 3.0);
        float dash = step(0.5, fract((vUv.x + vUv.y) * 5.0 - uTime * 0.4));
        float fill = 0.07 * (0.6 + 0.4 * sin(uTime * 2.0 - d * 24.0));
        gl_FragColor = vec4(z.rgb * (edge * (0.9 + 0.9 * dash) * pulse + fill) * z.a, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  mat.uniforms.uZone = uniforms.uZone;
  mat.uniforms.uTime = uniforms.uTime;
  return mat;
}
