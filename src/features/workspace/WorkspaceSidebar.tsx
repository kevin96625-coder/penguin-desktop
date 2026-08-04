import { useLocation, useNavigate } from "react-router-dom";
import { BrandMark, SidebarItem } from "../../design-system/components";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ClockIcon,
  FlaskIcon,
  FolderIcon,
  LayoutDashboardIcon,
  MessageSquareIcon,
  PlusIcon,
} from "../../design-system/icons";
import { workspaceProjects } from "./workspace-fixtures";
import type { WorkspaceAction, WorkspaceState } from "./workspace-state";
import AccountMenu from "./AccountMenu";

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

  function openConversation(sessionId: string) {
    dispatch({ type: "select-session", sessionId });
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
        <div className="flex items-center gap-2 px-4 pb-1 pt-3">
          <BrandMark size="sm" />
          <span className="text-[13px] font-semibold tracking-tight text-foreground">
            PenguinHarness
          </span>
        </div>

        <nav aria-label="工作区功能" className="space-y-0.5 px-2 pt-3">
          <SidebarItem
            icon={<PlusIcon />}
            active={pathname === "/"}
            onClick={() => openConversation("visual-review")}
          >
            New task
          </SidebarItem>
          <SidebarItem
            icon={<LayoutDashboardIcon />}
            active={pathname === "/overview"}
            onClick={() => navigate("/overview")}
          >
            Overview
          </SidebarItem>
          <SidebarItem
            icon={<FlaskIcon />}
            active={pathname === "/evaluations"}
            onClick={() => navigate("/evaluations")}
          >
            Evaluations
          </SidebarItem>
          <SidebarItem
            icon={<ClockIcon />}
            active={pathname === "/runs"}
            onClick={() => navigate("/runs")}
          >
            Runs
          </SidebarItem>
        </nav>

        <div className="px-4 pb-1 pt-5 font-mono text-[9px] font-medium tracking-[0.14em] text-muted-foreground/65">
          PROJECTS
        </div>
        <nav aria-label="项目与会话" className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {workspaceProjects.map((project) => {
            const expanded = state.expandedProjectIds.includes(project.id);
            return (
              <div key={project.id} className="mt-0.5">
                <button
                  type="button"
                  aria-expanded={expanded}
                  className="flex h-[30px] w-full items-center gap-2 rounded-lg px-2 text-left text-[12px] font-medium text-foreground/90 transition-colors duration-150 hover:bg-foreground/[0.05]"
                  onClick={() => dispatch({ type: "toggle-project", projectId: project.id })}
                >
                  {expanded ? (
                    <ChevronDownIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRightIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
                  )}
                  <FolderIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{project.name}</span>
                </button>
                {expanded && (
                  <div className="stagger-menu">
                    {project.sessions.map((session) => (
                      <SidebarItem
                        key={session.id}
                        indent={1}
                        icon={<MessageSquareIcon />}
                        active={pathname === "/" && state.selectedSessionId === session.id}
                        className="animate-section-in text-[12px] font-normal"
                        onClick={() => openConversation(session.id)}
                      >
                        {session.title}
                      </SidebarItem>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
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
