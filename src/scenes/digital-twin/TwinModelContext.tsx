import { createContext, useContext } from 'react';
import type { TwinModel } from '../../data/digital-twin/buildTwinModel';

export const TwinModelContext = createContext<TwinModel | null>(null);

export function useTwinModel(): TwinModel {
  const m = useContext(TwinModelContext);
  if (!m) throw new Error('useTwinModel must be used inside TwinModelContext');
  return m;
}
