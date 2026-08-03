import { request } from "../client";
import type { AgentsResponse, ProjectsResponse, SessionsResponse } from "../types";

/**
 * The server has no global session list: sessions hang off an Agent
 * (GET /api/projects/:p/agents/:a/sessions returning `{sessions, counts?, workspaceCounts?}`;
 * `/api/sessions` only hosts session-level `/:sessionId/*` routes). The list page therefore
 * walks projects -> agents -> sessions.
 */
export function listProjects(): Promise<ProjectsResponse> {
  return request<ProjectsResponse>("/api/projects");
}

export function listAgents(projectId: string): Promise<AgentsResponse> {
  return request<AgentsResponse>(
    `/api/projects/${encodeURIComponent(projectId)}/agents`,
  );
}

export function listSessions(
  projectId: string,
  agentId: string,
): Promise<SessionsResponse> {
  return request<SessionsResponse>(
    `/api/projects/${encodeURIComponent(projectId)}/agents/${encodeURIComponent(agentId)}/sessions`,
  );
}
