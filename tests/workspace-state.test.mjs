import test from "node:test";
import assert from "node:assert/strict";

import {
  initialWorkspaceState,
  workspaceReducer,
} from "../src/features/workspace/workspace-state.ts";

test("panel toggles preserve the selected conversation", () => {
  const right = workspaceReducer(initialWorkspaceState, {
    type: "toggle-right-panel",
  });
  const bottom = workspaceReducer(right, { type: "toggle-bottom-panel" });

  assert.equal(right.rightPanelOpen, true);
  assert.equal(bottom.bottomPanelOpen, true);
  assert.equal(bottom.selectedSessionId, initialWorkspaceState.selectedSessionId);
});

test("selecting a conversation closes the account menu", () => {
  const open = workspaceReducer(initialWorkspaceState, {
    type: "toggle-account-menu",
  });
  const selected = workspaceReducer(open, {
    type: "select-session",
    sessionId: "api-integration",
  });

  assert.equal(selected.selectedSessionId, "api-integration");
  assert.equal(selected.accountMenuOpen, false);
});

test("submitting a trimmed draft appends only a local user preview", () => {
  const drafted = workspaceReducer(initialWorkspaceState, {
    type: "set-draft",
    value: "  Review the titlebar  ",
  });
  const submitted = workspaceReducer(drafted, { type: "submit-draft" });

  assert.equal(submitted.draft, "");
  assert.deepEqual(submitted.previewMessages.at(-1), {
    id: "preview-1",
    role: "user",
    content: "Review the titlebar",
    localPreview: true,
  });
});

test("submitting an empty draft leaves state unchanged", () => {
  const submitted = workspaceReducer(initialWorkspaceState, {
    type: "submit-draft",
  });

  assert.equal(submitted, initialWorkspaceState);
});
