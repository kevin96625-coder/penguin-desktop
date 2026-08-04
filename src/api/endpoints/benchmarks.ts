import { request, requestText } from "../client";
import type {
  BenchmarkCasesResponse,
  BenchmarksResponse,
  WorkspaceFilesResponse,
} from "../types";

/**
 * Benchmarks are read-only over HTTP: the routes are GET-only (the content is produced by
 * the benchmark_builder skill on disk, the server only reads it). Shared by the Dashboard
 * and the Benchmarks browser, so it lives in the shared endpoint layer.
 */
const enc = encodeURIComponent;

const base = (projectId: string, agentId: string) =>
  `/api/projects/${enc(projectId)}/agents/${enc(agentId)}/benchmarks`;

export function listBenchmarks(
  projectId: string,
  agentId: string,
): Promise<BenchmarksResponse> {
  return request<BenchmarksResponse>(base(projectId, agentId));
}

export function listBenchmarkCases(
  projectId: string,
  agentId: string,
  benchmarkId: string,
): Promise<BenchmarkCasesResponse> {
  return request<BenchmarkCasesResponse>(
    `${base(projectId, agentId)}/${enc(benchmarkId)}/cases`,
  );
}

/** `kind` picks the public statement/ or the private rubric/ tree of one case. */
export function listCaseFiles(
  projectId: string,
  agentId: string,
  benchmarkId: string,
  caseId: string,
  kind: "statement" | "rubric",
): Promise<WorkspaceFilesResponse> {
  const suffix = kind === "statement" ? "files" : "rubric/files";
  return request<WorkspaceFilesResponse>(
    `${base(projectId, agentId)}/${enc(benchmarkId)}/cases/${enc(caseId)}/${suffix}`,
  );
}

/**
 * Case file body. This endpoint streams the raw file with its own Content-Type (not JSON),
 * so it goes through requestText; `preview=1` asks the server to bound the read and sets
 * `X-Content-Truncated` when it clipped.
 */
export function readCaseFile(
  projectId: string,
  agentId: string,
  benchmarkId: string,
  caseId: string,
  kind: "statement" | "rubric",
  path: string,
): Promise<{ text: string; truncated: boolean }> {
  const suffix = kind === "statement" ? "files/content" : "rubric/files/content";
  return requestText(
    `${base(projectId, agentId)}/${enc(benchmarkId)}/cases/${enc(caseId)}/${suffix}?path=${enc(path)}&preview=1`,
  );
}
