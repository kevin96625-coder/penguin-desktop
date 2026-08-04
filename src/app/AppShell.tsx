import { useReducer } from "react";
import { Outlet } from "react-router-dom";
import { ChatProvider } from "../features/chat/ChatProvider";
import {
  initialWorkspaceState,
  workspaceReducer,
} from "../features/workspace/workspace-state";
import WorkspaceSidebar from "../features/workspace/WorkspaceSidebar";
import WorkspaceTopbar from "../features/workspace/WorkspaceTopbar";

/**
 * Codex-style desktop shell: one native overlay topbar, one project tree, and one routed
 * work surface. ChatProvider owns the project/agent singleton, the session list and the
 * live stream, so the shell chrome and the routed surface read the same state.
 */
export default function AppShell() {
  const [state, dispatch] = useReducer(workspaceReducer, initialWorkspaceState);

  return (
    <ChatProvider>
      <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
        <WorkspaceTopbar state={state} dispatch={dispatch} />
        <div className="flex min-h-0 flex-1">
          <WorkspaceSidebar state={state} dispatch={dispatch} />
          <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
            <Outlet context={{ state, dispatch }} />
          </main>
        </div>
      </div>
    </ChatProvider>
  );
}
