import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ApiError } from "../../api/client";
import { me } from "../../api/endpoints/auth";
import {
  changePassword,
  createAgent,
  createProject,
} from "../../api/endpoints/onboarding";
import { addCustomModel, getModels, testModel } from "../../api/endpoints/models";
import { listAgents, listProjects } from "../../api/endpoints/sessions";
import {
  BrandMark,
  Button,
  GlassCard,
  Input,
  StatusBadge,
} from "../../design-system/components";

/**
 * First-run gate. Rendered instead of the workspace until the install is actually usable.
 *
 * What the checks are, and why they are NOT what you might expect:
 *  - Password: `passwordIsInitial` on /api/me. Real — a fresh install always seeds
 *    admin/penguin-2026.
 *  - Workspace: an empty project list is NOT a fresh-install signal. The server runs
 *    `provisionInitialProject` at signup, so the admin always already has
 *    `default_project` + `default_agent`. This step therefore *adopts* what exists and
 *    only offers creation in the genuinely-empty case (a deleted project, or a
 *    non-admin user).
 *  - Provider: this is the real gate. A fresh install ships 77 preset models and ZERO
 *    stored keys, so the first task dies with `model_credential_missing`. Until a
 *    credential exists the app cannot do its one job.
 */

type StepId = "password" | "workspace" | "provider";

interface StepState {
  needed: boolean;
  done: boolean;
}

const STEP_LABEL: Record<StepId, string> = {
  password: "修改初始密码",
  workspace: "工作区",
  provider: "模型 Provider",
};

function StepRail({
  order,
  current,
  state,
}: {
  order: StepId[];
  current: StepId | null;
  state: Record<StepId, StepState>;
}) {
  return (
    <ol className="mb-6 flex items-center gap-2">
      {order.map((id, i) => {
        const s = state[id];
        const active = current === id;
        return (
          <li key={id} className="flex items-center gap-2">
            <StatusBadge status={s.done ? "complete" : active ? "running" : "queued"}>
              {i + 1}. {STEP_LABEL[id]}
            </StatusBadge>
            {i < order.length - 1 && (
              <span aria-hidden className="h-px w-4 bg-border" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mt-3 flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export default function OnboardingFlow({ onDone }: { onDone: () => void }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<Record<StepId, StepState>>({
    password: { needed: false, done: false },
    workspace: { needed: false, done: false },
    provider: { needed: false, done: false },
  });
  const [projectId, setProjectId] = useState<string | null>(null);
  const [agentId, setAgentId] = useState<string | null>(null);

  // password step
  const [oldPw, setOldPw] = useState("penguin-2026");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  // workspace step
  const [newProjectId, setNewProjectId] = useState("my_project");
  const [newAgentId, setNewAgentId] = useState("my_agent");
  // provider step
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [modelId, setModelId] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);

  const probe = useCallback(async () => {
    const [user, projects] = await Promise.all([me(), listProjects()]);
    const passwordNeeded = user.user.passwordIsInitial === true;

    const first = projects.projects[0] ?? null;
    let pid = first?.projectId ?? null;
    let aid: string | null = null;
    if (pid) {
      const agents = await listAgents(pid);
      aid = agents.agents[0]?.agentId ?? null;
    }
    const workspaceNeeded = pid === null || aid === null;

    // A usable provider = at least one entry with a stored key. `envKey` alone is a
    // catalog hint, not a credential, so it does not count.
    let providerNeeded = true;
    if (pid) {
      const models = await getModels(pid);
      providerNeeded = !models.models.some((m) => m.credential?.apiKeyMasked);
    }

    setProjectId(pid);
    setAgentId(aid);
    setState({
      password: { needed: passwordNeeded, done: !passwordNeeded },
      workspace: { needed: workspaceNeeded, done: !workspaceNeeded },
      provider: { needed: providerNeeded, done: !providerNeeded },
    });
    setReady(true);
    return { passwordNeeded, workspaceNeeded, providerNeeded };
  }, []);

  useEffect(() => {
    probe().catch((err) => {
      setError(err instanceof ApiError ? err.message : String(err));
      setReady(true);
    });
  }, [probe]);

  const order: StepId[] = ["password", "workspace", "provider"];
  const current = order.find((id) => !state[id].done) ?? null;

  // Everything satisfied -> hand control back to the shell.
  useEffect(() => {
    if (ready && current === null && !error) onDone();
  }, [ready, current, error, onDone]);

  async function submitPassword() {
    if (newPw.length < 8) return setError("新密码至少 8 位");
    if (newPw !== confirmPw) return setError("两次输入的新密码不一致");
    setBusy(true);
    setError(null);
    try {
      await changePassword(oldPw, newPw);
      setState((s) => ({ ...s, password: { needed: true, done: true } }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function submitWorkspace() {
    setBusy(true);
    setError(null);
    try {
      let pid = projectId;
      if (!pid) {
        const res = await createProject(newProjectId, newProjectId);
        pid = res.project.projectId;
        setProjectId(pid);
      }
      let aid = agentId;
      if (!aid) {
        const res = await createAgent(pid, newAgentId, newAgentId);
        aid = res.agent.agentId;
        setAgentId(aid);
      }
      setState((s) => ({ ...s, workspace: { needed: true, done: true } }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function submitProvider(runTestOnly: boolean) {
    if (!projectId) return setError("尚未确定 Project");
    if (!baseUrl.trim() || !apiKey.trim() || !modelId.trim()) {
      return setError("base_url、api_key、model_id 都必须填写");
    }
    setBusy(true);
    setError(null);
    setTestResult(null);
    try {
      // The entry has to exist before /models/test can resolve its credential, so save
      // first in both paths; "仅测试" simply stops after reporting.
      await addCustomModel(
        projectId,
        {
          provider: "custom",
          modelId: modelId.trim(),
          displayName: modelId.trim(),
          baseUrl: baseUrl.trim(),
          apiKey: apiKey.trim(),
          clientType: "openai",
        },
        { makeDefault: true },
      );
      const res = await testModel(projectId, {
        provider: "custom",
        modelId: modelId.trim(),
      });
      if (res.ok) {
        setTestResult(`连接成功${res.latencyMs ? ` · ${res.latencyMs}ms` : ""}`);
        if (!runTestOnly) {
          setState((s) => ({ ...s, provider: { needed: true, done: true } }));
        }
      } else {
        setTestResult(null);
        setError(res.message ?? "连接测试失败");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">检查安装状态…</p>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-background text-foreground">
      <div data-tauri-drag-region className="h-[38px] shrink-0" />
      <div className="flex flex-1 items-start justify-center overflow-y-auto px-6 pb-10 pt-6">
        <GlassCard variant="focus" className="animate-section-in w-full max-w-[520px] p-7">
          <BrandMark size="lg" decorative={false} />
          <p className="mt-4 font-mono text-[10px] font-medium tracking-[0.12em] text-muted-foreground/70">
            FIRST RUN SETUP
          </p>
          <h1 className="mt-1 text-base font-semibold tracking-tight">初次使用设置</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            完成这几步后即可开始对话。
          </p>

          <div className="mt-5">
            <StepRail order={order} current={current} state={state} />
          </div>

          {error && (
            <p className="mb-3 rounded-lg border border-[hsl(var(--chat-error))]/40 px-3 py-2 text-xs text-[hsl(var(--chat-error))]">
              {error}
            </p>
          )}

          {current === "password" && (
            <section>
              <h2 className="text-[13px] font-semibold">修改初始密码</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                当前仍在使用内置初始密码，请先改掉。
              </p>
              <Row label="当前密码">
                <Input type="password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} />
              </Row>
              <Row label="新密码（至少 8 位）">
                <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
              </Row>
              <Row label="确认新密码">
                <Input
                  type="password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                />
              </Row>
              <Button className="mt-5 w-full" disabled={busy} onClick={() => void submitPassword()}>
                {busy ? "提交中…" : "修改密码"}
              </Button>
            </section>
          )}

          {current === "workspace" && (
            <section>
              <h2 className="text-[13px] font-semibold">工作区</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {projectId && agentId
                  ? "已检测到可用的 Project 与 Agent。"
                  : "没有可用的 Project 或 Agent，创建一个。"}
              </p>
              {!projectId && (
                <Row label="Project ID（同时是磁盘目录名）">
                  <Input
                    value={newProjectId}
                    onChange={(e) => setNewProjectId(e.target.value)}
                  />
                </Row>
              )}
              {!agentId && (
                <Row label="Agent ID">
                  <Input value={newAgentId} onChange={(e) => setNewAgentId(e.target.value)} />
                </Row>
              )}
              {projectId && agentId && (
                <p className="mt-3 font-mono text-[11px] text-muted-foreground">
                  {projectId} / {agentId}
                </p>
              )}
              <Button className="mt-5 w-full" disabled={busy} onClick={() => void submitWorkspace()}>
                {busy ? "处理中…" : projectId && agentId ? "使用它继续" : "创建并继续"}
              </Button>
            </section>
          )}

          {current === "provider" && (
            <section>
              <h2 className="text-[13px] font-semibold">配置模型 Provider</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                内置模型表没有任何密钥，先填一个 OpenAI 兼容端点才能开始对话。
              </p>
              <Row label="base_url">
                <Input
                  value={baseUrl}
                  placeholder="http://localhost:8317/v1"
                  onChange={(e) => setBaseUrl(e.target.value)}
                />
              </Row>
              <Row label="api_key">
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </Row>
              <Row label="model_id">
                <Input
                  value={modelId}
                  placeholder="gpt-4o-mini"
                  onChange={(e) => setModelId(e.target.value)}
                />
              </Row>
              {testResult && (
                <p className="mt-3 text-xs text-[hsl(var(--chat-success))]">{testResult}</p>
              )}
              <div className="mt-5 flex gap-2">
                <Button
                  variant="ghost"
                  className="flex-1"
                  disabled={busy}
                  onClick={() => void submitProvider(true)}
                >
                  仅测试连接
                </Button>
                <Button
                  className="flex-1"
                  disabled={busy}
                  onClick={() => void submitProvider(false)}
                >
                  {busy ? "保存中…" : "保存并完成"}
                </Button>
              </div>
            </section>
          )}
        </GlassCard>
      </div>
    </main>
  );
}
