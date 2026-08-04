import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ApiError } from "../../api/client";
import { eventEpoch, eventSeq, sse } from "../../api/sse";
import {
  abortSession,
  createSession,
  getMessages,
  listAgents,
  listProjects,
  listSessions,
  patchSession,
  postApproval,
  postTask,
} from "../../api/endpoints/sessions";
import type {
  OmniMessage,
  ServerEvent,
  SessionInfo,
  SessionStatus,
} from "../../api/types";
import { applyOmni, buildModel, emptyModel, type ChatModel } from "./stream-model";

export interface PendingApproval {
  toolCallId: string;
  name: string;
  args: string;
}

interface ChatContextValue {
  ready: boolean;
  error: string | null;
  projectId: string | null;
  agentId: string | null;
  sessions: SessionInfo[];
  activeSessionId: string | null;
  activeSession: SessionInfo | null;
  model: ChatModel;
  taskState: SessionStatus;
  queued: number;
  approvals: PendingApproval[];
  busy: boolean;
  selectSession: (sessionId: string) => void;
  newSession: () => Promise<void>;
  send: (text: string) => Promise<void>;
  decide: (toolCallId: string, decision: "allow" | "deny") => Promise<void>;
  allowRestOfSession: (toolCallId: string) => Promise<void>;
  abort: () => Promise<void>;
}

const ChatContext = createContext<ChatContextValue | null>(null);

/** Complete-message identity for overlap dedup after a resync rebuild. */
function signature(msg: OmniMessage): string {
  const p = msg.payload as unknown as Record<string, unknown>;
  const id = typeof p.tool_call_id === "string" ? p.tool_call_id : "";
  return `${msg.timestamp}|${String(p.type)}|${id}`;
}

const PARTIALS = new Set([
  "partial_text",
  "partial_thinking",
  "partial_tool_call",
  "partial_tool_call_output",
]);

function isPartialMsg(msg: OmniMessage): boolean {
  return (
    msg.type === "model_msg" &&
    PARTIALS.has(String((msg.payload as unknown as { type?: string }).type ?? ""))
  );
}

function errText(err: unknown): string {
  return err instanceof ApiError ? err.message : String(err);
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [model, setModel] = useState<ChatModel>(emptyModel);
  const [taskState, setTaskState] = useState<SessionStatus>("idle");
  const [queued, setQueued] = useState(0);
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [busy, setBusy] = useState(false);

  /* Rebuild coordination: while history is in flight, live frames are parked here rather
   * than folded into a model that is about to be replaced. */
  const rebuildingRef = useRef(false);
  const parkedRef = useRef<{ msg: OmniMessage; eventId: string }[]>([]);
  const seenRef = useRef<Set<string>>(new Set());
  const activeRef = useRef<string | null>(null);

  const refreshSessions = useCallback(async (p: string, a: string) => {
    const res = await listSessions(p, a);
    setSessions(res.sessions.filter((s) => !s.archived));
  }, []);

  /**
   * (Re)build the transcript from `GET /messages`, honouring the live-tail contract:
   * `live.fragments` already contains everything published up to `live.cursor`, so parked
   * partials at or before the cursor are dropped instead of double-counted. Parked complete
   * messages are kept — a complete whose trace append was still in flight is not in
   * `messages` — and de-duplicated by signature.
   */
  const rebuild = useCallback(async (sessionId: string) => {
    rebuildingRef.current = true;
    parkedRef.current = [];
    try {
      const res = await getMessages(sessionId);
      if (activeRef.current !== sessionId) return;

      let next = buildModel(res.messages);
      const seen = new Set(res.messages.filter((m) => !isPartialMsg(m)).map(signature));

      const cursor = res.live?.cursor;
      if (res.live) {
        for (const frag of res.live.fragments) next = applyOmni(next, frag);
      }
      const cursorEpoch = cursor ? eventEpoch(cursor) : "";
      const cursorSeq = cursor ? eventSeq(cursor) : -1;

      for (const parked of parkedRef.current) {
        const sameEpoch = eventEpoch(parked.eventId) === cursorEpoch;
        const covered = sameEpoch && eventSeq(parked.eventId) <= cursorSeq;
        if (isPartialMsg(parked.msg)) {
          if (covered) continue; // already inside live.fragments
        } else {
          const sig = signature(parked.msg);
          if (seen.has(sig)) continue;
          seen.add(sig);
        }
        next = applyOmni(next, parked.msg);
      }

      seenRef.current = seen;
      parkedRef.current = [];
      setModel(next);
    } catch (err) {
      setError(errText(err));
    } finally {
      rebuildingRef.current = false;
    }
  }, []);

  const onMessage = useCallback((msg: OmniMessage, eventId: string) => {
    if (rebuildingRef.current) {
      parkedRef.current.push({ msg, eventId });
      return;
    }
    if (!isPartialMsg(msg)) {
      const sig = signature(msg);
      if (seenRef.current.has(sig)) return;
      seenRef.current.add(sig);
    }
    setModel((m) => applyOmni(m, msg));
  }, []);

  const onServerEvent = useCallback(
    (evt: ServerEvent) => {
      switch (evt.type) {
        case "task_state":
          // Authoritative snapshot on every (re)subscribe — never guessed locally.
          setTaskState(evt.state);
          setQueued(evt.queued ?? 0);
          break;
        case "approval_request": {
          const p = evt.toolCall.payload;
          setApprovals((prev) =>
            prev.some((a) => a.toolCallId === p.tool_call_id)
              ? prev
              : [...prev, { toolCallId: p.tool_call_id, name: p.name, args: p.arguments }],
          );
          break;
        }
        case "resync_required": {
          const sid = activeRef.current;
          if (sid) void rebuild(sid);
          break;
        }
        case "session_title":
          setSessions((prev) =>
            prev.map((s) =>
              s.sessionId === evt.sessionId ? { ...s, title: evt.title } : s,
            ),
          );
          break;
        default:
          break;
      }
    },
    [rebuild],
  );

  // Bootstrap: project + agent singleton, then the session list.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const projects = await listProjects();
        const p = projects.projects[0];
        if (!p) throw new Error("服务端没有任何 Project");
        const agents = await listAgents(p.projectId);
        const a = agents.agents[0];
        if (!a) throw new Error("Project 下没有任何 Agent");
        if (cancelled) return;
        setProjectId(p.projectId);
        setAgentId(a.agentId);
        const res = await listSessions(p.projectId, a.agentId);
        if (cancelled) return;
        let live = res.sessions.filter((s) => !s.archived);
        if (live.length === 0) {
          /*
           * Create the first session eagerly rather than lazily on first send.
           * A fresh SSE subscription intentionally does NOT replay the channel buffer
           * (history is the messages endpoint's job), so if the very first task were
           * posted into a session created in the same tick, its opening events would be
           * published before the subscription exists and could not be recovered from the
           * stream — the message would sit in the Trace but never render. Having a live
           * session (and therefore a live subscription) before the composer is usable
           * removes that window entirely.
           */
          const created = await createSession(p.projectId, a.agentId, {
            approvalMode: "allow-all",
          });
          if (cancelled) return;
          live = [created.session];
        }
        setSessions(live);
        setActiveSessionId(live[0]?.sessionId ?? null);
        setReady(true);
      } catch (err) {
        if (!cancelled) {
          setError(errText(err));
          setReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Global user channel: one connection for the whole app lifetime.
  useEffect(() => {
    sse.connectGlobal({ onServerEvent });
    return () => sse.disconnectGlobal();
  }, [onServerEvent]);

  // Session channel: close-then-open keeps the budget at <= 2 across switches.
  useEffect(() => {
    activeRef.current = activeSessionId;
    setApprovals([]);
    setTaskState("idle");
    setModel(emptyModel);
    seenRef.current = new Set();
    if (!activeSessionId) {
      sse.closeSession();
      return;
    }
    void rebuild(activeSessionId);
    sse.openSession(activeSessionId, { onMessage, onServerEvent });
    return () => sse.closeSession();
  }, [activeSessionId, onMessage, onServerEvent, rebuild]);

  const newSession = useCallback(async () => {
    if (!projectId || !agentId) return;
    setBusy(true);
    try {
      const res = await createSession(projectId, agentId, { approvalMode: "allow-all" });
      await refreshSessions(projectId, agentId);
      setActiveSessionId(res.session.sessionId);
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }, [projectId, agentId, refreshSessions]);

  const send = useCallback(
    async (text: string) => {
      const body = text.trim();
      if (!body) return;
      let sid = activeSessionId;
      let justCreated = false;
      setBusy(true);
      try {
        if (!sid) {
          if (!projectId || !agentId) return;
          const created = await createSession(projectId, agentId, {
            approvalMode: "allow-all",
          });
          sid = created.session.sessionId;
          justCreated = true;
          await refreshSessions(projectId, agentId);
          setActiveSessionId(sid);
        }
        // A busy session queues instead of 409-ing.
        const res = await postTask(sid, [{ type: "text", text: body }], {
          queueIfBusy: true,
        });
        // A trace-less session self-heals into a new id; follow it.
        if (res.sessionId !== sid) {
          if (projectId && agentId) await refreshSessions(projectId, agentId);
          setActiveSessionId(res.sessionId);
        } else if (justCreated) {
          // Fallback for the rare lazy-create path (bootstrap normally guarantees a live
          // session, so this is only reachable if that one was archived/deleted mid-flight):
          // re-read history, since events published before the subscription existed cannot
          // be recovered from the stream.
          void rebuild(res.sessionId);
        }
      } catch (err) {
        setError(errText(err));
      } finally {
        setBusy(false);
      }
    },
    [activeSessionId, projectId, agentId, refreshSessions, rebuild],
  );

  const decide = useCallback(
    async (toolCallId: string, decision: "allow" | "deny") => {
      if (!activeSessionId) return;
      setApprovals((prev) => prev.filter((a) => a.toolCallId !== toolCallId));
      try {
        await postApproval(activeSessionId, toolCallId, decision);
      } catch (err) {
        setError(errText(err));
      }
    },
    [activeSessionId],
  );

  /**
   * "Allow for the rest of this session": the approval API itself only takes allow/deny, so
   * this flips the session's approvalMode to allow-all (PATCH /api/sessions/:id) and then
   * allows the call in hand — a server-side change, not a client-side auto-clicker.
   */
  const allowRestOfSession = useCallback(
    async (toolCallId: string) => {
      if (!activeSessionId) return;
      try {
        await patchSession(activeSessionId, { approvalMode: "allow-all" });
        setSessions((prev) =>
          prev.map((s) =>
            s.sessionId === activeSessionId ? { ...s, approvalMode: "allow-all" } : s,
          ),
        );
      } catch (err) {
        setError(errText(err));
      }
      await decide(toolCallId, "allow");
    },
    [activeSessionId, decide],
  );

  const abort = useCallback(async () => {
    if (!activeSessionId) return;
    try {
      await abortSession(activeSessionId);
    } catch (err) {
      setError(errText(err));
    }
  }, [activeSessionId]);

  const selectSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
  }, []);

  const activeSession = useMemo(
    () => sessions.find((s) => s.sessionId === activeSessionId) ?? null,
    [sessions, activeSessionId],
  );

  const value: ChatContextValue = {
    ready,
    error,
    projectId,
    agentId,
    sessions,
    activeSessionId,
    activeSession,
    model,
    taskState,
    queued,
    approvals,
    busy,
    selectSession,
    newSession,
    send,
    decide,
    allowRestOfSession,
    abort,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used inside <ChatProvider>");
  return ctx;
}
