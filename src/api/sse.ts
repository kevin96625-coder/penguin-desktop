import type { OmniMessage, ServerEvent } from "./types";

/**
 * The app's only EventSource owner.
 *
 * Wire contract (verified against the submodule, not assumed):
 *  - OmniMessages are published with **no** `event:` line, so they land on the default
 *    `message` event. `ServerEvent`s are published as the named `server_event` event.
 *    (`runtime/channel.ts`: "SSE event name; omitted (OmniMessage) means no event line".)
 *  - Every event carries an opaque id `<epoch>-<seq>`. The epoch is regenerated whenever the
 *    channel is recreated or the process restarts, so a stale `Last-Event-ID` always misses
 *    and the server answers `resync_required` rather than silently skipping events.
 *  - The browser resends `Last-Event-ID` by itself on EventSource auto-reconnect; there is
 *    nothing for us to set (and native EventSource cannot set headers anyway). A *manual*
 *    reopen is a fresh subscription with no Last-Event-ID — which is what we want when
 *    switching sessions.
 *  - The first event of any new session subscription is a `task_state` snapshot
 *    (`routes/sessions.ts` FD-1), followed by a replay of still-pending approval requests.
 *
 * Connection budget: HTTP/1.1 caps a host at 6 sockets, and every open SSE stream holds one
 * for its whole life. The budget of <= 2 is therefore enforced *structurally* rather than by
 * a counter: this manager can only ever hold one global handle and one session handle, and
 * `openSession` closes the previous session stream before opening the next.
 */

export interface SseHandlers {
  /** OmniMessage on the default event. */
  onMessage?: (msg: OmniMessage, eventId: string) => void;
  /** ServerEvent on the named `server_event` event. */
  onServerEvent?: (evt: ServerEvent, eventId: string) => void;
  onOpen?: () => void;
  /** Transport-level error. EventSource reconnects on its own; this is for UI state only. */
  onError?: () => void;
}

/** Parse the seq half of an `<epoch>-<seq>` event id; -1 when unparseable. */
export function eventSeq(eventId: string): number {
  const sep = eventId.lastIndexOf("-");
  if (sep <= 0) return -1;
  const seq = Number.parseInt(eventId.slice(sep + 1), 10);
  return Number.isInteger(seq) ? seq : -1;
}

/** Epoch half of an `<epoch>-<seq>` event id; "" when unparseable. */
export function eventEpoch(eventId: string): string {
  const sep = eventId.lastIndexOf("-");
  return sep <= 0 ? "" : eventId.slice(0, sep);
}

interface Handle {
  es: EventSource;
  detach: () => void;
}

function attach(url: string, handlers: SseHandlers): Handle {
  const es = new EventSource(url, { withCredentials: true });

  const onMessage = (ev: MessageEvent<string>) => {
    if (!handlers.onMessage) return;
    try {
      handlers.onMessage(JSON.parse(ev.data) as OmniMessage, ev.lastEventId);
    } catch {
      // A frame we cannot parse is not worth tearing the stream down for.
    }
  };
  const onServerEvent = (ev: MessageEvent<string>) => {
    if (!handlers.onServerEvent) return;
    try {
      handlers.onServerEvent(JSON.parse(ev.data) as ServerEvent, ev.lastEventId);
    } catch {
      // ditto
    }
  };
  const onOpen = () => handlers.onOpen?.();
  const onError = () => handlers.onError?.();

  es.addEventListener("message", onMessage);
  es.addEventListener("server_event", onServerEvent);
  es.addEventListener("open", onOpen);
  es.addEventListener("error", onError);

  return {
    es,
    detach: () => {
      es.removeEventListener("message", onMessage);
      es.removeEventListener("server_event", onServerEvent);
      es.removeEventListener("open", onOpen);
      es.removeEventListener("error", onError);
      es.close();
    },
  };
}

class SseManager {
  private global: Handle | null = null;
  private session: { sessionId: string; handle: Handle } | null = null;

  /** The user-level channel (`GET /api/events`). Idempotent: a second call is a no-op. */
  connectGlobal(handlers: SseHandlers): void {
    if (this.global) return;
    this.global = attach("/api/events", handlers);
  }

  disconnectGlobal(): void {
    this.global?.detach();
    this.global = null;
  }

  /**
   * Subscribe to one session stream. Closing the previous handle happens *before* the new
   * one is created, so the budget never transiently exceeds 2 — the reason session switching
   * cannot leak sockets.
   */
  openSession(sessionId: string, handlers: SseHandlers): void {
    if (this.session?.sessionId === sessionId) return;
    this.closeSession();
    this.session = {
      sessionId,
      handle: attach(`/api/sessions/${encodeURIComponent(sessionId)}/stream`, handlers),
    };
  }

  closeSession(): void {
    this.session?.handle.detach();
    this.session = null;
  }

  /** Currently open EventSource count — the number asserted by the SSE-budget acceptance. */
  activeCount(): number {
    return (this.global ? 1 : 0) + (this.session ? 1 : 0);
  }

  currentSessionId(): string | null {
    return this.session?.sessionId ?? null;
  }
}

/** App-wide singleton. Nothing else may construct an EventSource. */
export const sse = new SseManager();

/** Test/diagnostic hook: `window.__penguinSse.activeCount()` in DevTools. */
declare global {
  interface Window {
    __penguinSse?: SseManager;
  }
}
if (typeof window !== "undefined") window.__penguinSse = sse;
