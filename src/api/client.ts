import type { ErrorBody } from "./types";

/** Error thrown for any non-2xx API response, carrying the server's error envelope. */
export class ApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

export interface RequestInitJson extends Omit<RequestInit, "body"> {
  /** Plain value to be JSON-stringified into the request body. */
  body?: unknown;
}

/**
 * Single fetch exit point for the whole app.
 *
 * - Relative paths only (same origin; the Vite dev proxy forwards /api to the server).
 * - Writes get `Content-Type: application/json` and a stringified body automatically.
 * - Non-2xx responses are parsed as `{error:{code,message}}` and thrown as ApiError
 *   (falling back to the HTTP status text when the body is not that envelope).
 * - 401 broadcasts `penguin:unauthorized` on window before throwing, so the router can
 *   redirect to /login from a single listener.
 * - 204 resolves to undefined.
 */
export async function request<T>(path: string, init?: RequestInitJson): Promise<T> {
  const { body, headers, ...rest } = init ?? {};
  const res = await fetch(path, {
    ...rest,
    headers:
      body !== undefined
        ? { "Content-Type": "application/json", ...headers }
        : headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    let code = "http_error";
    let message = `${res.status} ${res.statusText}`;
    try {
      const parsed = (await res.json()) as ErrorBody;
      if (parsed?.error?.code) {
        code = parsed.error.code;
        message = parsed.error.message ?? message;
      }
    } catch {
      // Body was not the error envelope; keep the status-text fallback.
    }
    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent("penguin:unauthorized"));
    }
    throw new ApiError(code, message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/**
 * Same request pipeline, but the body is read as text.
 *
 * Not every endpoint answers JSON: benchmark case files and trace downloads stream raw
 * bytes with their own Content-Type, so `res.json()` would throw on them. Errors still go
 * through the JSON envelope, since the server always errors in JSON.
 */
export async function requestText(
  path: string,
  init?: RequestInitJson,
): Promise<{ text: string; truncated: boolean }> {
  const { body, headers, ...rest } = init ?? {};
  const res = await fetch(path, {
    ...rest,
    headers:
      body !== undefined
        ? { "Content-Type": "application/json", ...headers }
        : headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    let code = "http_error";
    let message = `${res.status} ${res.statusText}`;
    try {
      const parsed = (await res.json()) as ErrorBody;
      if (parsed?.error?.code) {
        code = parsed.error.code;
        message = parsed.error.message ?? message;
      }
    } catch {
      // Not the error envelope; keep the status-text fallback.
    }
    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent("penguin:unauthorized"));
    }
    throw new ApiError(code, message, res.status);
  }

  return {
    text: await res.text(),
    truncated: res.headers.get("X-Content-Truncated") === "1",
  };
}
