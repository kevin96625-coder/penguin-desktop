import { useLocation, useNavigate } from "react-router-dom";
import { BrandMark, SidebarItem } from "../../design-system/components";
import {
  BookIcon,
  ChartIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClockIcon,
  FlaskIcon,
  FolderIcon,
  LayoutDashboardIcon,
  MessageSquareIcon,
  PlusIcon,
  SettingsIcon,
  UserIcon,
} from "../../design-system/icons";
import { useChat } from "../chat/ChatProvider";
import type { WorkspaceAction, WorkspaceState } from "./workspace-state";
import AccountMenu from "./AccountMenu";
import EvolutionBadge from "./EvolutionBadge";

interface WorkspaceSidebarProps {
  state: WorkspaceState;
  dispatch: (action: WorkspaceAction) => void;
}

export default function WorkspaceSidebar({
  state,
  dispatch,
}: WorkspaceSidebarProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { projectId, agentId, sessions, activeSessionId, selectSession, newSession } =
    useChat();
  const projectExpanded =
    projectId !== null && !state.expandedProjectIds.includes(`collapsed:${projectId}`);

  function openConversation(sessionId: string) {
    selectSession(sessionId);
    navigate("/");
  }

  return (
    <aside
      className={`relative shrink-0 overflow-hidden border-r bg-[hsl(var(--sidebar-bg))] transition-[width,opacity,border-color] duration-200 ease-out ${
        state.sidebarCollapsed
          ? "w-0 border-transparent opacity-0"
          : "w-[272px] border-border/50 opacity-100"
      }`}
    >
      <div className="flex h-full w-[272px] flex-col">
        {/*
         * Brand band: the wordmark carries the weight, the mark supports it.
         * 22px plate-less logo (aligned to the nav icon column at 16px) + 14px
         * wordmark one step above the 13px nav rows, then 20px of air so the
         * band reads as a header rather than a first list item.
         */}
        <div className="flex items-center gap-2.5 px-4 pb-5 pt-4">
          <BrandMark size="xs" plate={false} />
          <span className="text-[14px] font-semibold tracking-[-0.01em] text-foreground">
            PenguinHarness
          </span>
        </div>

        <nav aria-label="工作区功能" className="space-y-0.5 px-2">
          <SidebarItem
            icon={<PlusIcon />}
            active={pathname === "/"}
            onClick={() => {
              navigate("/");
              void newSession();
            }}
          >
            New task
          </SidebarItem>
          <SidebarItem
            icon={<LayoutDashboardIcon />}
            active={pathname === "/dashboard"}
            onClick={() => navigate("/dashboard")}
          >
            Dashboard
          </SidebarItem>
          <SidebarItem
            icon={<FlaskIcon />}
            active={pathname === "/benchmarks"}
            onClick={() => navigate("/benchmarks")}
          >
            Benchmarks
          </SidebarItem>
          <SidebarItem
            icon={<BookIcon />}
            active={pathname === "/skills"}
            onClick={() => navigate("/skills")}
          >
            Skills
          </SidebarItem>
          <SidebarItem
            icon={<ClockIcon />}
            active={pathname === "/traces"}
            onClick={() => navigate("/traces")}
          >
            Traces
          </SidebarItem>
          <SidebarItem
            icon={<ChartIcon />}
            active={pathname === "/usage"}
            onClick={() => navigate("/usage")}
          >
            Usage
          </SidebarItem>
          <SidebarItem
            icon={<SettingsIcon />}
            active={pathname === "/settings"}
            onClick={() => navigate("/settings")}
          >
            Settings
          </SidebarItem>
        </nav>

        <div className="px-4 pb-1 pt-5 font-mono text-[9px] font-medium tracking-[0.14em] text-muted-foreground/65">
          PROJECTS
        </div>
        <nav aria-label="项目与会话" className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {projectId === null ? (
            <p className="px-2 py-1 text-[11px] text-muted-foreground">加载中…</p>
          ) : (
            <div className="mt-0.5">
              <button
                type="button"
                aria-expanded={projectExpanded}
                className="flex h-[30px] w-full items-center gap-2 rounded-lg px-2 text-left text-[12px] font-medium text-foreground/90 transition-colors duration-150 hover:bg-foreground/[0.05]"
                onClick={() =>
                  dispatch({ type: "toggle-project", projectId: `collapsed:${projectId}` })
                }
              >
                {projectExpanded ? (
                  <ChevronDownIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRightIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
                )}
                <FolderIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{projectId}</span>
              </button>
              {projectExpanded && (
                <div className="stagger-menu">
                  {/* Agent row carries the evolution chip: version + trend vs the
                      previous scoreboard round. Sessions nest under it. */}
                  {agentId && (
                    <SidebarItem
                      indent={1}
                      icon={<UserIcon />}
                      active={pathname === "/dashboard"}
                      className="animate-section-in text-[12px] font-medium"
                      onClick={() => navigate("/dashboard")}
                    >
                      <span className="flex w-full min-w-0 items-center gap-1.5">
                        <span className="truncate">{agentId}</span>
                        <EvolutionBadge projectId={projectId} agentId={agentId} />
                      </span>
                    </SidebarItem>
                  )}
                  {sessions.length === 0 && (
                    <p className="px-2 py-1 pl-10 text-[11px] text-muted-foreground">
                      还没有会话
                    </p>
                  )}
                  {sessions.map((session) => (
                    <SidebarItem
                      key={session.sessionId}
                      indent={2}
                      icon={<MessageSquareIcon />}
                      active={pathname === "/" && activeSessionId === session.sessionId}
                      className="animate-section-in text-[12px] font-normal"
                      onClick={() => openConversation(session.sessionId)}
                    >
                      {session.title ?? "New Chat"}
                    </SidebarItem>
                  ))}
                </div>
              )}
            </div>
          )}
        </nav>

        <div className="relative border-t border-border/40 p-2">
          {state.accountMenuOpen && (
            <AccountMenu onClose={() => dispatch({ type: "close-account-menu" })} />
          )}
          <button
            type="button"
            data-account-trigger
            aria-expanded={state.accountMenuOpen}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors duration-150 hover:bg-foreground/[0.05]"
            onClick={() => dispatch({ type: "toggle-account-menu" })}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--tool-search-accent)/0.18)] text-[10px] font-semibold text-foreground shadow-rim">
              KC
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-medium text-foreground">Kevin Chen</span>
              <span className="block truncate text-[10px] text-muted-foreground">Local workspace</span>
            </span>
            <ChevronDownIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </button>
        </div>
      </div>
    </aside>
  );
}
