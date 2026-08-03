import { request } from "../client";
import type { AuthResponse, MeResponse } from "../types";

export function login(userId: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: { userId, password },
  });
}

export function logout(): Promise<void> {
  return request<void>("/api/auth/logout", { method: "POST" });
}

export function me(): Promise<MeResponse> {
  return request<MeResponse>("/api/me");
}
