import { request } from "../client";
import type { UsageErrorItem, UsageResponse } from "../types";

/**
 * Usage / cost statistics. Both routes are GET-only aggregates read out of the server's
 * usage + error tables, so nothing here writes.
 *
 * The dashboard response already carries the first page of the error detail table
 * (`errors.recent`, 20 rows); `/usage/errors` exists so "show me earlier ones" does not
 * have to refetch the whole aggregate.
 */
const enc = encodeURIComponent;

const base = (projectId: string) => `/api/projects/${enc(projectId)}/usage`;

/**
 * Grouping dimension accepted by the server (`groupBy` query param). Mirrors the vendor's
 * `UsageGroupBy`, derived from the response DTO rather than re-declared, so a server-side
 * change surfaces as a type error here instead of a 400 at runtime.
 */
export type UsageGroupBy = UsageResponse["groupBy"];

export const USAGE_GROUP_BYS = [
  "date",
  "agent",
  "model",
  "session",
] as const satisfies readonly UsageGroupBy[];

export interface UsageQuery {
  /** ISO date/timestamp bounds, inclusive on the server side. */
  from?: string;
  to?: string;
  groupBy?: UsageGroupBy;
  agentId?: string;
  /** The model filter is paired: send `provider` and `modelId` together or not at all. */
  provider?: string;
  modelId?: string;
}

export interface UsageErrorsQuery {
  offset?: number;
  limit?: number;
  from?: string;
  to?: string;
  agentId?: string;
}

/**
 * `/usage/errors` payload. The vendor calls this `UsageErrorsPage`; it is not re-exported
 * from `src/api/types.ts` (that file is owned elsewhere), so it is spelled out structurally
 * on top of the `UsageErrorItem` DTO that is re-exported.
 */
export interface UsageErrorsPage {
  items: UsageErrorItem[];
  /** Filtered row count, so the caller knows when it has reached the end. */
  total: number;
}

/** Serializes only the params that were actually provided; empty strings are dropped too. */
function queryString(params: Record<string, string | number | undefined>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    parts.push(`${enc(key)}=${enc(String(value))}`);
  }
  return parts.length > 0 ? `?${parts.join("&")}` : "";
}

export function getUsage(
  projectId: string,
  query: UsageQuery = {},
): Promise<UsageResponse> {
  return request<UsageResponse>(`${base(projectId)}${queryString({ ...query })}`);
}

export function getUsageErrors(
  projectId: string,
  query: UsageErrorsQuery = {},
): Promise<UsageErrorsPage> {
  return request<UsageErrorsPage>(
    `${base(projectId)}/errors${queryString({ ...query })}`,
  );
}
