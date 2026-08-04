# Codex-style Workspace Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Deliver a native-aligned Codex-style workspace shell with local project/session navigation, Agent chat preview, account menu, and functional local panel toggles without calling project or chat APIs.

**Architecture:** `AppShell` owns a typed reducer and composes a focused topbar and sidebar around routed content. Fixture data is isolated from future endpoint adapters; the chat route reads the reducer through Outlet context. Existing design tokens and `GlassCard` remain the only styling sources.

**Tech Stack:** React 19, React Router 7, TypeScript 5.8, Tailwind CSS 4, Tauri 2, Node 25 built-in test runner.

---

### Task 1: Define and test local workspace behavior

**Files:**
- Create: `tests/workspace-state.test.mjs`
- Create: `src/features/workspace/workspace-state.ts`
- Create: `src/features/workspace/workspace-fixtures.ts`

- [x] **Step 1: Write the failing reducer tests**

Create Node tests that import `workspaceReducer` and `initialWorkspaceState` and assert:

```js
test("panel toggles preserve the selected conversation", () => {
  const right = workspaceReducer(initialWorkspaceState, { type: "toggle-right-panel" });
  assert.equal(right.rightPanelOpen, true);
  assert.equal(right.selectedSessionId, initialWorkspaceState.selectedSessionId);
});

test("submitting a trimmed draft appends only a local user preview", () => {
  const drafted = workspaceReducer(initialWorkspaceState, { type: "set-draft", value: "  Review the titlebar  " });
  const submitted = workspaceReducer(drafted, { type: "submit-draft" });
  assert.equal(submitted.draft, "");
  assert.deepEqual(submitted.previewMessages.at(-1), {
    id: "preview-1",
    role: "user",
    content: "Review the titlebar",
    localPreview: true,
  });
});
```

- [x] **Step 2: Verify RED**

Run: `node --test tests/workspace-state.test.mjs`

Expected: failure because `src/features/workspace/workspace-state.ts` does not exist.

- [x] **Step 3: Implement the reducer and fixtures**

Define these stable contracts:

```ts
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
```

`submit-draft` trims whitespace, ignores an empty draft, appends one local user preview, and never creates an assistant reply.

- [x] **Step 4: Verify GREEN**

Run: `node --test tests/workspace-state.test.mjs`

Expected: all reducer tests pass.

### Task 2: Build focused workspace components

**Files:**
- Create: `src/features/workspace/WorkspaceTopbar.tsx`
- Create: `src/features/workspace/WorkspaceSidebar.tsx`
- Create: `src/features/workspace/AccountMenu.tsx`
- Create: `src/features/workspace/ChatMessage.tsx`
- Create: `src/features/workspace/ChatComposer.tsx`
- Create: `src/features/workspace/ChatWorkspace.tsx`
- Create: `src/features/workspace/WorkspaceEmptyPage.tsx`
- Modify: `src/design-system/icons.tsx`

- [x] **Step 1: Add the required stroke icons**

Add folder, chevron-right, plus, flask, clock, terminal, paperclip, arrow-up, wrench, file, and user icons using the existing `IconBase` stroke recipe. No dependency is added.

- [x] **Step 2: Implement the titlebar**

Render a 52px two-segment grid. The 272px sidebar segment contains only the native traffic-light safe area and one 30×30px sidebar toggle. The main segment contains selected conversation title, static model control, drag region, `StatusBadge`, and active-state bottom/right panel toggles. It must not contain theme or Settings controls.

- [x] **Step 3: Implement the sidebar and account menu**

Render New task, Overview, Evaluations, and Runs above a typed project/session tree. The account menu contains theme cycling, disabled Settings, and real logout. Project disclosures and account controls expose `aria-expanded`; Escape and outside click close the menu.

- [x] **Step 4: Implement conversation primitives**

`ChatMessage` renders `user`, `assistant`, and `tool` variants with the approved bubble/no-bubble/tool-row hierarchy. `ChatComposer` uses `GlassCard`, a multiline textarea, local approval control, attachment affordance, and a circular submit button disabled for a blank draft.

- [x] **Step 5: Implement workspace and static destinations**

`ChatWorkspace` renders the centered 768px timeline, local preview divider, Composer, and locally toggled Inspector/activity surfaces. `WorkspaceEmptyPage` gives Evaluations and Runs a designed empty state without fetching data.

### Task 3: Compose routes and correct the native control baseline

**Files:**
- Modify: `src/app/AppShell.tsx`
- Modify: `src/app/router.tsx`
- Modify: `src-tauri/tauri.conf.json`

- [x] **Step 1: Refactor AppShell**

Use `useReducer(workspaceReducer, initialWorkspaceState)`, render `WorkspaceTopbar` and `WorkspaceSidebar`, and pass `{ state, dispatch }` through `Outlet` context. Keep the topbar and body on the same 272px grid.

- [x] **Step 2: Update routes**

Map `/` to `ChatWorkspace`, `/overview` to the existing Overview page, `/evaluations` and `/runs` to `WorkspaceEmptyPage`, and retain `/sessions` for compatibility.

- [x] **Step 3: Pin native traffic lights to the topbar baseline**

Add the supported Tauri configuration:

```json
"trafficLightPosition": { "x": 14, "y": 18 }
```

The 12px native controls then center optically in the 52px topbar.

### Task 4: Verify behavior and visual output

**Files:**
- Update: `docs/visual-memory/stage-3-screenshots/sessions-light.png`
- Update: `docs/visual-memory/stage-3-screenshots/sessions-dark.png`
- Create: `docs/visual-memory/stage-3-screenshots/workspace-account-menu.png`
- Create: `docs/visual-memory/stage-3-screenshots/workspace-panels-dark.png`

- [x] **Step 1: Run automated checks**

Run:

```bash
node --test tests/workspace-state.test.mjs
pnpm typecheck
pnpm build
cargo check --manifest-path src-tauri/Cargo.toml
```

Expected: every command exits 0.

- [x] **Step 2: Run the four repository guardrails**

Expected: submodule prints `CLEAN`; all three forbidden-path searches produce no matches.

- [x] **Step 3: Inspect the native Tauri window**

Run at 1280×800 and verify light/dark chat workspaces, full traffic lights, shared titlebar baseline, sidebar collapse, account menu, local Composer submission, and both auxiliary panel toggles.

- [x] **Step 4: Capture the approved states**

Capture native PNGs for light/dark chat workspace plus account-menu and panel-open states. Confirm every image is 1280×800 and replace the old Sessions screenshots with the new primary conversation workspace.

- [x] **Step 5: Commit and push**

Create one implementation commit:

```bash
git commit -m "style: stage-3 visual optimization round 4 — build Codex workspace shell"
git push
```
