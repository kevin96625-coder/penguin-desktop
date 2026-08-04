import { useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { FileIcon, TerminalIcon, WrenchIcon } from "../../design-system/icons";
import { useChat } from "../chat/ChatProvider";
import ApprovalBar from "./ApprovalBar";
import ChatComposer from "./ChatComposer";
import ChatMessage from "./ChatMessage";
import type { WorkspaceOutletContext } from "./workspace-state";

function InspectorPanel() {
  const { model, taskState, activeSession } = useChat();
  const toolCount = model.blocks.filter((b) => b.kind === "tool").length;
  const rows: [typeof WrenchIcon, string, string][] = [
    [WrenchIcon, "Run", taskState],
    [FileIcon, "Tools", `${toolCount} calls`],
    [
      TerminalIcon,
      "Tokens",
      model.usage ? String(model.usage.total) : "—",
    ],
  ];
  return (
    <aside className="animate-tool-expand-in w-[248px] shrink-0 border-l border-border/50 bg-surface-panel px-3 py-4">
      <p className="px-1 font-mono text-[9px] font-medium tracking-[0.14em] text-muted-foreground/70">
        INSPECTOR
      </p>
      <div className="mt-3 space-y-1">
        {rows.map(([Icon, label, value]) => (
          <div
            key={label}
            className="flex items-center gap-2 rounded-lg px-2 py-2 text-[12px] text-foreground/85 hover:bg-foreground/[0.04]"
          >
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{label}</span>
            <span className="ml-auto font-mono text-[10px] text-muted-foreground">
              {value}
            </span>
          </div>
        ))}
      </div>
      {activeSession && (
        <div className="mt-4 rounded-xl border border-border/50 bg-surface-raised p-3">
          <p className="text-[11px] font-medium">审批模式</p>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
            {activeSession.approvalMode}
          </p>
        </div>
      )}
    </aside>
  );
}

function ActivityPanel() {
  const { model } = useChat();
  const notices = model.blocks.filter((b) => b.kind === "notice").slice(-6);
  return (
    <section
      className="animate-tool-expand-in h-[132px] shrink-0 overflow-y-auto border-t border-border/50 bg-surface-panel px-4 py-3"
      aria-label="活动面板"
    >
      <div className="flex items-center gap-2">
        <TerminalIcon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[11px] font-medium">Activity</span>
      </div>
      <div className="mt-3 space-y-1.5 font-mono text-[10px] text-muted-foreground">
        {notices.length === 0 ? (
          <p>没有运行事件</p>
        ) : (
          notices.map((n) => <p key={n.id}>{n.kind === "notice" ? n.text : ""}</p>)
        )}
      </div>
    </section>
  );
}

export default function ChatWorkspace() {
  const { state } = useOutletContext<WorkspaceOutletContext>();
  const {
    ready,
    error,
    agentId,
    activeSession,
    model,
    taskState,
    queued,
    approvals,
    busy,
    send,
    decide,
    allowRestOfSession,
    abort,
  } = useChat();
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);

  // Follow the stream only while the user is already at the bottom.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => {
      pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (pinnedRef.current) endRef.current?.scrollIntoView({ block: "end" });
  }, [model.blocks]);

  // ESC aborts from anywhere in the workspace, not just the textarea.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && taskState !== "idle") void abort();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [taskState, abort]);

  async function onSubmit() {
    const text = draft;
    setDraft("");
    await send(text);
  }

  return (
    <div className="flex h-full min-h-0 bg-background">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col">
          <div ref={scrollerRef} className="min-h-0 flex-1 overflow-y-auto px-6 pb-5 pt-4">
            <div className="mx-auto w-full max-w-3xl">
              <div className="animate-section-in mb-4 flex items-center gap-2 border-b border-border/40 pb-3 text-[11px] text-muted-foreground">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: `hsl(var(--status-${taskState === "idle" ? "complete" : "running"}))` }}
                />
                {activeSession?.title ?? "新会话"}
                <span aria-hidden>·</span>
                <span>{agentId ?? "—"}</span>
                {activeSession && (
                  <span className="ml-auto font-mono text-[10px] text-muted-foreground/70">
                    {activeSession.modelId}
                  </span>
                )}
              </div>

              {error && (
                <p className="my-3 rounded-lg border border-[hsl(var(--chat-error))]/40 px-3 py-2 text-[12px] text-[hsl(var(--chat-error))]">
                  {error}
                </p>
              )}
              {!ready && <p className="text-[12px] text-muted-foreground">加载中…</p>}
              {ready && model.blocks.length === 0 && !error && (
                <p className="mt-8 text-center text-[12px] text-muted-foreground">
                  发一条消息开始这个会话
                </p>
              )}

              {model.blocks.map((block) => (
                <ChatMessage key={block.id} block={block} />
              ))}
              <div ref={endRef} />
            </div>
          </div>

          <div className="shrink-0 px-6 pb-4 pt-2">
            {/* Outside the scroller on purpose: a pending approval blocks the task, so it
                must stay visible regardless of scroll position. */}
            {approvals.length > 0 && (
              <ApprovalBar
                approval={approvals[0]}
                pendingCount={approvals.length}
                onDecide={(id, d) => void decide(id, d)}
                onAllowSession={(id) => void allowRestOfSession(id)}
              />
            )}
            <ChatComposer
              value={draft}
              onChange={setDraft}
              onSubmit={() => void onSubmit()}
              onAbort={() => void abort()}
              taskState={taskState}
              queued={queued}
              agentId={agentId}
              disabled={busy || !ready}
            />
          </div>
        </div>
        {state.bottomPanelOpen && <ActivityPanel />}
      </div>
      {state.rightPanelOpen && <InspectorPanel />}
    </div>
  );
}
