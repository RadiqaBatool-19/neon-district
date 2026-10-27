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
    /** 0 = deep night, 1 = dusk — drives the sky gradient. */
    uDusk: { value: 0.25 },
  };
}

export type CyberUniforms = ReturnType<typeof createCyberUniforms>;

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

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        attribute vec4 aTint; attribute vec4 aParams; attribute vec4 aAccent; attribute vec4 aOverlay; attribute vec2 aState;
        varying vec3 vFWorld; varying vec3 vFNormal; varying vec4 vTint; varying vec4 vParams; varying vec4 vAccent; varying vec4 vOverlay; varying vec2 vState;
        varying float vLocalY; varying float vPartH;`,
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
        vTint = aTint; vParams = aParams; vAccent = aAccent; vOverlay = aOverlay; vState = aState;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        uniform float uTime; uniform float uWindowLevel; uniform float uAccentLevel;
        varying vec3 vFWorld; varying vec3 vFNormal; varying vec4 vTint; varying vec4 vParams; varying vec4 vAccent; varying vec4 vOverlay; varying vec2 vState;
        varying float vLocalY; varying float vPartH;
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
        float floorRnd = cyHash12(vec2(cid.y * 1.7, vParams.x * 0.0071 + faceSeed));
        float lit = step(rnd, vTint.a) * step(0.12, floorRnd);
        float warm = step(0.74, cyHash12(litCell * 1.31 + 4.7));
        vec3 winCol = mix(vTint.rgb, vec3(1.0, 0.72, 0.46), warm * 0.85);
        float inten = mix(0.3, 1.0, cyHash12(litCell + 11.3));
        float flick = step(0.993, cyHash12(litCell * 0.71 + vParams.x * 0.001));
        inten *= 1.0 - flick * (0.5 + 0.5 * sin(uTime * (5.0 + rnd * 23.0)));
        float far = smoothstep(0.3, 0.85, max(fw.x, fw.y));
        float coverage = mix((1.0 - 2.0 * margin.x) * (1.0 - 2.0 * margin.y), 1.0 - 2.0 * margin.y, isRibbon);
        float glow = mix(winMask * lit * inten, coverage * vTint.a * 0.55, far) * (1.0 - fRoof) * (1.0 - isMetal);
        vec3 fWindowEmissive = winCol * glow * uWindowLevel;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.015, 0.02, 0.032), winMask * (1.0 - far));
        float seam = isMetal * (1.0 - fRoof) * smoothstep(0.44, 0.5, abs(fract(fc.y / 1.4) - 0.5));
        diffuseColor.rgb += vec3(0.03) * seam + vec3(0.012, 0.012, 0.016) * fRoof * cyNoise(vFWorld.xz * 0.6);
        diffuseColor.rgb = mix(diffuseColor.rgb, vOverlay.rgb * 0.16, vOverlay.a);`,
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
        totalEmissiveRadiance += vAccent.rgb * crown * 2.4 * uAccentLevel;
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
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGWorld;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        uniform float uWetness;
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
        diffuseColor.rgb *= mix(1.15, 0.55, gWet) * (0.8 + 0.4 * grit);
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
      attribute vec4 aUv; attribute vec3 aColor; attribute vec3 aAnim;
      varying vec2 vUv; varying vec4 vRect; varying vec3 vColor; varying vec3 vAnim;
      void main() {
        vUv = uv;
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
      varying vec2 vUv; varying vec4 vRect; varying vec3 vColor; varying vec3 vAnim;
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

/** Soft additive radial glow used for light pools and fake wet-street sign reflections. */
export function createGlowDecalMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog]),
    vertexShader: /* glsl */ `
      #include <common>
      #include <fog_pars_vertex>
      attribute vec4 aColor;
      varying vec2 vUv; varying vec4 vColor;
      void main() {
        vUv = uv; vColor = aColor;
        vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <fog_pars_fragment>
      varying vec2 vUv; varying vec4 vColor;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        float g = pow(max(0.0, 1.0 - r), 2.2);
        gl_FragColor = vec4(vColor.rgb * g * vColor.a, 1.0);
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
}
