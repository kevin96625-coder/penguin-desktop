import { useEffect, useState } from "react";
import {
  getAgentConfig,
  resetAgentConfig,
  updateAgentConfig,
} from "../../api/endpoints/agents";
import type { AgentConfigDto, AgentConfigResponse } from "../../api/types";
import { Button, Dialog } from "../../design-system/components";
import { ErrorNote, Loading, Meta, OkNote, Panel, useResource, errText } from "./common";

/** `ToolDefinitionConfig` is not re-exported from api/types — derive it structurally. */
type ToolDef = AgentConfigDto["toolsBuiltin"][number];

const permissionLabel: Record<string, string> = {
  r: "只读",
  rw: "读写",
};

function ToolRow({ tool }: { tool: ToolDef }) {
  const permission = tool.permission ? permissionLabel[tool.permission] : null;
  return (
    <li className="flex items-start gap-3 px-3 py-2">
      <span className="min-w-0 flex-1">
        <span className="block truncate font-mono text-[12px] font-medium text-foreground/90">
          {tool.name}
        </span>
        <span className="mt-0.5 block line-clamp-2 text-[11px] leading-4 text-muted-foreground">
          {tool.description}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5 pt-0.5">
        {tool.forModel && (
          <span className="rounded border border-border/60 px-1.5 py-px font-mono text-[10px] text-muted-foreground">
            {tool.forModel}
          </span>
        )}
        {permission && (
          <span className="rounded border border-border/60 px-1.5 py-px text-[10px] text-muted-foreground">
            {permission}
          </span>
        )}
      </span>
    </li>
  );
}

/**
 * Agent Config: the system prompt is edited in a PLAIN textarea (no rich-text editor —
 * the value is written verbatim into system_config.yaml), the built-in tool table is
 * read-only, and Reset is gated behind a confirmation Dialog because it overwrites the
 * whole YAML with the harness defaults.
 */
export default function AgentConfigSection({
  projectId,
  agentId,
}: {
  projectId: string;
  agentId: string;
}) {
  const key = `${projectId}/${agentId}`;
  const res = useResource<AgentConfigResponse>(key, () =>
    getAgentConfig(projectId, agentId),
  );

  const [prompt, setPrompt] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Adopt the server value whenever a fresh config lands (initial load, save, reset).
  useEffect(() => {
    if (res.data) setPrompt(res.data.config.systemPrompt);
  }, [res.data]);

  const dirty = res.data !== null && prompt !== res.data.config.systemPrompt;

  async function save() {
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      // Partial PUT: only systemPrompt is sent, the rest of the YAML is preserved.
      res.set(await updateAgentConfig(projectId, agentId, { config: { systemPrompt: prompt } }));
      setSaved(true);
    } catch (err) {
      setSaveError(errText(err));
    } finally {
      setSaving(false);
    }
  }

  async function doReset() {
    setResetting(true);
    setSaveError(null);
    setSaved(false);
    try {
      res.set(await resetAgentConfig(projectId, agentId));
      setConfirmReset(false);
    } catch (err) {
      setSaveError(errText(err));
    } finally {
      setResetting(false);
    }
  }

  const config = res.data?.config;

  return (
    <>
      <Panel
        title="Agent 配置"
        description="system_config.yaml 与 AGENTS.md 的结构化视图。系统提示词按原文写入配置文件。"
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmReset(true)}
            disabled={!res.data || resetting}
          >
            重置为默认
          </Button>
        }
      >
        {res.error && <ErrorNote>{res.error}</ErrorNote>}
        {!res.data && !res.error && <Loading />}

        {res.data && config && (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1">
              <Meta>版本 v{config.version}</Meta>
              <Meta>运行中会话 {res.data.activeSessionCount}</Meta>
              {config.maxTurns !== undefined && <Meta>最大轮次 {config.maxTurns}</Meta>}
              <Meta>{res.data.stateDir}</Meta>
            </div>

            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[12px] font-medium text-foreground/80">系统提示词</span>
              <Meta>{prompt.length} 字符</Meta>
            </div>
            <textarea
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                setSaved(false);
              }}
              spellCheck={false}
              rows={14}
              className="w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 font-mono text-[12px] leading-5 text-foreground focus:outline-none focus-visible:outline-none"
            />

            <div className="mt-2 flex items-center gap-2">
              <Button size="sm" onClick={() => void save()} disabled={!dirty || saving}>
                {saving ? "保存中…" : "保存提示词"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPrompt(config.systemPrompt)}
                disabled={!dirty || saving}
              >
                放弃修改
              </Button>
            </div>
            {saveError && <ErrorNote>{saveError}</ErrorNote>}
            {saved && !dirty && <OkNote>已保存</OkNote>}

            <div className="mt-6 mb-1.5 flex items-center justify-between">
              <span className="text-[12px] font-medium text-foreground/80">
                内置工具集（只读）
              </span>
              <Meta>
                {config.toolsBuiltin.length} 个工具 · {config.mcpServers.length} 个 MCP
              </Meta>
            </div>
            <div className="max-h-80 overflow-y-auto rounded-xl border border-border/50 bg-surface-panel/70">
              {config.toolsBuiltin.length === 0 ? (
                <p className="px-3 py-8 text-center text-[12px] text-muted-foreground">
                  未配置内置工具
                </p>
              ) : (
                <ul className="divide-y divide-border/40">
                  {config.toolsBuiltin.map((tool) => (
                    <ToolRow key={tool.name} tool={tool} />
                  ))}
                </ul>
              )}
            </div>

            {config.mcpServers.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {config.mcpServers.map((server, i) => (
                  <li
                    key={`${server.name}-${i}`}
                    className="rounded border border-border/60 px-2 py-0.5 font-mono text-[11px] text-muted-foreground"
                  >
                    {server.name}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Panel>

      <Dialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="重置 Agent 配置？"
      >
        <p className="text-[13px] leading-6 text-muted-foreground">
          将使用当前默认配置覆盖 system_config.yaml，仅保留 name / description / version。
          系统提示词、工具集与 MCP 配置的本地修改都会丢失，且无法撤销。
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>
            取消
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => void doReset()}
            disabled={resetting}
          >
            {resetting ? "重置中…" : "确认重置"}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
