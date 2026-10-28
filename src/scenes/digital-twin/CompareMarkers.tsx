import { Html } from '@react-three/drei';
import { useTwinStore } from '../../stores/twinStore';
import { useTwinModel } from './TwinModelContext';

// drei 9 ignores `pointerEvents` outside transform mode, so labels must opt out of hit-testing via style.
const NO_POINTER = { pointerEvents: 'none' } as const;

/** Numbered badges above compared buildings, matching the column numbers in the comparison table. */
export function CompareMarkers({ visibleSet }: { visibleSet: Set<number> }) {
  const model = useTwinModel();
  const ids = useTwinStore((s) => s.compareIds);
  const ex = useTwinStore((s) => (s.layers.terrain && model.terrain ? s.exaggeration : 0));

  return (
    <group>
      {ids.map((id, n) => {
        const index = model.buildingIndexById.get(id);
        if (index === undefined || !visibleSet.has(index)) return null;
        const b = model.buildings[index];
        return (
          <Html key={id} style={NO_POINTER} position={[b.centroid[0], b.baseY * ex + b.height + 14, b.centroid[1]]} center zIndexRange={[4, 0]} className="tw-compare-pin">
            {n + 1}
          </Html>
        );
      })}
    </group>
  );
}
