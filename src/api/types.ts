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
} from "@penguin-api";
