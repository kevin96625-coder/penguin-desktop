/**
 * DTO type channel: the only file allowed to reference the vendored penguin-harness
 * types. Pages and the api-client import DTOs from here (`src/api/`), never from the
 * vendor path directly. All re-exports are type-only so the bundler can erase them.
 */
export type {
  ErrorBody,
  UserInfo,
  AuthLoginRequest,
  AuthResponse,
  MeResponse,
  SessionStatus,
  SessionInfo,
  SessionsResponse,
  ProjectSummary,
  ProjectsResponse,
  AgentSummary,
  AgentsResponse,
  // --- chat (stage 4a) ---
  ApprovalMode,
  ApprovalDecisionRequest,
  MessagesResponse,
  MessagesLiveTail,
  SessionCreateRequest,
  SessionCreateResponse,
  SessionPatchRequest,
  SessionResponse,
  ServerEvent,
  TaskCreateRequest,
  TaskCreateResponse,
  TaskInputPart,
} from "@penguin-api";

/**
 * OmniMessage is core's protocol rather than a server DTO, so it comes through the core
 * subpath alias. On the wire it arrives on the SSE *default* event (no `event:` line);
 * `ServerEvent` arrives on the named `server_event` event — see api/sse.ts.
 */
export type {
  OmniMessage,
  OmniPayload,
  ModelPayload,
  CompleteModelPayload,
  PartialModelPayload,
  EventPayload,
  ToolCallPayload,
  StopReason,
  TokenCounts,
} from "@prismshadow/penguin-core/omnimessage";
