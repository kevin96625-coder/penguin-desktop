import { useNavigate } from "react-router-dom";
import { Button, StatusBadge } from "../../design-system/components";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ChevronDownIcon,
  MessageSquareIcon,
  PanelBottomIcon,
  PanelLeftIcon,
  PanelRightIcon,
  SquarePenIcon,
} from "../../design-system/icons";
import type { WorkspaceSession } from "./workspace-fixtures";
import type { WorkspaceAction, WorkspaceState } from "./workspace-state";

interface WorkspaceTopbarProps {
  state: WorkspaceState;
  dispatch: (action: WorkspaceAction) => void;
  session: WorkspaceSession;
}

export default function WorkspaceTopbar({
  state,
  dispatch,
  session,
}: WorkspaceTopbarProps) {
  const navigate = useNavigate();
  const chromeButton =
    "h-[30px] w-[30px] shrink-0 rounded-lg text-foreground/70 hover:bg-surface-raised";

  function openNewTask() {
    dispatch({ type: "select-session", sessionId: "visual-review" });
    navigate("/");
  }

  /*
   * Codex-style window chrome: ONE continuous band across the whole width — no
   * sidebar tint and no vertical divider inside the topbar (the sidebar's own
   * border starts below it). The left cluster is native traffic-light clearance
   * followed by [panel toggle][back][forward]; collapsing the sidebar appends a
   * compose button, because "New task" is only reachable from the rail when the
   * rail is open. The grid column keeps the title aligned to the sidebar edge
   * when open, and lets it follow the cluster when closed.
   */
  return (
    <header
      data-tauri-drag-region
      className="grid h-[52px] shrink-0 border-b border-border/50 bg-surface-panel"
      style={{
        gridTemplateColumns: state.sidebarCollapsed ? "200px minmax(0, 1fr)" : "272px minmax(0, 1fr)",
      }}
    >
      <div data-tauri-drag-region className="flex h-full items-center">
        <div data-tauri-drag-region className="h-full w-[76px] shrink-0" />
        <Button
          variant="ghost"
          size="icon"
          className={chromeButton}
          title={state.sidebarCollapsed ? "展开侧栏" : "收起侧栏"}
          aria-label={state.sidebarCollapsed ? "展开侧栏" : "收起侧栏"}
          aria-pressed={!state.sidebarCollapsed}
          onClick={() => dispatch({ type: "toggle-sidebar" })}
        >
          <PanelLeftIcon className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={chromeButton}
          title="后退"
          aria-label="后退"
          onClick={() => navigate(-1)}
        >
          <ArrowLeftIcon className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={chromeButton}
          title="前进"
          aria-label="前进"
          onClick={() => navigate(1)}
        >
          <ArrowRightIcon className="h-4 w-4" />
        </Button>
        {state.sidebarCollapsed && (
          <Button
            variant="ghost"
            size="icon"
            className={chromeButton}
            title="新任务"
            aria-label="新任务"
            onClick={openNewTask}
          >
            <SquarePenIcon className="h-4 w-4" />
          </Button>
        )}
        <div data-tauri-drag-region className="h-full min-w-2 flex-1" />
      </div>

      <div data-tauri-drag-region className="flex h-full min-w-0 items-center gap-1.5 px-3">
        <Button
          variant="ghost"
          size="sm"
          className="h-[30px] min-w-0 max-w-[190px] justify-start gap-1.5 rounded-lg px-2 text-[12px] font-semibold tracking-tight hover:bg-surface-raised"
          title={`${session.title} · ${session.agentId}`}
        >
          <MessageSquareIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{session.title}</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-[30px] min-w-0 max-w-[220px] justify-start gap-1.5 rounded-lg border border-border/50 bg-surface-raised px-2.5 font-mono text-[11px] font-medium text-foreground/75 shadow-rim hover:bg-surface-focus hover:text-foreground"
          title={`本地视觉预览模型：${session.model}`}
        >
          <span className="truncate">{session.model}</span>
          <ChevronDownIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
        </Button>

        <div data-tauri-drag-region className="h-full min-w-10 flex-1" />

        <StatusBadge status={session.status} className="shrink-0">
          {session.status === "idle" ? "Idle" : session.status}
        </StatusBadge>
        <span aria-hidden className="mx-0.5 h-4 w-px shrink-0 bg-border/70" />
        <Button
          variant="ghost"
          size="icon"
          className={`h-[30px] w-[30px] shrink-0 rounded-lg text-foreground/70 ${
            state.bottomPanelOpen ? "bg-foreground/[0.09] text-foreground" : "hover:bg-surface-raised"
          }`}
          title="切换活动面板"
          aria-label="切换活动面板"
          aria-pressed={state.bottomPanelOpen}
          onClick={() => dispatch({ type: "toggle-bottom-panel" })}
        >
          <PanelBottomIcon className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={`h-[30px] w-[30px] shrink-0 rounded-lg text-foreground/70 ${
            state.rightPanelOpen ? "bg-foreground/[0.09] text-foreground" : "hover:bg-surface-raised"
          }`}
          title="切换检查器"
          aria-label="切换检查器"
          aria-pressed={state.rightPanelOpen}
          onClick={() => dispatch({ type: "toggle-right-panel" })}
        >
          <PanelRightIcon className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
