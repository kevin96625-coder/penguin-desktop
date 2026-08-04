import { useOutletContext } from "react-router-dom";
import { FileIcon, TerminalIcon, WrenchIcon } from "../../design-system/icons";
import ChatComposer from "./ChatComposer";
import ChatMessage from "./ChatMessage";
import { findWorkspaceSession } from "./workspace-fixtures";
import type { WorkspaceOutletContext } from "./workspace-state";

function InspectorPanel() {
  return (
    <aside className="animate-tool-expand-in w-[248px] shrink-0 border-l border-border/50 bg-surface-panel px-3 py-4">
      <p className="px-1 font-mono text-[9px] font-medium tracking-[0.14em] text-muted-foreground/70">INSPECTOR</p>
      <div className="mt-3 space-y-1">
        {[
          [WrenchIcon, "Run", "Idle"],
          [FileIcon, "Files", "3 viewed"],
          [TerminalIcon, "Artifacts", "No output"],
        ].map(([Icon, label, value]) => (
          <div key={String(label)} className="flex items-center gap-2 rounded-lg px-2 py-2 text-[12px] text-foreground/85 hover:bg-foreground/[0.04]">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{String(label)}</span>
            <span className="ml-auto text-[10px] text-muted-foreground">{String(value)}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-xl border border-border/50 bg-surface-raised p-3">
        <p className="text-[11px] font-medium">下一轮接入真实运行数据</p>
        <p className="mt-1 text-[10px] leading-4 text-muted-foreground">当前检查器仅用于确认桌面工作区的空间关系。</p>
      </div>
    </aside>
  );
}

function ActivityPanel() {
  return (
    <section className="animate-tool-expand-in h-[132px] shrink-0 border-t border-border/50 bg-surface-panel px-4 py-3" aria-label="活动面板">
      <div className="flex items-center gap-2">
        <TerminalIcon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[11px] font-medium">Activity</span>
        <span className="rounded-md bg-foreground/[0.05] px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">LOCAL</span>
      </div>
      <div className="mt-3 space-y-1.5 font-mono text-[10px] text-muted-foreground">
        <p><span className="text-[hsl(var(--chat-success))]">✓</span> workspace shell mounted</p>
        <p><span className="text-[hsl(var(--chat-success))]">✓</span> visual tokens loaded</p>
        <p><span className="text-[hsl(var(--chat-running))]">○</span> API binding deferred to next iteration</p>
      </div>
    </section>
  );
}

export default function ChatWorkspace() {
  const { state, dispatch } = useOutletContext<WorkspaceOutletContext>();
  const session = findWorkspaceSession(state.selectedSessionId);

  return (
    <div className="flex h-full min-h-0 bg-background">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-5 pt-4">
            <div className="stagger-menu mx-auto w-full max-w-3xl">
              <div className="animate-section-in mb-4 flex items-center gap-2 border-b border-border/40 pb-3 text-[11px] text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--chat-running))]" />
                Preview workspace
                <span aria-hidden>·</span>
                <span>{session.agentId}</span>
              </div>
              {session.messages.map((message) => <ChatMessage key={message.id} message={message} />)}
              {state.previewMessages.map((message) => (
                <div key={message.id}>
                  <ChatMessage message={{ id: message.id, kind: "user", content: message.content }} />
                  <p className="-mt-2 text-right font-mono text-[9px] tracking-[0.08em] text-muted-foreground/55">LOCAL PREVIEW</p>
                </div>
              ))}
            </div>
          </div>
          <div className="shrink-0 px-6 pb-5 pt-2">
            <ChatComposer
              value={state.draft}
              onChange={(value) => dispatch({ type: "set-draft", value })}
              onSubmit={() => dispatch({ type: "submit-draft" })}
            />
          </div>
        </div>
        {state.bottomPanelOpen && <ActivityPanel />}
      </div>
      {state.rightPanelOpen && <InspectorPanel />}
    </div>
  );
}
