import * as THREE from 'three';
import { HORIZONTAL_WORDS, VERTICAL_WORDS, type SignDef } from './cityGenerator';

/**
 * Procedural text atlas for neon signage (no font or image downloads).
 * Left half: horizontal words in 128px rows. Right half: vertical words in 128px columns.
 */
const SIZE = 2048;
const ROW = 128;
const COL = 128;

export function createSignAtlas(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  HORIZONTAL_WORDS.forEach((word, i) => {
    // Words fit inside a 2.6:1 box so they read on billboards (aspect ≥ 2.4).
    let size = 92;
    ctx.font = `600 ${size}px "Space Grotesk", "Segoe UI", sans-serif`;
    const maxW = ROW * 2.6;
    const w = ctx.measureText(word).width;
    if (w > maxW) {
      size = Math.floor((size * maxW) / w);
      ctx.font = `600 ${size}px "Space Grotesk", "Segoe UI", sans-serif`;
    }
    ctx.fillText(word, SIZE / 4, i * ROW + ROW / 2 + 4);
  });

  VERTICAL_WORDS.forEach((word, i) => {
    ctx.font = `700 78px "Space Grotesk", "Segoe UI", sans-serif`;
    const cx = SIZE / 2 + i * COL + COL / 2;
    const letters = word.split('');
    const step = 84;
    const start = SIZE / 2 - ((letters.length - 1) * step) / 2;
    letters.forEach((ch, j) => ctx.fillText(ch, cx, start + j * step));
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = 4;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/** UV rect [u0, v0, u1, v1] for a sign, cropped to preserve its aspect ratio. */
export function signUvRect(sign: SignDef): [number, number, number, number] {
  if (sign.style === 'blade') {
    const u0 = (SIZE / 2 + sign.word * COL) / SIZE;
    const u1 = u0 + COL / SIZE;
    const vSpan = Math.min(1, ((sign.h / sign.w) * COL) / SIZE);
    return [u0, 0.5 - vSpan / 2, u1, 0.5 + vSpan / 2];
  }
  const rowTop = sign.word * ROW;
  const v1 = 1 - rowTop / SIZE;
  const v0 = 1 - (rowTop + ROW) / SIZE;
  const uSpan = Math.min(0.5, ((sign.w / sign.h) * ROW) / SIZE);
  return [0.25 - uSpan / 2, v0, 0.25 + uSpan / 2, v1];
}
