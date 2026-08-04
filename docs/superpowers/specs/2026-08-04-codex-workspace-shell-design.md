# Codex-style workspace shell design

## Status

Approved in visual review on 2026-08-04. The user selected **B · Agent workspace** and separately approved the topbar/sidebar structure and the Agent conversation area.

## Goal

Replace the current dashboard-first shell with a Codex-like desktop workspace: a native-aligned titlebar, a functional project/session sidebar, and an Agent conversation as the primary right-hand surface. Preserve PenguinHarness's identity through first-class Evaluations and Runs navigation rather than copying Codex literally.

## Scope for this iteration

This iteration is a high-fidelity visual and local-interaction shell.

- Use credible local fixture data for projects, sessions, messages, tools, model, and status.
- Implement local interactions for sidebar collapse, project expansion, session selection, account menu, theme switching, composer drafting, and bottom/right panel visibility.
- Do not request `/api/projects`, `/api/sessions`, models, messages, tasks, or SSE endpoints.
- Do not send prompts, create sessions, mutate project data, or imply persisted server state.
- Preserve the existing login/logout behavior. API binding is explicitly deferred to the next iteration.
- Add no dependencies and do not modify `vendor/penguin-harness/`.

## Information architecture

### Native titlebar

The topbar remains a single 52px Tauri overlay surface. It is split at the 272px sidebar boundary so the topbar and body share one vertical grid.

- Native traffic lights stay at the system-controlled macOS position.
- The sidebar toggle is a 30×30px ghost control near the right edge of the sidebar segment.
- All web controls share the same vertical center as the traffic lights.
- The main segment contains the selected conversation title, a local model selector, a flexible drag region, the task status, and bottom/right panel toggles.
- Theme and Settings leave the topbar and move to the account menu.
- The titlebar keeps `data-tauri-drag-region` on every unused region.

This prevents the current visual problem where traffic lights, the sidebar toggle, and right-side controls appear as separate clusters with different optical baselines.

### Workspace sidebar

The expanded sidebar is 272px wide and uses the existing `--sidebar-bg` surface. It has four regions:

1. PenguinHarness brand.
2. Functional navigation: New task, Overview, Evaluations, Runs.
3. A scrollable Projects tree containing project rows and their conversation rows.
4. A pinned account row.

The selected conversation uses the existing sidebar selected-state recipe. Project rows are stronger than conversation rows; conversations are indented and lower contrast. Collapsing the sidebar removes it entirely and leaves the 52px topbar toggle accessible.

### Account menu

The sidebar footer becomes one compact account row with a rounded-square `KC` avatar, `Kevin Chen`, `Local workspace`, and a chevron. Clicking it opens a raised popover containing:

- Theme mode with light/dark/system cycling.
- Settings, visibly marked as unavailable in this iteration.
- Log out, using the existing logout request and redirect.

There is no separate Settings or Log out row in the sidebar and no theme or Settings icon in the topbar.

## Agent conversation surface

The selected project/session determines local display content. The conversation is the main content; it does not sit inside a dashboard card.

- The reading column is centered and capped at 768px.
- User messages are compact, right-aligned neutral bubbles.
- Assistant messages are unboxed prose on the canvas.
- Tool activity is rendered as a low-noise one-line row with icon, action label, and muted metadata.
- A compact `Preview workspace` status divider appears above the active exchange so fixture content cannot be mistaken for a real run.
- Message groups enter with the existing 300ms chat animation and stagger rules.
- Code and longer response content reuse the existing LiveAgent-derived chat tokens when introduced by fixture content.

The fixtures must be clearly representative but must not claim a real run occurred. Copy should describe the local visual-design task rather than inventing business data.

## Composer

The Composer is anchored at the bottom of the chat surface and constrained to the same reading column.

- It uses the existing `GlassCard` focus recipe: `blur(24px) saturate(165%)`, dual rim, gloss, and layered shadow.
- It is the only strong glass surface visible in the default chat state.
- The first row is a multiline text area with the prompt copy `描述下一步任务，或粘贴代码与截图…`.
- The lower row contains attachment affordance, local approval-mode control, and a circular send button.
- Typing updates only local state. Submitting appends a user message marked as local preview and clears the draft; it does not call an API or show a fabricated model response.
- Focus, hover, disabled, and keyboard-visible states must be present.

## Auxiliary panels

The bottom-panel and right-panel titlebar controls become real local layout toggles in this iteration.

- The right panel opens a narrow raised Inspector surface with static Run, Files, and Artifacts section labels.
- The bottom panel opens a shallow activity surface below the conversation with clearly labeled local fixture lines.
- Each control has a visible active state and an accessible label.
- Panels use the surface ladder and resize the workspace without covering the Composer.
- No panel data is loaded from the backend.

## Route and state model

The shell owns local navigation state for fixture projects, expanded groups, selected session, account-menu visibility, and auxiliary panels. Theme continues to use the existing persistent theme provider.

- `/` becomes the selected Agent conversation workspace.
- `/overview` retains the existing Overview page.
- Existing `/sessions` remains available as a compatibility route during this iteration but is no longer the primary navigation destination.
- Evaluations and Runs are visible workspace destinations with designed empty states; they do not fetch data.
- Login redirects to `/` as before.

State boundaries should remain explicit so the next iteration can replace fixture selectors with API-backed data without redesigning components.

## Component boundaries

- `WorkspaceTopbar`: native-safe alignment, context, status, and panel toggles.
- `WorkspaceSidebar`: functional navigation, project/session tree, and account control.
- `AccountMenu`: theme, Settings affordance, and logout.
- `ChatWorkspace`: message timeline, local fixtures, and panel layout.
- `ChatMessage`, `ToolActivityRow`, and `ChatComposer`: focused conversation primitives.
- `workspace-fixtures`: typed local data isolated from future endpoint adapters.

`AppShell` composes these units and holds only the small pieces of cross-surface local state. It should not become a monolithic topbar/sidebar/chat implementation.

## Visual tokens and dimensions

- Topbar: 52px.
- Expanded sidebar: 272px.
- Interactive titlebar controls: 30×30px inside an 8px radius.
- Chat reading column: maximum 768px.
- Composer: maximum 768px with an 18px outer radius.
- Global scrollbar: 6px.
- Dark mode surfaces: canvas → panel → raised → focus → modal, maintaining the established 3–4% lightness steps.
- No new colors; all surfaces, borders, text, and semantic states use existing design tokens.

## Responsive and native behavior

- At the Tauri minimum width of 1200px, the 272px sidebar leaves a comfortable conversation column.
- Titlebar labels truncate before controls compress.
- The draggable area retains a meaningful central target at all supported widths.
- Native traffic lights remain clickable and visually centered; web controls never overlap their safe area.
- Sidebar and auxiliary-panel transitions use transform/opacity where possible and honor `prefers-reduced-motion`.

## Accessibility

- Every icon-only control has an `aria-label` and tooltip/title.
- Account and project disclosure controls expose expanded state.
- Popover and local model menu are keyboard reachable and close with Escape or outside click.
- Selected navigation and panel states are not communicated by color alone.
- Composer retains an accessible label and visible container focus treatment.

## Verification

Implementation is accepted only after:

1. The four repository guardrails pass and the submodule is clean.
2. `pnpm typecheck`, `pnpm build`, and `cargo check --manifest-path src-tauri/Cargo.toml` pass.
3. A native Tauri window is inspected at 1280×800 in light and dark themes.
4. Screenshots demonstrate the chat workspace, expanded account menu, collapsed sidebar, and auxiliary panel toggles.
5. No network request is made by project/session selection, composer submission, or panel toggles.
6. The visual-memory document remains unchanged.
