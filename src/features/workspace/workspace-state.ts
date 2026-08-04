export interface PreviewMessage {
  id: string;
  role: "user";
  content: string;
  localPreview: true;
}

export interface WorkspaceState {
  sidebarCollapsed: boolean;
  bottomPanelOpen: boolean;
  rightPanelOpen: boolean;
  accountMenuOpen: boolean;
  expandedProjectIds: string[];
  selectedSessionId: string;
  draft: string;
  previewMessages: PreviewMessage[];
}

export type WorkspaceAction =
  | { type: "toggle-sidebar" }
  | { type: "toggle-bottom-panel" }
  | { type: "toggle-right-panel" }
  | { type: "toggle-account-menu" }
  | { type: "close-account-menu" }
  | { type: "toggle-project"; projectId: string }
  | { type: "select-session"; sessionId: string }
  | { type: "set-draft"; value: string }
  | { type: "submit-draft" };

export interface WorkspaceOutletContext {
  state: WorkspaceState;
  dispatch: (action: WorkspaceAction) => void;
}

export const initialWorkspaceState: WorkspaceState = {
  sidebarCollapsed: false,
  bottomPanelOpen: false,
  rightPanelOpen: false,
  accountMenuOpen: false,
  expandedProjectIds: ["penguin-desktop", "live-agent"],
  selectedSessionId: "visual-review",
  draft: "",
  previewMessages: [],
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
    case "select-session":
      return {
        ...state,
        selectedSessionId: action.sessionId,
        accountMenuOpen: false,
      };
    case "set-draft":
      return { ...state, draft: action.value };
    case "submit-draft": {
      const content = state.draft.trim();
      if (!content) return state;
      return {
        ...state,
        draft: "",
        previewMessages: [
          ...state.previewMessages,
          {
            id: `preview-${state.previewMessages.length + 1}`,
            role: "user",
            content,
            localPreview: true,
          },
        ],
      };
    }
  }
}
