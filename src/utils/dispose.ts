import type { BufferGeometry, Material, Texture } from 'three';

type Disposable = BufferGeometry | Material | Texture | null | undefined;

/** Dispose resources created imperatively (R3F only auto-disposes JSX-declared objects). */
export function disposeAll(...items: (Disposable | Disposable[])[]) {
  for (const item of items) {
    if (Array.isArray(item)) item.forEach((i) => i?.dispose());
    else item?.dispose();
  }
}
