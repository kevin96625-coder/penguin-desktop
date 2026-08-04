import { request } from "../client";
import type { AgentSummary, ProjectSummary } from "../types";

/**
 * First-run endpoints. Kept separate from the feature-page endpoint files because these
 * are only reachable from the onboarding gate.
 *
 * Note both create calls REQUIRE an explicit id: it names the on-disk directory and the
 * server does not generate one.
 */
const enc = encodeURIComponent;

/** 204 on success; the old password stops working immediately. */
export function changePassword(
  oldPassword: string,
  newPassword: string,
): Promise<void> {
  return request<void>("/api/me/password", {
    method: "PUT",
    body: { oldPassword, newPassword },
  });
}

export function createProject(
  projectId: string,
  name?: string,
): Promise<{ project: ProjectSummary }> {
  return request<{ project: ProjectSummary }>("/api/projects", {
    method: "POST",
    body: { projectId, ...(name ? { name } : {}) },
  });
}

export function createAgent(
  projectId: string,
  agentId: string,
  name?: string,
): Promise<{ agent: AgentSummary }> {
  return request<{ agent: AgentSummary }>(
    `/api/projects/${enc(projectId)}/agents`,
    { method: "POST", body: { agentId, ...(name ? { name } : {}) } },
  );
}
