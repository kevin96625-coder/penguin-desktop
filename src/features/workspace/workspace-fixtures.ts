import type { BadgeStatus } from "../../design-system/components";

export interface WorkspaceMessage {
  id: string;
  kind: "user" | "assistant" | "tool";
  content: string;
  meta?: string;
}

export interface WorkspaceSession {
  id: string;
  title: string;
  agentId: string;
  model: string;
  status: BadgeStatus;
  messages: WorkspaceMessage[];
}

export interface WorkspaceProject {
  id: string;
  name: string;
  sessions: WorkspaceSession[];
}

export const workspaceProjects: WorkspaceProject[] = [
  {
    id: "penguin-desktop",
    name: "penguin-desktop",
    sessions: [
      {
        id: "visual-review",
        title: "视觉优化闭环",
        agentId: "default_agent",
        model: "gemini-3.6-flash-high",
        status: "idle",
        messages: [
          {
            id: "visual-user",
            kind: "user",
            content:
              "把窗口顶栏与 Codex 对齐，并重构成项目 + Agent 对话工作区。",
          },
          {
            id: "visual-tool-read",
            kind: "tool",
            content: "Read project structure",
            meta: "3 files",
          },
          {
            id: "visual-assistant-one",
            kind: "assistant",
            content:
              "我会先校正原生交通灯与 52px 顶栏的共同基线，再把全局设置收进账号菜单。左侧保留项目与会话树，右侧成为连续的 Agent 对话区。",
          },
          {
            id: "visual-tool-update",
            kind: "tool",
            content: "Updated workspace layout",
            meta: "AppShell.tsx",
          },
          {
            id: "visual-assistant-two",
            kind: "assistant",
            content:
              "当前结构由顶栏承担上下文、左栏承担导航、正文承担对话。它保留 Codex 的聚焦感，同时让 Evaluations 与 Runs 成为 PenguinHarness 的工作台入口。",
          },
        ],
      },
      {
        id: "api-integration",
        title: "API integration",
        agentId: "default_agent",
        model: "gemini-3.6-flash-high",
        status: "queued",
        messages: [
          {
            id: "api-assistant",
            kind: "assistant",
            content:
              "这是下一轮的 API 接入工作区。本轮只确认项目、会话和消息在桌面端中的视觉关系。",
          },
        ],
      },
    ],
  },
  {
    id: "live-agent",
    name: "LiveAgent",
    sessions: [
      {
        id: "visual-memory",
        title: "视觉记忆文档",
        agentId: "research_agent",
        model: "gemini-3.6-flash-high",
        status: "complete",
        messages: [
          {
            id: "memory-tool",
            kind: "tool",
            content: "Reviewed visual memory",
            meta: "8 runtime captures",
          },
          {
            id: "memory-assistant",
            kind: "assistant",
            content:
              "视觉记忆已作为设计 token、玻璃焦点和布局常量的基线；当前界面在此基础上升级为 Agent 构建工作台。",
          },
        ],
      },
    ],
  },
];

export function findWorkspaceSession(sessionId: string): WorkspaceSession {
  for (const project of workspaceProjects) {
    const session = project.sessions.find((item) => item.id === sessionId);
    if (session) return session;
  }
  return workspaceProjects[0].sessions[0];
}
