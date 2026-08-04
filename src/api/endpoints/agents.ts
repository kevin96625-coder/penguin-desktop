import { request } from "../client";
import type {
  AgentConfigResponse,
  AgentConfigUpdateRequest,
  ScheduleItem,
  SchedulesResponse,
  ScheduleUpsertRequest,
  VaultResponse,
  VaultUpdateRequest,
} from "../types";

/**
 * Agent-scoped configuration surfaces, all hanging off
 * `/api/projects/:projectId/agents/:agentId`:
 *
 *   - config   — system_config.yaml + AGENTS.md (GET / PUT / POST reset). All three verbs
 *                answer the same `AgentConfigResponse`, so a write never needs a refetch.
 *   - vault    — agent_state/.vault.toml env vars. Values come back MASKED only; the
 *                plaintext is never sent to the client.
 *   - schedules— agent_state/schedule/*.toml, one file per entry, `name` is the identity.
 *
 * Consumed by the Settings page. Everything goes through the shared `request` so the 401
 * broadcast and the `{error:{code,message}}` envelope stay in one place.
 */
const enc = encodeURIComponent;

const agentBase = (projectId: string, agentId: string) =>
  `/api/projects/${enc(projectId)}/agents/${enc(agentId)}`;

/* -------------------------------------------------------------------------- */
/* Agent config                                                               */
/* -------------------------------------------------------------------------- */

export function getAgentConfig(
  projectId: string,
  agentId: string,
): Promise<AgentConfigResponse> {
  return request<AgentConfigResponse>(`${agentBase(projectId, agentId)}/config`);
}

/**
 * Partial update: only the keys present in `config` are touched — the rest of the YAML
 * (including its comments) is preserved server-side. `agentsMd`, when present, overwrites
 * the whole AGENTS.md file.
 */
export function updateAgentConfig(
  projectId: string,
  agentId: string,
  body: AgentConfigUpdateRequest,
): Promise<AgentConfigResponse> {
  return request<AgentConfigResponse>(`${agentBase(projectId, agentId)}/config`, {
    method: "PUT",
    body,
  });
}

/**
 * Overwrite system_config.yaml with the harness defaults, keeping only
 * name / description / version. Destructive — always confirm first.
 */
export function resetAgentConfig(
  projectId: string,
  agentId: string,
): Promise<AgentConfigResponse> {
  return request<AgentConfigResponse>(`${agentBase(projectId, agentId)}/config/reset`, {
    method: "POST",
  });
}

/* -------------------------------------------------------------------------- */
/* Vault                                                                      */
/* -------------------------------------------------------------------------- */

export function getVault(projectId: string, agentId: string): Promise<VaultResponse> {
  return request<VaultResponse>(`${agentBase(projectId, agentId)}/vault`);
}

/**
 * FULL-TABLE REPLACE: keys absent from `entries` are deleted. Callers must send the
 * complete key list every time — see `putVaultMerged` below, which is the only form the
 * UI uses.
 *
 * Per entry: omitting `value` keeps the stored plaintext (required, since GET only ever
 * returns a mask); providing a non-empty `value` overwrites it.
 */
export function updateVault(
  projectId: string,
  agentId: string,
  body: VaultUpdateRequest,
): Promise<VaultResponse> {
  return request<VaultResponse>(`${agentBase(projectId, agentId)}/vault`, {
    method: "PUT",
    body,
  });
}

/**
 * Safe wrapper around the full-table replace: re-reads the current key list, applies one
 * upsert or delete on top of it, and PUTs the whole table back. Entries other than the
 * touched one are sent key-only, so their stored values survive untouched.
 */
export async function putVaultMerged(
  projectId: string,
  agentId: string,
  change: { key: string; value?: string; remove?: boolean },
): Promise<VaultResponse> {
  const current = await getVault(projectId, agentId);
  const entries: VaultUpdateRequest["entries"] = [];
  let matched = false;
  for (const entry of current.entries) {
    if (entry.key === change.key) {
      matched = true;
      if (change.remove) continue; // dropped from the table == deleted
      entries.push(
        change.value ? { key: entry.key, value: change.value } : { key: entry.key },
      );
      continue;
    }
    // Untouched key: no `value` == keep whatever is stored.
    entries.push({ key: entry.key });
  }
  if (!matched && !change.remove) {
    // New key — the server requires a value for one it has never seen.
    entries.push({ key: change.key, value: change.value ?? "" });
  }
  return updateVault(projectId, agentId, { entries });
}

/* -------------------------------------------------------------------------- */
/* Schedules                                                                  */
/* -------------------------------------------------------------------------- */

const schedulesBase = (projectId: string, agentId: string) =>
  `${agentBase(projectId, agentId)}/schedules`;

export function listSchedules(
  projectId: string,
  agentId: string,
): Promise<SchedulesResponse> {
  return request<SchedulesResponse>(schedulesBase(projectId, agentId));
}

export function getSchedule(
  projectId: string,
  agentId: string,
  name: string,
): Promise<ScheduleItem> {
  return request<ScheduleItem>(`${schedulesBase(projectId, agentId)}/${enc(name)}`);
}

/**
 * Create: `name` travels in the BODY (it becomes the .toml filename), not in the path —
 * the path form is reserved for updates. 409 when the name already exists.
 */
export function createSchedule(
  projectId: string,
  agentId: string,
  name: string,
  body: ScheduleUpsertRequest,
): Promise<ScheduleItem> {
  return request<ScheduleItem>(schedulesBase(projectId, agentId), {
    method: "POST",
    body: { name, ...body },
  });
}

/** Update rewrites the whole file — send every field you want to keep. */
export function updateSchedule(
  projectId: string,
  agentId: string,
  name: string,
  body: ScheduleUpsertRequest,
): Promise<ScheduleItem> {
  return request<ScheduleItem>(`${schedulesBase(projectId, agentId)}/${enc(name)}`, {
    method: "PUT",
    body,
  });
}

/** 204 on success; the shared client resolves that to undefined. */
export function deleteSchedule(
  projectId: string,
  agentId: string,
  name: string,
): Promise<void> {
  return request<void>(`${schedulesBase(projectId, agentId)}/${enc(name)}`, {
    method: "DELETE",
  });
}
