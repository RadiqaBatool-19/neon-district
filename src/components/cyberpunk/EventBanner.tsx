import { RotateCcw, TriangleAlert } from 'lucide-react';
import { EVENT_INFO } from '../../data/cyberpunk/citySimulation';
import { DISTRICTS } from '../../data/cyberpunk/districts';
import { useCyberStore } from '../../stores/cyberpunkStore';

/**
 * Persistent notice of active simulated events, top centre. The affected
 * district is also outlined in the scene. Each event can be reset here.
 */
export function EventBanner() {
  const events = useCyberStore((s) => s.events);
  const clearEvent = useCyberStore((s) => s.clearEvent);
  const fly = useCyberStore((s) => s.flyToDistrict);
  if (!events.length) return null;
  const shown = events.slice(-3);

  return (
    <div className="cp-events-banner" role="status" aria-live="polite">
      {shown.map((e) => {
        const info = EVENT_INFO[e.kind];
        return (
          <div key={e.id} className="cp-panel cp-event-toast" style={{ ['--accent' as string]: info.color }}>
            <TriangleAlert size={14} />
            <button type="button" className="cp-event-toast__body" onClick={() => fly(e.district)} title="Fly to the affected district">
              <strong>{info.verb}</strong>
              <span>{DISTRICTS[e.district].name}</span>
              <em>Simulated</em>
            </button>
            <button type="button" className="cp-btn cp-btn--small cp-btn--ghost" onClick={() => clearEvent(e.id)} aria-label={`Reset ${info.label.toLowerCase()} in ${DISTRICTS[e.district].name}`}>
              <RotateCcw size={12} /> Reset
            </button>
          </div>
        );
      })}
      {events.length > 3 && <div className="cp-event-more">+{events.length - 3} more in Simulate</div>}
    </div>
  );
}
