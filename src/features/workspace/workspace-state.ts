/**
 * Shell-only UI state. Session selection, the draft and the transcript moved into
 * features/chat/ChatProvider when stage 4a replaced the fixtures with the real API — this
 * reducer now owns nothing but the chrome toggles.
 */
export interface WorkspaceState {
  sidebarCollapsed: boolean;
  bottomPanelOpen: boolean;
  rightPanelOpen: boolean;
  accountMenuOpen: boolean;
  expandedProjectIds: string[];
}

export type WorkspaceAction =
  | { type: "toggle-sidebar" }
  | { type: "toggle-bottom-panel" }
  | { type: "toggle-right-panel" }
  | { type: "toggle-account-menu" }
  | { type: "close-account-menu" }
  | { type: "toggle-project"; projectId: string };

export interface WorkspaceOutletContext {
  state: WorkspaceState;
  dispatch: (action: WorkspaceAction) => void;
}

export const initialWorkspaceState: WorkspaceState = {
  sidebarCollapsed: false,
  bottomPanelOpen: false,
  rightPanelOpen: false,
  accountMenuOpen: false,
  expandedProjectIds: [],
};

export function workspaceReducer(
  state: WorkspaceState,
  action: WorkspaceAction,
): WorkspaceState {
  switch (action.type) {
    case "toggle-sidebar":
      return { ...state, sidebarCollapsed: !state.sidebarCollapsed };
    case "toggle-bottom-panel":
      return { ...state, bottomPanelOpen: !state.bottomPanelOpen };
    case "toggle-right-panel":
      return { ...state, rightPanelOpen: !state.rightPanelOpen };
    case "toggle-account-menu":
      return { ...state, accountMenuOpen: !state.accountMenuOpen };
    case "close-account-menu":
      return state.accountMenuOpen ? { ...state, accountMenuOpen: false } : state;
    case "toggle-project": {
      const expanded = state.expandedProjectIds.includes(action.projectId);
      return {
        ...state,
        expandedProjectIds: expanded
          ? state.expandedProjectIds.filter((id) => id !== action.projectId)
          : [...state.expandedProjectIds, action.projectId],
      };
    }
  }
}
