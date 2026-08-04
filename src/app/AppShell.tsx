import { useReducer } from "react";
import { Outlet } from "react-router-dom";
import { findWorkspaceSession } from "../features/workspace/workspace-fixtures";
import {
  initialWorkspaceState,
  workspaceReducer,
} from "../features/workspace/workspace-state";
import WorkspaceSidebar from "../features/workspace/WorkspaceSidebar";
import WorkspaceTopbar from "../features/workspace/WorkspaceTopbar";

/**
 * Codex-style desktop shell: one native overlay topbar, one project tree, and
 * one routed work surface. Project/chat data remains local until the API phase.
 */
export default function AppShell() {
  const [state, dispatch] = useReducer(workspaceReducer, initialWorkspaceState);
  const session = findWorkspaceSession(state.selectedSessionId);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <WorkspaceTopbar state={state} dispatch={dispatch} session={session} />
      <div className="flex min-h-0 flex-1">
        <WorkspaceSidebar state={state} dispatch={dispatch} />
        <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <Outlet context={{ state, dispatch }} />
        </main>
      </div>
    </div>
  );
}
