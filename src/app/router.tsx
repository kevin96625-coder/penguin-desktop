import { useEffect, useState, type ReactNode } from "react";
import { BrowserRouter, Route, Routes, useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { me } from "../api/endpoints/auth";
import LoginPage from "../features/auth/LoginPage";
import OverviewPage from "../features/overview/OverviewPage";
import SessionsPage from "../features/sessions/SessionsPage";
import ChatWorkspace from "../features/workspace/ChatWorkspace";
import WorkspaceEmptyPage from "../features/workspace/WorkspaceEmptyPage";
import AppShell from "./AppShell";

/** Global 401 handling: any request that hits 401 broadcasts this event (see client.ts). */
function UnauthorizedListener() {
  const navigate = useNavigate();
  useEffect(() => {
    const onUnauthorized = () => navigate("/login", { replace: true });
    window.addEventListener("penguin:unauthorized", onUnauthorized);
    return () => window.removeEventListener("penguin:unauthorized", onUnauthorized);
  }, [navigate]);
  return null;
}

/** Gate: probe /api/me on mount; 401 redirects to /login before rendering children. */
function Protected({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    let cancelled = false;
    me()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          navigate("/login", { replace: true });
        } else {
          // Non-auth failure: render the page and let it surface its own errors.
          setReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);
  if (!ready)
    return <p className="p-8 text-sm text-muted-foreground">加载中…</p>;
  return <>{children}</>;
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <UnauthorizedListener />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <Protected>
              <AppShell />
            </Protected>
          }
        >
          <Route path="/" element={<ChatWorkspace />} />
          <Route path="/overview" element={<OverviewPage />} />
          <Route path="/evaluations" element={<WorkspaceEmptyPage kind="evaluations" />} />
          <Route path="/runs" element={<WorkspaceEmptyPage kind="runs" />} />
          <Route path="/sessions" element={<SessionsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
