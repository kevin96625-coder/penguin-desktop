import { useState } from "react";
import { getVault, putVaultMerged } from "../../api/endpoints/agents";
import type { VaultResponse } from "../../api/types";
import { Button, Dialog, Input } from "../../design-system/components";
import {
  Empty,
  ErrorNote,
  Field,
  ListShell,
  Loading,
  Meta,
  Panel,
  useResource,
  errText,
} from "./common";

/** Shell env var naming rule, mirrored from the server so the UI fails fast. */
const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

type Editing = { key: string; mode: "edit" | "delete" };

/**
 * Vault: Agent-level environment variables (agent_state/.vault.toml).
 *
 * Values are write-only — GET returns `valueMasked`, never the plaintext, so "edit" always
 * means "set a new value" rather than "amend the current one". Every write goes through
 * `putVaultMerged`, because `PUT /vault` is a full-table replace: any key missing from the
 * body is deleted.
 */
export default function VaultSection({
  projectId,
  agentId,
}: {
  projectId: string;
  agentId: string;
}) {
  const key = `${projectId}/${agentId}`;
  const res = useResource<VaultResponse>(key, () => getVault(projectId, agentId));

  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [editing, setEditing] = useState<Editing | null>(null);
  const [editValue, setEditValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);

  const entries = res.data?.entries ?? [];
  const keyTaken = entries.some((e) => e.key === newKey.trim());
  const newKeyValid = KEY_RE.test(newKey.trim());

  async function write(change: { key: string; value?: string; remove?: boolean }) {
    setBusy(true);
    setWriteError(null);
    try {
      res.set(await putVaultMerged(projectId, agentId, change));
      return true;
    } catch (err) {
      setWriteError(errText(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    if (await write({ key: newKey.trim(), value: newValue })) {
      setNewKey("");
      setNewValue("");
    }
  }

  async function commitEdit() {
    if (!editing) return;
    const ok =
      editing.mode === "delete"
        ? await write({ key: editing.key, remove: true })
        : await write({ key: editing.key, value: editValue });
    if (ok) setEditing(null);
  }

  return (
    <>
      <Panel
        title="密钥库 Vault"
        description="Agent 级环境变量。值仅写入不回读，服务端只返回脱敏结果；修改即为覆盖为新值。"
        action={<Meta>{entries.length} 个变量</Meta>}
      >
        {res.error && <ErrorNote>{res.error}</ErrorNote>}
        {!res.data && !res.error && <Loading />}

        {res.data && (
          <>
            <div className="mb-3 flex items-end gap-2 rounded-xl border border-border/50 bg-surface-panel/70 p-3">
              <div className="w-56 shrink-0">
                <Field label="变量名">
                  <Input
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    placeholder="MY_API_TOKEN"
                    spellCheck={false}
                    className="font-mono"
                  />
                </Field>
              </div>
              <div className="min-w-0 flex-1">
                <Field label="值">
                  <Input
                    type="password"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    placeholder="写入后不可读取"
                    autoComplete="new-password"
                    className="font-mono"
                  />
                </Field>
              </div>
              <Button
                size="sm"
                className="mb-px"
                onClick={() => void add()}
                disabled={busy || !newKeyValid || !newValue || keyTaken}
              >
                添加
              </Button>
            </div>
            {newKey.trim() !== "" && !newKeyValid && (
              <ErrorNote>变量名需以字母或下划线开头，且只含字母、数字与下划线。</ErrorNote>
            )}
            {keyTaken && <ErrorNote>该变量名已存在，请直接在下方修改。</ErrorNote>}
            {writeError && <ErrorNote>{writeError}</ErrorNote>}

            <ListShell>
              {entries.length === 0 ? (
                <Empty>暂无环境变量</Empty>
              ) : (
                <ul className="divide-y divide-border/40">
                  {entries.map((entry) => (
                    <li
                      key={entry.key}
                      className="flex items-center gap-3 px-3 py-2"
                    >
                      <span className="w-56 shrink-0 truncate font-mono text-[12px] font-medium text-foreground/90">
                        {entry.key}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-muted-foreground">
                        {entry.valueMasked}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditValue("");
                          setEditing({ key: entry.key, mode: "edit" });
                        }}
                      >
                        修改
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditing({ key: entry.key, mode: "delete" })}
                      >
                        删除
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </ListShell>
          </>
        )}
      </Panel>

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.mode === "delete" ? "删除环境变量？" : "修改环境变量"}
      >
        <p className="font-mono text-[12px] text-foreground/85">{editing?.key}</p>
        {editing?.mode === "delete" ? (
          <p className="mt-3 text-[13px] leading-6 text-muted-foreground">
            该变量将从 .vault.toml 中移除，且无法恢复。
          </p>
        ) : (
          <div className="mt-3">
            <Field label="新值" hint="留空则保持原值不变。">
              <Input
                type="password"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                autoComplete="new-password"
                className="font-mono"
              />
            </Field>
          </div>
        )}
        {writeError && <ErrorNote>{writeError}</ErrorNote>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
            取消
          </Button>
          <Button
            variant={editing?.mode === "delete" ? "destructive" : "default"}
            size="sm"
            onClick={() => void commitEdit()}
            disabled={busy || (editing?.mode === "edit" && editValue === "")}
          >
            {busy ? "保存中…" : editing?.mode === "delete" ? "确认删除" : "保存"}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
