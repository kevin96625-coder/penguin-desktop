import { request } from "../client";
import type { SkillLibraryResponse } from "../types";

/**
 * Two different surfaces:
 *  - `GET /api/skills` is the global library (mounted outside any Project prefix — readable
 *    once logged in) and answers `{groups: [{id, title, titleZh?, skills}]}`.
 *  - The per-agent routes install/uninstall by name. POST takes `{names: string[]}` and
 *    returns the agent's resulting skill list (201), so callers don't need a refetch —
 *    but DELETE answers **204 No Content**, so it returns nothing and the caller must
 *    update its own state. The two verbs are deliberately NOT symmetric here; typing
 *    DELETE as if it echoed the list makes `res.skills` throw at runtime.
 * Shared by the Skills library page and Settings' Skills section.
 */
const enc = encodeURIComponent;

export interface AgentSkillsResponse {
  skills: SkillLibraryResponse["groups"][number]["skills"];
}

const agentBase = (projectId: string, agentId: string) =>
  `/api/projects/${enc(projectId)}/agents/${enc(agentId)}/skills`;

export function listSkillLibrary(): Promise<SkillLibraryResponse> {
  return request<SkillLibraryResponse>("/api/skills");
}

export function listAgentSkills(
  projectId: string,
  agentId: string,
): Promise<AgentSkillsResponse> {
  return request<AgentSkillsResponse>(agentBase(projectId, agentId));
}

/** Install is all-or-nothing server-side: an unknown name 404s the whole request. */
export function installSkills(
  projectId: string,
  agentId: string,
  names: string[],
): Promise<AgentSkillsResponse> {
  return request<AgentSkillsResponse>(agentBase(projectId, agentId), {
    method: "POST",
    body: { names },
  });
}

/** 204 No Content — resolves to nothing; the caller drops the name from its own state. */
export function uninstallSkill(
  projectId: string,
  agentId: string,
  name: string,
): Promise<void> {
  return request<void>(`${agentBase(projectId, agentId)}/${enc(name)}`, {
    method: "DELETE",
  });
}
