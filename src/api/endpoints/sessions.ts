import { request } from "../client";
import type {
  AgentsResponse,
  ApprovalMode,
  MessagesResponse,
  ProjectsResponse,
  SessionCreateResponse,
  SessionResponse,
  SessionsResponse,
  TaskCreateResponse,
  TaskInputPart,
} from "../types";

const enc = encodeURIComponent;

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
    `/api/projects/${enc(projectId)}/agents/${enc(agentId)}/sessions`,
  );
}

// --- session lifecycle -----------------------------------------------------

/** 201; the session nests under a `session` key. Omitting the model pair uses the Project default. */
export function createSession(
  projectId: string,
  agentId: string,
  body: { approvalMode?: ApprovalMode } = {},
): Promise<SessionCreateResponse> {
  return request<SessionCreateResponse>(
    `/api/projects/${enc(projectId)}/agents/${enc(agentId)}/sessions`,
    { method: "POST", body },
  );
}

/** Changes the live approval mode — how "allow for the rest of this session" is implemented. */
export function patchSession(
  sessionId: string,
  body: { approvalMode?: ApprovalMode; archived?: boolean; title?: string },
): Promise<SessionResponse> {
  return request<SessionResponse>(`/api/sessions/${enc(sessionId)}`, {
    method: "PATCH",
    body,
  });
}

/**
 * History plus, while the session is running, the in-progress `live` tail
 * (`{cursor, fragments}`) that lets a client joining mid-stream rebuild the message
 * currently being streamed — partial_* messages never reach the Trace.
 */
export function getMessages(sessionId: string): Promise<MessagesResponse> {
  return request<MessagesResponse>(`/api/sessions/${enc(sessionId)}/messages`);
}

// --- task run --------------------------------------------------------------

/** 202. Input parts are `{type:"text"|"image_url"|"file"}` — not a model_msg wrapper. */
export function postTask(
  sessionId: string,
  input: TaskInputPart[],
  opts: { queueIfBusy?: boolean } = {},
): Promise<TaskCreateResponse> {
  return request<TaskCreateResponse>(`/api/sessions/${enc(sessionId)}/tasks`, {
    method: "POST",
    body: { input, ...opts },
  });
}

export function postApproval(
  sessionId: string,
  toolCallId: string,
  decision: "allow" | "deny",
): Promise<void> {
  return request<void>(
    `/api/sessions/${enc(sessionId)}/approvals/${enc(toolCallId)}`,
    { method: "POST", body: { decision } },
  );
}

export function abortSession(sessionId: string): Promise<void> {
  return request<void>(`/api/sessions/${enc(sessionId)}/abort`, { method: "POST" });
}
