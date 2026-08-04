import { request, requestText } from "../client";
import type {
  AgentTracesResponse,
  TraceAnalysisResponse,
  TraceEventsResponse,
} from "../types";

/**
 * Agent Trace browsing. Read-only over HTTP for us: the server also exposes
 * POST /traces/import, but the desktop deliberately does not surface it — traces are an
 * audit record, the UI only browses, reads and downloads them.
 *
 * The list is a drill-down (date -> session -> file index), not a flat list, and carries no
 * model/duration: those are derived per file by the `analysis` endpoint.
 */
const enc = encodeURIComponent;

const base = (projectId: string, agentId: string) =>
  `/api/projects/${enc(projectId)}/agents/${enc(agentId)}/traces`;

const file = (projectId: string, agentId: string, sessionId: string, index: number) =>
  `${base(projectId, agentId)}/${enc(sessionId)}/${enc(String(index))}`;

/** Agent -> date -> Session -> file index tree (server returns it reverse-chronological). */
export function listAgentTraces(
  projectId: string,
  agentId: string,
): Promise<AgentTracesResponse> {
  return request<AgentTracesResponse>(base(projectId, agentId));
}

/**
 * One Trace file's OmniMessage records. Paginated by line: `offset`/`limit` slice the file
 * (server default limit is 200, max 1000) and `total` reports the full line count.
 */
export function readTraceEvents(
  projectId: string,
  agentId: string,
  sessionId: string,
  index: number,
  offset = 0,
  limit = 500,
): Promise<TraceEventsResponse> {
  const q = `?offset=${enc(String(offset))}&limit=${enc(String(limit))}`;
  return request<TraceEventsResponse>(
    `${file(projectId, agentId, sessionId, index)}${q}`,
  );
}

/**
 * Server-side analysis of the whole file (durations, per-task tokens, tool spans).
 * Computed over the entire file, unlike the paginated events above, so it is the only
 * trustworthy source for aggregate figures.
 */
export function readTraceAnalysis(
  projectId: string,
  agentId: string,
  sessionId: string,
  index: number,
): Promise<TraceAnalysisResponse> {
  return request<TraceAnalysisResponse>(
    `${file(projectId, agentId, sessionId, index)}/analysis`,
  );
}

/**
 * Raw .jsonl body. The route streams application/x-ndjson as an attachment rather than
 * JSON, so it goes through requestText; the caller turns the text into a Blob download
 * (no bare fetch, no anchor to the API URL, which would drop the session cookie handling
 * this client centralizes).
 */
export function downloadTraceFile(
  projectId: string,
  agentId: string,
  sessionId: string,
  index: number,
): Promise<{ text: string; truncated: boolean }> {
  return requestText(`${file(projectId, agentId, sessionId, index)}/download`);
}

/** Server-side download filename convention (sessionId_001.jsonl). */
export function traceFileName(sessionId: string, index: number): string {
  return `${sessionId}_${String(index).padStart(3, "0")}.jsonl`;
}
